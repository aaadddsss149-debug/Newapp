import { getInitData } from "./telegram"

const BASE = import.meta.env.VITE_API_BASE || "/api"

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(opts.headers as Record<string, string> | undefined),
	}
	// Attach Telegram initData when running inside Telegram. In the browser admin
	// there is no initData; the admin session cookie authenticates instead.
	const initData = getInitData()
	if (initData) headers["Authorization"] = `tma ${initData}`

	const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: "same-origin" })
	if (!res.ok) {
		let msg = `HTTP ${res.status}`
		try {
			const j = await res.json()
			msg = j.error || msg
		} catch {
			/* ignore */
		}
		throw new Error(msg)
	}
	return res.json() as Promise<T>
}

export type PublicOrder = {
	id: string
	asset: "TON" | "USDT"
	amount: string
	memo: string
	status: "pending" | "paid" | "expired"
	toAddress: string
	createdAt: string
	expiresAt: string
	paidAt: string | null
	txHash: string | null
}

export type Me = {
	user: {
		id: number
		username?: string
		first_name?: string
		last_name?: string
		language_code?: string
		is_premium?: boolean
	}
	isAdmin: boolean
}

export type TxRequest = {
	validUntil: number
	messages: { address: string; amount: string; payload?: string; stateInit?: string }[]
}

export type AdminStats = {
	users: number
	paidOrders: number
	pendingOrders: number
	revenue: Record<string, number>
	network: string
}

export const api = {
	me: () => req<Me>("/auth/me"),
	balance: (address: string) =>
		req<{ ton: string; usdt: string }>(`/ton/balance?address=${encodeURIComponent(address)}`),
	createInvoice: (asset: "TON" | "USDT", amount: string, address: string) =>
		req<{ order: PublicOrder; tx: TxRequest }>("/payments/invoice", {
			method: "POST",
			body: JSON.stringify({ asset, amount, address }),
		}),
	order: (id: string) => req<{ order: PublicOrder }>(`/payments/${id}`),
	checkOrder: (id: string) => req<{ order: PublicOrder }>(`/payments/${id}/check`, { method: "POST" }),
	myOrders: () => req<{ orders: PublicOrder[] }>("/payments/mine"),
	// admin
	adminLogin: (password: string) =>
		req<{ ok: boolean }>("/admin/login", { method: "POST", body: JSON.stringify({ password }) }),
	adminLogout: () => req<{ ok: boolean }>("/admin/logout", { method: "POST" }),
	adminMe: () => req<{ ok: boolean; browserLoginEnabled: boolean; network: string }>("/admin/me"),
	adminStats: () => req<AdminStats>("/admin/stats"),
	adminOrders: (status?: string) =>
		req<{ orders: Record<string, unknown>[] }>(
			`/admin/orders${status && status !== "all" ? `?status=${status}` : ""}`,
		),
	adminUsers: () => req<{ users: Record<string, unknown>[] }>("/admin/users"),
}

export { BASE }
