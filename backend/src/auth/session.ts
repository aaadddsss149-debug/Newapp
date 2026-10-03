import crypto from "node:crypto"
import { config } from "../config.js"

export const ADMIN_COOKIE = "admin_session"

function b64url(buf: Buffer): string {
	return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function sign(payloadB64: string): string {
	return b64url(crypto.createHmac("sha256", config.SESSION_SECRET).update(payloadB64).digest())
}

/** Create a signed, expiring admin session token (HMAC-SHA256). */
export function createAdminSession(ttlMs: number): string {
	const exp = Date.now() + ttlMs
	const payloadB64 = b64url(Buffer.from(JSON.stringify({ exp })))
	return `${payloadB64}.${sign(payloadB64)}`
}

/** Verify a session token: constant-time signature check + expiry check. */
export function verifyAdminSession(token: string | undefined | null): boolean {
	if (!token) return false
	const parts = token.split(".")
	if (parts.length !== 2) return false
	const [payloadB64, sig] = parts
	const expected = sign(payloadB64)
	const a = Buffer.from(sig)
	const b = Buffer.from(expected)
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
	try {
		const json = Buffer.from(
			payloadB64.replace(/-/g, "+").replace(/_/g, "/"),
			"base64",
		).toString()
		const { exp } = JSON.parse(json) as { exp: number }
		return typeof exp === "number" && Date.now() < exp
	} catch {
		return false
	}
}
