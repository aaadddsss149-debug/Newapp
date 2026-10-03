import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import rateLimit from "express-rate-limit"
import helmet from "helmet"
import { config } from "./config.js"
import { logger } from "./logger.js"
import adminRoutes from "./routes/admin.js"
import authRoutes from "./routes/auth.js"
import paymentRoutes from "./routes/payments.js"
import tonRoutes from "./routes/ton.js"
import { startBot } from "./telegram/bot.js"
import { startWatcher } from "./ton/watcher.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.set("trust proxy", 1)

app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "'unsafe-inline'", "https://telegram.org"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				imgSrc: ["'self'", "data:", "https:"],
				connectSrc: ["'self'", "https:", "wss:"],
				frameAncestors: ["https://web.telegram.org", "https://*.telegram.org"],
			},
		},
		crossOriginEmbedderPolicy: false,
	}),
)
app.use(cors({ origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : true, credentials: true }))
app.use(express.json({ limit: "64kb" }))
app.use(cookieParser())
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }))

app.get("/api/health", (_req, res) => res.json({ ok: true, network: config.TON_NETWORK }))
app.use("/api/auth", authRoutes)
app.use("/api/ton", tonRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/admin", adminRoutes)

// Single-origin: serve the built frontend (and /admin via SPA fallback).
const frontendDist = path.resolve(__dirname, "../../frontend/dist")
if (fs.existsSync(frontendDist)) {
	app.use(express.static(frontendDist))
	app.get("*", (req, res, next) => {
		if (req.path.startsWith("/api/")) return next()
		res.sendFile(path.join(frontendDist, "index.html"))
	})
} else {
	logger.warn(`frontend build not found at ${frontendDist} - build the frontend for production`)
}

app.use(
	(err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		logger.error("unhandled error", err?.message)
		res.status(500).json({ error: "internal error" })
	},
)

app.listen(config.PORT, () => {
	logger.info(`server listening on :${config.PORT} (${config.NODE_ENV}, ${config.TON_NETWORK})`)
	startWatcher()
	startBot()
})
