import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { config } from "./config.js"
import type { TgUser } from "./telegram/initData.js"

const dbPath = path.resolve(process.cwd(), config.DB_PATH)
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma("journal_mode = WAL")

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  telegram_id   INTEGER PRIMARY KEY,
  username      TEXT,
  first_name    TEXT,
  last_name     TEXT,
  language_code TEXT,
  is_premium    INTEGER DEFAULT 0,
  first_seen    TEXT NOT NULL,
  last_seen     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  telegram_id    INTEGER NOT NULL,
  asset          TEXT NOT NULL,
  amount         TEXT NOT NULL,
  expected_units TEXT NOT NULL,
  memo           TEXT NOT NULL UNIQUE,
  to_address     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  tx_hash        TEXT,
  from_address   TEXT,
  created_at     TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  paid_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(telegram_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS processed_tx (
  tx_key     TEXT PRIMARY KEY,
  order_id   TEXT,
  created_at TEXT NOT NULL
);
`)

export type OrderRow = {
	id: string
	telegram_id: number
	asset: "TON" | "USDT"
	amount: string
	expected_units: string
	memo: string
	to_address: string
	status: "pending" | "paid" | "expired"
	tx_hash: string | null
	from_address: string | null
	created_at: string
	expires_at: string
	paid_at: string | null
}

export type UserRow = {
	telegram_id: number
	username: string | null
	first_name: string | null
	last_name: string | null
	language_code: string | null
	is_premium: number
	first_seen: string
	last_seen: string
}

export function upsertUser(u: TgUser): void {
	const now = new Date().toISOString()
	db.prepare(
		`INSERT INTO users (telegram_id, username, first_name, last_name, language_code, is_premium, first_seen, last_seen)
		 VALUES (@id, @username, @first_name, @last_name, @language_code, @is_premium, @now, @now)
		 ON CONFLICT(telegram_id) DO UPDATE SET
		   username = excluded.username,
		   first_name = excluded.first_name,
		   last_name = excluded.last_name,
		   language_code = excluded.language_code,
		   is_premium = excluded.is_premium,
		   last_seen = @now`,
	).run({
		id: u.id,
		username: u.username ?? null,
		first_name: u.first_name ?? null,
		last_name: u.last_name ?? null,
		language_code: u.language_code ?? null,
		is_premium: u.is_premium ? 1 : 0,
		now,
	})
}

export function createOrder(o: {
	id: string
	telegramId: number
	asset: "TON" | "USDT"
	amount: string
	expectedUnits: string
	memo: string
	toAddress: string
	createdAt: string
	expiresAt: string
}): OrderRow {
	db.prepare(
		`INSERT INTO orders (id, telegram_id, asset, amount, expected_units, memo, to_address, status, created_at, expires_at)
		 VALUES (@id, @telegramId, @asset, @amount, @expectedUnits, @memo, @toAddress, 'pending', @createdAt, @expiresAt)`,
	).run(o)
	return getOrderById(o.id)!
}

export function getOrderById(id: string): OrderRow | undefined {
	return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined
}

export function getOrderByMemo(memo: string): OrderRow | undefined {
	return db.prepare("SELECT * FROM orders WHERE memo = ?").get(memo) as OrderRow | undefined
}

export function getOrdersByUser(telegramId: number, limit = 50): OrderRow[] {
	return db
		.prepare("SELECT * FROM orders WHERE telegram_id = ? ORDER BY created_at DESC LIMIT ?")
		.all(telegramId, limit) as OrderRow[]
}

export function listOrders(opts: { status?: string; limit?: number } = {}): OrderRow[] {
	const limit = opts.limit ?? 100
	if (opts.status && opts.status !== "all") {
		return db
			.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?")
			.all(opts.status, limit) as OrderRow[]
	}
	return db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?").all(limit) as OrderRow[]
}

export function listUsers(limit = 200): UserRow[] {
	return db.prepare("SELECT * FROM users ORDER BY last_seen DESC LIMIT ?").all(limit) as UserRow[]
}

export function getUserById(telegramId: number): UserRow | undefined {
	return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId) as
		| UserRow
		| undefined
}

/**
 * Idempotent transition pending -> paid. Returns true only if THIS call
 * performed the transition (so a payment can never be counted twice).
 */
export function markOrderPaid(
	id: string,
	info: { txHash: string; fromAddress: string | null },
): boolean {
	const now = new Date().toISOString()
	const res = db
		.prepare(
			"UPDATE orders SET status = 'paid', tx_hash = @txHash, from_address = @fromAddress, paid_at = @now WHERE id = @id AND status = 'pending'",
		)
		.run({ id, txHash: info.txHash, fromAddress: info.fromAddress, now })
	return res.changes > 0
}

export function expireStaleOrders(): void {
	const now = new Date().toISOString()
	db.prepare("UPDATE orders SET status = 'expired' WHERE status = 'pending' AND expires_at < ?").run(now)
}

export function isTxProcessed(key: string): boolean {
	return !!db.prepare("SELECT 1 FROM processed_tx WHERE tx_key = ?").get(key)
}

export function recordTx(key: string, orderId: string | null): boolean {
	try {
		db.prepare("INSERT INTO processed_tx (tx_key, order_id, created_at) VALUES (?, ?, ?)").run(
			key,
			orderId,
			new Date().toISOString(),
		)
		return true
	} catch {
		return false
	}
}

export function getStats(): {
	users: number
	paidOrders: number
	pendingOrders: number
	revenue: Record<string, number>
} {
	const users = (db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c
	const paidOrders = (
		db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'paid'").get() as { c: number }
	).c
	const pendingOrders = (
		db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get() as { c: number }
	).c
	const rows = db
		.prepare(
			"SELECT asset, SUM(CAST(amount AS REAL)) total FROM orders WHERE status = 'paid' GROUP BY asset",
		)
		.all() as Array<{ asset: string; total: number }>
	const revenue: Record<string, number> = {}
	for (const r of rows) revenue[r.asset] = r.total
	return { users, paidOrders, pendingOrders, revenue }
}
