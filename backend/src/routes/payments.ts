import { Router } from "express"
import { z } from "zod"
import { getOrderById, getOrdersByUser, type OrderRow } from "../db.js"
import { requireTelegramAuth, type AuthedRequest } from "../middleware/auth.js"
import { createInvoice } from "../ton/payments.js"
import { checkNow } from "../ton/watcher.js"

const router = Router()

const InvoiceSchema = z.object({
	asset: z.enum(["TON", "USDT"]),
	amount: z
		.string()
		.regex(/^\d+(\.\d{1,9})?$/, "invalid amount")
		.refine((v) => Number(v) > 0, "amount must be > 0"),
	address: z.string().min(10),
})

function publicOrder(o: OrderRow) {
	return {
		id: o.id,
		asset: o.asset,
		amount: o.amount,
		memo: o.memo,
		status: o.status,
		toAddress: o.to_address,
		createdAt: o.created_at,
		expiresAt: o.expires_at,
		paidAt: o.paid_at,
		txHash: o.tx_hash,
	}
}

router.post("/invoice", requireTelegramAuth, async (req, res) => {
	const parsed = InvoiceSchema.safeParse(req.body)
	if (!parsed.success) {
		res.status(400).json({ error: "invalid request", details: parsed.error.issues })
		return
	}
	const u = (req as AuthedRequest).tgUser!
	try {
		const { order, tx } = await createInvoice({
			telegramId: u.id,
			asset: parsed.data.asset,
			amount: parsed.data.amount,
			userAddress: parsed.data.address,
		})
		res.json({ order: publicOrder(order), tx })
	} catch {
		res.status(500).json({ error: "could not create invoice" })
	}
})

router.get("/mine", requireTelegramAuth, (req, res) => {
	const u = (req as AuthedRequest).tgUser!
	res.json({ orders: getOrdersByUser(u.id).map(publicOrder) })
})

router.get("/:id", requireTelegramAuth, (req, res) => {
	const u = (req as AuthedRequest).tgUser!
	const o = getOrderById(req.params.id)
	if (!o || o.telegram_id !== u.id) {
		res.status(404).json({ error: "not found" })
		return
	}
	res.json({ order: publicOrder(o) })
})

// Instant re-check right after the user signs in their wallet.
router.post("/:id/check", requireTelegramAuth, async (req, res) => {
	const u = (req as AuthedRequest).tgUser!
	const o = getOrderById(req.params.id)
	if (!o || o.telegram_id !== u.id) {
		res.status(404).json({ error: "not found" })
		return
	}
	await checkNow()
	const fresh = getOrderById(req.params.id)!
	res.json({ order: publicOrder(fresh) })
})

export default router
