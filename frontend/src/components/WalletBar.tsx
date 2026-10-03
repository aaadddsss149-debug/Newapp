import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react"
import { useEffect, useState } from "react"
import { api } from "../api"
import { useI18n } from "../i18n"
import { haptic } from "../telegram"

function shorten(addr: string): string {
	return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

export default function WalletBar() {
	const { t } = useI18n()
	const address = useTonAddress()
	const [tonConnectUI] = useTonConnectUI()
	const [bal, setBal] = useState<{ ton: string; usdt: string } | null>(null)

	useEffect(() => {
		if (!address) {
			setBal(null)
			return
		}
		api
			.balance(address)
			.then(setBal)
			.catch(() => setBal(null))
	}, [address])

	return (
		<section className="card wallet-bar">
			<div className="card-head">{t("wallet")}</div>
			{address ? (
				<>
					<div className="row">
						<span className="muted">{t("address")}</span>
						<span className="mono">{shorten(address)}</span>
					</div>
					<div className="row">
						<span className="muted">{t("balance")}</span>
						<span className="mono">
							{bal ? `${Number(bal.ton).toFixed(3)} GRAM · ${Number(bal.usdt).toFixed(2)} USDT` : "…"}
						</span>
					</div>
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => {
							haptic("medium")
							void tonConnectUI.disconnect()
						}}
					>
						{t("disconnect")}
					</button>
				</>
			) : (
				<button
					type="button"
					className="btn btn-primary"
					onClick={() => {
						haptic("medium")
						void tonConnectUI.openModal()
					}}
				>
					{t("connect")}
				</button>
			)}
		</section>
	)
}
