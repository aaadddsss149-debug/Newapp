import { useEffect, useState } from "react"
import { api, type PublicOrder } from "../api"
import { txUrl } from "../explorer"
import { assetLabel, statusText, useI18n } from "../i18n"

export default function OrderHistory() {
	const { t } = useI18n()
	const [orders, setOrders] = useState<PublicOrder[] | null>(null)

	useEffect(() => {
		api
			.myOrders()
			.then((r) => setOrders(r.orders))
			.catch(() => setOrders([]))
	}, [])

	return (
		<section className="card">
			<div className="card-head">{t("history_title")}</div>
			{!orders && <div className="muted">…</div>}
			{orders && orders.length === 0 && <div className="muted">{t("no_orders")}</div>}
			<ul className="list">
				{orders?.map((o) => (
					<li key={o.id} className="list-item">
						<div>
							<div className="strong">
								{o.amount} {assetLabel(o.asset)}
							</div>
							<div className="muted small">{new Date(o.createdAt).toLocaleString()}</div>
						</div>
						<div className="item-actions">
							{o.status === "paid" && o.txHash && (
								<a
									className="tx-chip"
									href={txUrl(o.txHash)}
									target="_blank"
									rel="noreferrer"
									onClick={(e) => e.stopPropagation()}
								>
									{t("view_tx_short")}
								</a>
							)}
							<span className={`badge badge-${o.status}`}>{statusText(t, o.status)}</span>
						</div>
					</li>
				))}
			</ul>
		</section>
	)
}
