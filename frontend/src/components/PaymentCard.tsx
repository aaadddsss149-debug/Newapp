import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react"
import { useEffect, useRef, useState } from "react"
import { api, type PublicOrder } from "../api"
import { txUrl } from "../explorer"
import { assetLabel, useI18n } from "../i18n"
import { haptic } from "../telegram"

type Asset = "TON" | "USDT"

export default function PaymentCard() {
	const { t } = useI18n()
	const address = useTonAddress()
	const [tonConnectUI] = useTonConnectUI()
	const [asset, setAsset] = useState<Asset>("USDT")
	const [amount, setAmount] = useState("1")
	const [order, setOrder] = useState<PublicOrder | null>(null)
	const [busy, setBusy] = useState(false)
	const [err, setErr] = useState<string | null>(null)
	const pollRef = useRef<number | null>(null)

	// Poll the order status until it leaves "pending". The backend watcher does
	// the real on-chain verification; the client only reads status.
	useEffect(() => {
		if (!order || order.status !== "pending") {
			if (pollRef.current) window.clearInterval(pollRef.current)
			return
		}
		pollRef.current = window.setInterval(async () => {
			try {
				const { order: fresh } = await api.order(order.id)
				setOrder(fresh)
				if (fresh.status === "paid") haptic("success")
			} catch {
				/* ignore transient errors */
			}
		}, 4000)
		return () => {
			if (pollRef.current) window.clearInterval(pollRef.current)
		}
	}, [order])

	async function pay() {
		if (!address) return
		setErr(null)
		setBusy(true)
		try {
			const { order: created, tx } = await api.createInvoice(asset, amount, address)
			setOrder(created)
			await tonConnectUI.sendTransaction({
				validUntil: tx.validUntil,
				messages: tx.messages,
			})
			haptic("medium")
			// Instant "kick": ask the backend to scan right now instead of waiting.
			try {
				const { order: checked } = await api.checkOrder(created.id)
				setOrder(checked)
			} catch {
				/* watcher will still catch it */
			}
		} catch (e) {
			setErr((e as Error).message)
			haptic("error")
		} finally {
			setBusy(false)
		}
	}

	const paid = order?.status === "paid"
	const pendingLabel = order
		? order.status === "expired"
			? t("expired")
			: t("paying")
		: null

	return (
		<section className="card">
			<div className="card-head">{t("pay_title")}</div>

			<div className="seg">
				<button
					type="button"
					className={asset === "USDT" ? "seg-item active" : "seg-item"}
					onClick={() => {
						haptic("light")
						setAsset("USDT")
					}}
				>
					USDT
				</button>
				<button
					type="button"
					className={asset === "TON" ? "seg-item active" : "seg-item"}
					onClick={() => {
						haptic("light")
						setAsset("TON")
					}}
				>
					{assetLabel("TON")}
				</button>
			</div>

			<label className="field">
				<span className="muted">{t("amount")}</span>
				<input
					inputMode="decimal"
					value={amount}
					onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
				/>
			</label>

			{err && <div className="notice error">{err}</div>}

			{paid ? (
				<div className="pay-success">
					<div className="checkmark">✓</div>
					<div className="strong">{t("paid")}</div>
					<div className="muted small">{t("paid_desc")}</div>
					{order?.txHash && (
						<a
							className="btn btn-secondary tx-link"
							href={txUrl(order.txHash)}
							target="_blank"
							rel="noreferrer"
						>
							{t("view_tx")}
						</a>
					)}
				</div>
			) : (
				pendingLabel && (
					<div className={`status status-${order?.status}`}>{pendingLabel}</div>
				)
			)}

			{address ? (
				<button
					type="button"
					className="btn btn-primary"
					disabled={busy || !amount || Number(amount) <= 0}
					onClick={pay}
				>
					{busy ? "…" : `${t("pay")} ${amount} ${assetLabel(asset)}`}
				</button>
			) : (
				<div className="notice">{t("connect_first")}</div>
			)}
		</section>
	)
}
