import crypto from "node:crypto"
import { Router } from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import { ADMIN_COOKIE, createAdminSession } from "../auth/session.js"
import { config } from "../config.js"
import { getOrderById, getStats, listOrders, listUsers } from "../db.js"
import { requireAdmin } from "../middleware/adminAuth.js"

const router = Router()

// Hard brute-force protection on the password login endpoint.
const loginLimiter = rateLimit({
	windowMs: 15 * 60_000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "too many attempts, try again later" },
})

function timingSafeEqualStr(a: string, b: string): boolean {
	const ab = Buffer.from(a)
	const bb = Buffer.from(b)
	if (ab.length !== bb.length) return false
	return crypto.timingSafeEqual(ab, bb)
}

// Browser login with the password from .env -> issues a signed session cookie.
router.post("/login", loginLimiter, (req, res) => {
	if (!config.adminBrowserLoginEnabled) {
		res.status(503).json({ error: "browser admin login disabled" })
		return
	}
	const parsed = z.object({ password: z.string() }).safeParse(req.body)
	if (!parsed.success) {
		res.status(400).json({ error: "password required" })
		return
	}
	if (!timingSafeEqualStr(parsed.data.password, config.ADMIN_PASSWORD)) {
		res.status(401).json({ error: "invalid credentials" })
		return
	}
	const ttlMs = config.ADMIN_SESSION_TTL_HOURS * 3600_000
	const token = createAdminSession(ttlMs)
	res.cookie(ADMIN_COOKIE, token, {
		httpOnly: true,
		secure: config.isProd,
		sameSite: "lax",
		maxAge: ttlMs,
		path: "/",
	})
	res.json({ ok: true })
})

router.post("/logout", (_req, res) => {
	res.clearCookie(ADMIN_COOKIE, { path: "/" })
	res.json({ ok: true })
})

router.get("/me", requireAdmin, (_req, res) => {
	res.json({ ok: true, browserLoginEnabled: config.adminBrowserLoginEnabled, network: config.TON_NETWORK })
})

router.get("/stats", requireAdmin, (_req, res) => {
	res.json({ ...getStats(), network: config.TON_NETWORK })
})

router.get("/orders", requireAdmin, (req, res) => {
	const status = typeof req.query.status === "string" ? req.query.status : undefined
	res.json({ orders: listOrders({ status }) })
})

router.get("/orders/:id", requireAdmin, (req, res) => {
	const o = getOrderById(req.params.id)
	if (!o) {
		res.status(404).json({ error: "not found" })
		return
	}
	res.json({ order: o })
})

router.get("/users", requireAdmin, (_req, res) => {
	res.json({ users: listUsers() })
})

export default router
