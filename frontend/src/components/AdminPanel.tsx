import { useEffect, useState } from "react"
import { api, type AdminStats } from "../api"
import { assetLabel, statusText, useI18n } from "../i18n"

type Tab = "dashboard" | "orders" | "users"
type OrderStatus = "all" | "pending" | "paid" | "expired"

const TONVIEWER: Record<string, string> = {
	mainnet: "https://tonviewer.com",
	testnet: "https://testnet.tonviewer.com",
}

export default function AdminPanel({
	mode,
	onLogout,
}: {
	mode: "browser" | "telegram"
	onLogout: () => void
}) {
	const { t, lang, setLang } = useI18n()
	const [tab, setTab] = useState<Tab>("dashboard")
	const [stats, setStats] = useState<AdminStats | null>(null)
	const [orders, setOrders] = useState<Record<string, unknown>[]>([])
	const [users, setUsers] = useState<Record<string, unknown>[]>([])
	const [status, setStatus] = useState<OrderStatus>("all")
	const [detail, setDetail] = useState<Record<string, unknown> | null>(null)

	const network = stats?.network || "mainnet"
	const tvBase = TONVIEWER[network] || TONVIEWER.mainnet

	useEffect(() => {
		api.adminStats().then(setStats).catch(() => {})
	}, [])
	useEffect(() => {
		if (tab === "orders") api.adminOrders(status).then((r) => setOrders(r.orders)).catch(() => {})
		if (tab === "users") api.adminUsers().then((r) => setUsers(r.users)).catch(() => {})
	}, [tab, status])

	async function logout() {
		try {
			await api.adminLogout()
		} catch {
			/* ignore */
		}
		onLogout()
	}

	return (
		<div className="app admin">
			<header className="app-header">
				<span className="app-title">
					{t("admin_title")} <span className="pill">{network}</span>
				</span>
				<div className="header-actions">
					<button
						type="button"
						className="lang-toggle"
						onClick={() => setLang(lang === "ru" ? "en" : "ru")}
					>
						{lang === "ru" ? "EN" : "RU"}
					</button>
					{mode === "browser" && (
						<button type="button" className="lang-toggle" onClick={logout}>
							{t("logout")}
						</button>
					)}
				</div>
			</header>

			<main className="app-body">
				{tab === "dashboard" && (
					<section className="card">
						<div className="card-head">{t("admin_title")}</div>
						<div className="stat-grid">
							<div className="stat">
								<div className="stat-num">{stats?.users ?? "…"}</div>
								<div className="muted small">{t("users")}</div>
							</div>
							<div className="stat">
								<div className="stat-num">{stats?.paidOrders ?? "…"}</div>
								<div className="muted small">{t("orders")}</div>
							</div>
							<div className="stat">
								<div className="stat-num">
									{stats ? Object.entries(stats.revenue).map(([a, v]) => `${v} ${a}`).join(" · ") || "0" : "…"}
								</div>
								<div className="muted small">{t("revenue")}</div>
							</div>
						</div>
					</section>
				)}

				{tab === "orders" && (
					<section className="card">
						<div className="card-head">{t("orders")}</div>
						<div className="seg">
							{(["all", "pending", "paid", "expired"] as OrderStatus[]).map((s) => (
								<button
									key={s}
									type="button"
									className={status === s ? "seg-item active" : "seg-item"}
									onClick={() => setStatus(s)}
								>
									{s === "all" ? t("all") : s === "paid" ? t("paid") : s === "expired" ? t("expired") : t("pending")}
								</button>
							))}
						</div>
						<ul className="list">
							{orders.map((o) => (
								<li key={String(o.id)} className="list-item clickable" onClick={() => setDetail(o)}>
									<div>
										<div className="strong">
											{String(o.amount)} {assetLabel(String(o.asset))}
										</div>
										<div className="muted small mono">{String(o.memo)}</div>
									</div>
									<span className={`badge badge-${String(o.status)}`}>
										{statusText(t, String(o.status))}
									</span>
								</li>
							))}
						</ul>
					</section>
				)}

				{tab === "users" && (
					<section className="card">
						<div className="card-head">{t("users")}</div>
						<ul className="list">
							{users.map((u) => (
								<li key={String(u.telegram_id)} className="list-item">
									<div>
										<div className="strong">
											{String(u.first_name ?? "")} {String(u.last_name ?? "")}
											{u.username ? ` @${String(u.username)}` : ""}
										</div>
										<div className="muted small mono">{String(u.telegram_id)}</div>
									</div>
								</li>
							))}
						</ul>
					</section>
				)}
			</main>

			{detail && (
				<div className="modal-backdrop" onClick={() => setDetail(null)}>
					<div className="modal" onClick={(e) => e.stopPropagation()}>
						<div className="card-head">{String(detail.memo)}</div>
						<div className="kv">
							{Object.entries(detail).map(([k, v]) => (
								<div className="row" key={k}>
									<span className="muted">{k}</span>
									<span className="mono small">{v === null ? "—" : String(v)}</span>
								</div>
							))}
						</div>
						{detail.tx_hash ? (
							<a
								className="btn btn-primary"
							href={`${tvBase}/transaction/${String(detail.tx_hash)}`}
							target="_blank"
							rel="noreferrer"
						>
							{t("view_tx")}
						</a>
						) : null}
						<button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}>
							OK
						</button>
					</div>
				</div>
			)}

			<nav className="tabbar">
				<button type="button" className={tab === "dashboard" ? "tab active" : "tab"} onClick={() => setTab("dashboard")}>
					{t("admin_title")}
				</button>
				<button type="button" className={tab === "orders" ? "tab active" : "tab"} onClick={() => setTab("orders")}>
					{t("orders")}
				</button>
				<button type="button" className={tab === "users" ? "tab active" : "tab"} onClick={() => setTab("users")}>
					{t("users")}
				</button>
			</nav>
		</div>
	)
}
