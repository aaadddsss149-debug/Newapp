import { Router } from "express"
import { config } from "../config.js"
import { requireTelegramAuth, type AuthedRequest } from "../middleware/auth.js"

const router = Router()

// Returns the verified Telegram user (server-checked) + whether they are an admin.
router.get("/me", requireTelegramAuth, (req, res) => {
	const u = (req as AuthedRequest).tgUser!
	res.json({
		user: {
			id: u.id,
			username: u.username,
			first_name: u.first_name,
			last_name: u.last_name,
			language_code: u.language_code,
			is_premium: !!u.is_premium,
		},
		isAdmin: config.adminIds.has(u.id),
	})
})

export default router
