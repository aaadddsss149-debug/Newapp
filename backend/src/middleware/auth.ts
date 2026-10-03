import type { NextFunction, Request, Response } from "express"
import { upsertUser } from "../db.js"
import { verifyInitData, type TgUser } from "../telegram/initData.js"

export type AuthedRequest = Request & { tgUser?: TgUser; initDataOk?: boolean }

/** Extract Telegram initData from either the `Authorization: tma <initData>`
 * header or the `X-Telegram-Init-Data` fallback header. */
export function extractInitData(req: Request): string {
	const auth = req.header("authorization") || ""
	if (auth.startsWith("tma ")) return auth.slice(4).trim()
	const x = req.header("x-telegram-init-data")
	return x ? x.trim() : ""
}

/** Require a valid Telegram user. On success, upserts the user and attaches it to req. */
export function requireTelegramAuth(req: Request, res: Response, next: NextFunction): void {
	const initData = extractInitData(req)
	const result = verifyInitData(initData)
	if (!result.ok || !result.user) {
		res.status(401).json({ error: "unauthorized" })
		return
	}
	upsertUser(result.user)
	;(req as AuthedRequest).tgUser = result.user
	next()
}
