import { Address, beginCell, Cell, type Slice } from "@ton/core"
import { tonClient } from "./client.js"

export const OP_JETTON_TRANSFER = 0xf8a7ea5
export const OP_TRANSFER_NOTIFICATION = 0x7362d09c
export const OP_INTERNAL_TRANSFER = 0x178d4519

/** Build a text-comment cell (op = 0 followed by the UTF-8 text). */
export function buildCommentCell(text: string): Cell {
	return beginCell().storeUint(0, 32).storeStringTail(text).endCell()
}

/** Read a text comment (op = 0 + text) from a slice. Returns null if not a comment. */
export function readComment(slice: Slice): string | null {
	try {
		if (slice.remainingBits < 32) return null
		const op = slice.loadUint(32)
		if (op !== 0) return null
		return slice.loadStringTail()
	} catch {
		return null
	}
}

/** Compute the jetton wallet address owned by `owner` for a given jetton master. */
export async function getJettonWalletAddress(master: Address, owner: Address): Promise<Address> {
	const res = await tonClient.runMethod(master, "get_wallet_address", [
		{ type: "slice", cell: beginCell().storeAddress(owner).endCell() },
	])
	return res.stack.readAddress()
}

/** Build a TEP-74 jetton transfer body carrying a text comment (memo) in the forward payload. */
export function buildJettonTransferBody(args: {
	jettonAmount: bigint
	to: Address
	responseTo: Address
	forwardTon: bigint
	comment: string
}): Cell {
	return beginCell()
		.storeUint(OP_JETTON_TRANSFER, 32)
		.storeUint(BigInt(Date.now()), 64) // query_id
		.storeCoins(args.jettonAmount)
		.storeAddress(args.to) // destination (merchant)
		.storeAddress(args.responseTo) // response destination (refund excess gas)
		.storeBit(false) // no custom payload
		.storeCoins(args.forwardTon) // forward TON so a notification is produced
		.storeBit(true) // forward payload stored as a ref
		.storeRef(buildCommentCell(args.comment))
		.endCell()
}

/** Parse an incoming transfer_notification (op 0x7362d09c): jetton amount, sender, memo. */
export function parseTransferNotification(
	body: Cell,
): { amount: bigint; sender: Address | null; memo: string | null } | null {
	try {
		const s = body.beginParse()
		if (s.remainingBits < 32) return null
		const op = s.loadUint(32)
		if (op !== OP_TRANSFER_NOTIFICATION) return null
		s.loadUintBig(64) // query_id
		const amount = s.loadCoins()
		const sender = s.loadMaybeAddress()
		const isRef = s.loadBit()
		const payload: Slice | null = isRef ? s.loadRef().beginParse() : s
		const memo = payload ? readComment(payload) : null
		return { amount, sender, memo }
	} catch {
		return null
	}
}

/**
 * Parse the internal_transfer (op 0x178d4519) that a jetton wallet RECEIVES.
 *
 * This is what actually lands on the MERCHANT's jetton wallet: the sender's
 * jetton wallet sends internal_transfer here, and only then does our wallet emit
 * a transfer_notification to its owner. So when we scope getTransactions to the
 * merchant jetton wallet, the incoming op is internal_transfer, NOT
 * transfer_notification. Layout (TEP-74):
 *   query_id:uint64 amount:(VarUInteger 16) from:MsgAddress
 *   response_address:MsgAddress forward_ton_amount:(VarUInteger 16)
 *   forward_payload:(Either Cell ^Cell)
 */
export function parseInternalTransfer(
	body: Cell,
): { amount: bigint; from: Address | null; memo: string | null } | null {
	try {
		const s = body.beginParse()
		if (s.remainingBits < 32) return null
		const op = s.loadUint(32)
		if (op !== OP_INTERNAL_TRANSFER) return null
		s.loadUintBig(64) // query_id
		const amount = s.loadCoins()
		const from = s.loadMaybeAddress() // original sender (payer)
		s.loadMaybeAddress() // response_address
		s.loadCoins() // forward_ton_amount
		const isRef = s.loadBit()
		const payload: Slice | null = isRef ? s.loadRef().beginParse() : s
		const memo = payload ? readComment(payload) : null
		return { amount, from, memo }
	} catch {
		return null
	}
}
