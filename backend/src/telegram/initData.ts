import crypto from "node:crypto"
import { config } from "../config.js"

export type TgUser = {
	id: number
	username?: string
	first_name?: string
	last_name?: string
	language_code?: string
	is_premium?: boolean
}

export type InitDataResult = {
	ok: boolean
	reason?: string
	user?: TgUser
	authDate?: number
}

/**
 * Verify Telegram WebApp initData on the SERVER.
 * secret_key = HMAC_SHA256("WebAppData", bot_token)
 * expected_hash = HMAC_SHA256(secret_key, data_check_string)
 * Uses a constant-time comparison and enforces auth_date freshness.
 */
export function verifyInitData(initData: string): InitDataResult {
	if (!initData) return { ok: false, reason: "empty" }

	const params = new URLSearchParams(initData)
	const hash = params.get("hash")
	if (!hash) return { ok: false, reason: "no hash" }

	const pairs: string[] = []
	params.forEach((value, key) => {
		if (key !== "hash") pairs.push(`${key}=${value}`)
	})
	pairs.sort()
	const dataCheckString = pairs.join("\n")

	const secretKey = crypto.createHmac("sha256", "WebAppData").update(config.BOT_TOKEN).digest()
	const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

	const a = Buffer.from(computed, "hex")
	const b = Buffer.from(hash, "hex")
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
		return { ok: false, reason: "bad signature" }
	}

	const authDate = Number(params.get("auth_date") || "0")
	if (config.INITDATA_MAX_AGE > 0) {
		const age = Math.floor(Date.now() / 1000) - authDate
		if (age > config.INITDATA_MAX_AGE) return { ok: false, reason: "expired" }
	}

	let user: TgUser | undefined
	const userRaw = params.get("user")
	if (userRaw) {
		try {
			user = JSON.parse(userRaw) as TgUser
		} catch {
			/* ignore malformed user */
		}
	}

	return { ok: true, user, authDate }
}
