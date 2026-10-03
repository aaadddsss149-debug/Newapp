import path from "node:path"
import dotenv from "dotenv"
import { z } from "zod"
import { NETWORKS } from "./ton/networks.js"

// Load env from the repo root first, then a local backend/.env if present.
// dotenv does not override already-set vars, so the first file wins.
dotenv.config({ path: path.resolve(process.cwd(), "../.env") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const csv = z
	.string()
	.optional()
	.transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean))

const csvNumbers = z
	.string()
	.optional()
	.transform((v) =>
		(v ?? "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
			.map(Number)
			.filter((n) => Number.isFinite(n)),
	)

// Optional URL that also tolerates an empty string in .env (treats "" as unset).
const optionalUrl = z.preprocess(
	(v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
	z.string().url().optional(),
)

const Env = z.object({
	NODE_ENV: z.string().default("development"),
	PORT: z.coerce.number().default(8080),
	PUBLIC_URL: optionalUrl,
	CORS_ORIGINS: csv,
	BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
	INITDATA_MAX_AGE: z.coerce.number().default(3600),
	ADMIN_TELEGRAM_IDS: csvNumbers,
	ADMIN_PASSWORD: z.string().optional().default(""),
	SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
	ADMIN_SESSION_TTL_HOURS: z.coerce.number().default(12),
	TON_NETWORK: z.enum(["mainnet", "testnet"]).default("mainnet"),
	TON_API_ENDPOINT: optionalUrl,
	TON_API_KEY: z.string().optional().default(""),
	MERCHANT_ADDRESS: z.string().min(1, "MERCHANT_ADDRESS is required"),
	JETTON_MASTER_ADDRESS: z.string().min(1, "JETTON_MASTER_ADDRESS is required"),
	JETTON_DECIMALS: z.coerce.number().default(6),
	WATCH_INTERVAL_MS: z.coerce.number().default(3000),
	WATCH_MAX_BACKOFF_MS: z.coerce.number().default(60000),
	INVOICE_TTL_MINUTES: z.coerce.number().default(30),
	DB_PATH: z.string().default("./data/app.sqlite"),
	// Long-poll the bot for /start + payment notifications. Set "false" in prod
	// if you run the bot via webhook instead.
	BOT_POLLING: z.enum(["true", "false"]).optional().default("true"),
})

const parsed = Env.safeParse(process.env)
if (!parsed.success) {
	const msg = parsed.error.issues
		.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`)
		.join("\n")
	throw new Error(`Invalid environment configuration:\n${msg}\n\nSee .env.example`)
}

const e = parsed.data
const isProd = e.NODE_ENV === "production"
const network = NETWORKS[e.TON_NETWORK]

export const config = {
	...e,
	isProd,
	tonApiEndpoint: e.TON_API_ENDPOINT ?? network.rpc,
	adminIds: new Set<number>(e.ADMIN_TELEGRAM_IDS),
	tonviewerBase: network.explorer,
	adminBrowserLoginEnabled: e.ADMIN_PASSWORD.length > 0,
	botPolling: e.BOT_POLLING === "true",
}

export type AppConfig = typeof config
