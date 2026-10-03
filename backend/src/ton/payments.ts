import { randomBytes } from "node:crypto"
import { Address, toNano } from "@ton/core"
import { config } from "../config.js"
import { createOrder, type OrderRow } from "../db.js"
import { buildCommentCell, buildJettonTransferBody, getJettonWalletAddress } from "./jetton.js"

export type TxMessage = { address: string; amount: string; payload?: string; stateInit?: string }
export type InvoiceResult = { order: OrderRow; tx: { validUntil: number; messages: TxMessage[] } }

function newMemo(): string {
	return "ord_" + randomBytes(8).toString("hex")
}
function newId(): string {
	return randomBytes(12).toString("hex")
}

/** Convert a human decimal string to integer base units for the given decimals. */
export function toUnits(amount: string, decimals: number): bigint {
	const [i, f = ""] = amount.trim().split(".")
	const frac = (f + "0".repeat(decimals)).slice(0, decimals)
	return BigInt(i || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0")
}

/**
 * Create an invoice: persist a pending order with a unique memo + expected amount,
 * and return the transaction request for TON Connect to sign on the client.
 * The client never states "paid" — the watcher confirms on-chain.
 */
export async function createInvoice(args: {
	telegramId: number
	asset: "TON" | "USDT"
	amount: string
	userAddress: string
}): Promise<InvoiceResult> {
	const memo = newMemo()
	const id = newId()
	const now = new Date()
	const expiresAt = new Date(now.getTime() + config.INVOICE_TTL_MINUTES * 60_000)
	const validUntil = Math.floor(expiresAt.getTime() / 1000)
	const merchant = Address.parse(config.MERCHANT_ADDRESS)

	let expectedUnits: bigint
	let messages: TxMessage[]

	if (args.asset === "TON") {
		expectedUnits = toNano(args.amount)
		messages = [
			{
				address: merchant.toString(),
				amount: expectedUnits.toString(),
				payload: buildCommentCell(memo).toBoc().toString("base64"),
			},
		]
	} else {
		expectedUnits = toUnits(args.amount, config.JETTON_DECIMALS)
		const owner = Address.parse(args.userAddress)
		const master = Address.parse(config.JETTON_MASTER_ADDRESS)
		const userJettonWallet = await getJettonWalletAddress(master, owner)
		const body = buildJettonTransferBody({
			jettonAmount: expectedUnits,
			to: merchant,
			responseTo: owner,
			forwardTon: toNano("0.02"),
			comment: memo,
		})
		messages = [
			{
				// jetton transfers are sent to the OWNER's jetton wallet
				address: userJettonWallet.toString(),
				amount: toNano("0.1").toString(), // TON gas budget for the transfer
				payload: body.toBoc().toString("base64"),
			},
		]
	}

	const order = createOrder({
		id,
		telegramId: args.telegramId,
		asset: args.asset,
		amount: args.amount,
		expectedUnits: expectedUnits.toString(),
		memo,
		toAddress: merchant.toString(),
		createdAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
	})

	return { order, tx: { validUntil, messages } }
}
