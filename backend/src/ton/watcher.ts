import { Address } from "@ton/core"
import { config } from "../config.js"
import {
	expireStaleOrders,
	getOrderById,
	getOrderByMemo,
	isTxProcessed,
	markOrderPaid,
	recordTx,
} from "../db.js"
import { notifyPaid } from "../telegram/bot.js"
import { logger } from "../logger.js"
import { tonClient } from "./client.js"
import { getJettonWalletAddress, parseInternalTransfer, readComment } from "./jetton.js"

let running = false
let stopped = false
let backoff = 0
let merchantJettonWallet: Address | null = null

async function ensureJettonWallet(): Promise<Address> {
	if (merchantJettonWallet) return merchantJettonWallet
	const master = Address.parse(config.JETTON_MASTER_ADDRESS)
	const merchant = Address.parse(config.MERCHANT_ADDRESS)
	merchantJettonWallet = await getJettonWalletAddress(master, merchant)
	logger.info("merchant jetton wallet:", merchantJettonWallet.toString())
	return merchantJettonWallet
}

function txKey(lt: bigint, hash: string): string {
	return `${lt}:${hash}`
}

// Verify native TON payments arriving at the merchant address.
async function scanTon(): Promise<void> {
	const merchant = Address.parse(config.MERCHANT_ADDRESS)
	const txs = await tonClient.getTransactions(merchant, { limit: 20 })
	for (const tx of txs) {
		const inMsg = tx.inMessage
		if (!inMsg || inMsg.info.type !== "internal") continue
		const hash = tx.hash().toString("hex")
		const key = txKey(tx.lt, hash)
		if (isTxProcessed(key)) continue

		const value = inMsg.info.value.coins
		const memo = readComment(inMsg.body.beginParse())
		if (!memo) {
			recordTx(key, null)
			continue
		}
		const order = getOrderByMemo(memo)
		if (!order || order.asset !== "TON") {
			recordTx(key, null)
			continue
		}
		if (value >= BigInt(order.expected_units)) {
			const paid = markOrderPaid(order.id, {
				txHash: hash,
				fromAddress: inMsg.info.src ? inMsg.info.src.toString() : null,
			})
			if (paid) {
				logger.info(`order ${order.id} paid via TON`)
				const fresh = getOrderById(order.id)
				if (fresh) void notifyPaid(fresh)
			}
		} else {
			logger.warn(`order ${order.memo} underpaid: got ${value} expected ${order.expected_units}`)
		}
		recordTx(key, order.id)
	}
}

// Verify USDT payments arriving at the MERCHANT's jetton wallet.
// getTransactions is scoped to that wallet, which guarantees the jetton is authentic.
async function scanJetton(): Promise<void> {
	const wallet = await ensureJettonWallet()
	const txs = await tonClient.getTransactions(wallet, { limit: 20 })
	for (const tx of txs) {
		const inMsg = tx.inMessage
		if (!inMsg || inMsg.info.type !== "internal") continue
		const hash = tx.hash().toString("hex")
		const key = txKey(tx.lt, hash)
		if (isTxProcessed(key)) continue

		// The merchant jetton wallet RECEIVES internal_transfer (0x178d4519),
		// not transfer_notification. Parse that op to read amount + memo.
		const parsed = parseInternalTransfer(inMsg.body)
		if (!parsed || !parsed.memo) {
			recordTx(key, null)
			continue
		}
		const order = getOrderByMemo(parsed.memo)
		if (!order || order.asset !== "USDT") {
			recordTx(key, null)
			continue
		}
		if (parsed.amount >= BigInt(order.expected_units)) {
			const paid = markOrderPaid(order.id, {
				txHash: hash,
				fromAddress: parsed.from ? parsed.from.toString() : null,
			})
			if (paid) {
				logger.info(`order ${order.id} paid via USDT`)
				const fresh = getOrderById(order.id)
				if (fresh) void notifyPaid(fresh)
			}
		} else {
			logger.warn(
				`order ${order.memo} underpaid: got ${parsed.amount} expected ${order.expected_units}`,
			)
		}
		recordTx(key, order.id)
	}
}

export async function pollOnce(): Promise<void> {
	expireStaleOrders()
	// Run both scanners independently: a failure in one (e.g. a transient
	// toncenter rate-limit on the jetton call) must not prevent the other from
	// confirming payments. This is why TON could confirm while USDT stalled.
	const results = await Promise.allSettled([scanTon(), scanJetton()])
	const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined
	if (failed) throw failed.reason
}

async function loop(): Promise<void> {
	if (stopped) return
	try {
		await pollOnce()
		backoff = 0
	} catch (err) {
		backoff = Math.min(config.WATCH_MAX_BACKOFF_MS, (backoff || config.WATCH_INTERVAL_MS) * 2)
		logger.warn("watcher error, backing off", (err as Error).message, `next in ${backoff}ms`)
	}
	const delay = backoff > 0 ? backoff : config.WATCH_INTERVAL_MS
	setTimeout(loop, delay)
}

export function startWatcher(): void {
	if (running) return
	running = true
	stopped = false
	logger.info(`payment watcher started (interval ${config.WATCH_INTERVAL_MS}ms)`)
	void loop()
}

export function stopWatcher(): void {
	stopped = true
	running = false
}

// Instant "kick": run one scan immediately (used right after the user signs)
// so a payment is confirmed in ~1-3s instead of waiting for the next tick.
let kicking: Promise<void> | null = null
export async function checkNow(): Promise<void> {
	if (kicking) return kicking
	kicking = (async () => {
		try {
			await pollOnce()
		} catch (e) {
			logger.warn("checkNow error", (e as Error).message)
		} finally {
			kicking = null
		}
	})()
	return kicking
}
