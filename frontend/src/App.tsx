import { THEME, useTonConnectUI } from "@tonconnect/ui-react"
import { useEffect, useState } from "react"
import OrderHistory from "./components/OrderHistory"
import PaymentCard from "./components/PaymentCard"
import WalletBar from "./components/WalletBar"
import { api, type Me } from "./api"
import { useI18n } from "./i18n"
import { colorScheme, haptic, isTelegram, onThemeChanged } from "./telegram"

type Tab = "pay" | "history"

function TabButton({
	id,
	label,
	active,
	onSelect,
}: {
	id: Tab
	label: string
	active: boolean
	onSelect: (id: Tab) => void
}) {
	return (
		<button
			type="button"
			className={active ? "tab active" : "tab"}
			onClick={() => {
				haptic("light")
				onSelect(id)
			}}
		>
			{label}
		</button>
	)
}

export default function App() {
	const { t, lang, setLang } = useI18n()
	const [, setTonUiOptions] = useTonConnectUI()
	const [tab, setTab] = useState<Tab>("pay")
	const [me, setMe] = useState<Me | null>(null)
	const [err, setErr] = useState<string | null>(null)

	useEffect(() => {
		if (!isTelegram()) return
		api
			.me()
			.then(setMe)
			.catch((e) => setErr(e.message))
	}, [])

	// Keep the TON Connect widget (wallet modal/button) in sync with the
	// Telegram theme: without this it renders light-on-light in dark mode.
	useEffect(() => {
		const sync = () =>
			setTonUiOptions({
				uiPreferences: { theme: colorScheme() === "dark" ? THEME.DARK : THEME.LIGHT },
			})
		sync()
		onThemeChanged(sync)
	}, [setTonUiOptions])

	return (
		<div className="app">
			<header className="app-header">
				<span className="app-title">{t("app_title")}</span>
				<button
					type="button"
					className="lang-toggle"
					onClick={() => {
						haptic("light")
						setLang(lang === "ru" ? "en" : "ru")
					}}
				>
					{lang === "ru" ? "EN" : "RU"}
				</button>
			</header>

			<main className="app-body">
				{!isTelegram() && (
					<div className="notice">
						Open this app inside Telegram to sign in. For the admin panel go to
						<code> /admin</code>.
					</div>
				)}
				{err && <div className="notice error">{err}</div>}
				<WalletBar />
				{tab === "pay" && <PaymentCard />}
				{tab === "history" && <OrderHistory />}
			</main>

			<nav className="tabbar">
				<TabButton id="pay" label={t("tab_pay")} active={tab === "pay"} onSelect={setTab} />
				<TabButton
					id="history"
					label={t("tab_history")}
					active={tab === "history"}
					onSelect={setTab}
				/>
				{me?.isAdmin && (
					<a className="tab" href="/admin" target="_blank" rel="noreferrer">
						{t("tab_admin")}
					</a>
				)}
			</nav>
		</div>
	)
}
