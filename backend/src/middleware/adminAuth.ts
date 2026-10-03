import type { NextFunction, Request, Response } from "express"
import { ADMIN_COOKIE, verifyAdminSession } from "../auth/session.js"
import { config } from "../config.js"
import { verifyInitData } from "../telegram/initData.js"
import { extractInitData, type AuthedRequest } from "./auth.js"

/**
 * Grants admin access if EITHER:
 *  - a valid browser admin session cookie is present (password login), OR
 *  - a valid Telegram initData belongs to an allow-listed admin id.
 *
 * Security note: the /admin URL is NOT a secret. Access is enforced here on
 * every request, so an unauthenticated visitor to /admin gets 401 from the API.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
	const cookies = (req as Request & { cookies?: Record<string, string> }).cookies
	const cookieToken = cookies?.[ADMIN_COOKIE]
	if (verifyAdminSession(cookieToken)) {
		;(req as AuthedRequest).initDataOk = true
		next()
		return
	}

	const initData = extractInitData(req)
	if (initData) {
		const r = verifyInitData(initData)
		if (r.ok && r.user && config.adminIds.has(r.user.id)) {
			;(req as AuthedRequest).tgUser = r.user
			next()
			return
		}
	}

	res.status(401).json({ error: "admin unauthorized" })
}
