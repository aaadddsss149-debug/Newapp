import { useEffect, useState } from "react"
import AdminLogin from "./components/AdminLogin"
import AdminPanel from "./components/AdminPanel"
import { api } from "./api"
import { useI18n } from "./i18n"
import { isTelegram } from "./telegram"

// Browser admin entry (opened at /admin in a normal browser tab).
// Auth model:
//  - In a browser: password login -> signed session cookie.
//  - Inside Telegram: allow-listed initData grants access automatically.
export default function AdminApp() {
	const { t } = useI18n()
	const [authed, setAuthed] = useState<boolean | null>(null)
	const [browserLoginEnabled, setBrowserLoginEnabled] = useState(true)

	async function check() {
		try {
			await api.adminMe()
			setAuthed(true)
		} catch {
			setAuthed(false)
		}
	}

	useEffect(() => {
		check()
	}, [])

	if (authed === null) {
		return (
			<div className="app admin">
				<div className="muted center">…</div>
			</div>
		)
	}

	if (!authed) {
		// If inside Telegram but not allow-listed, there's no password screen to show.
		if (isTelegram()) {
			return (
				<div className="app admin">
					<div className="notice error center">{t("no_access")}</div>
				</div>
			)
		}
		return (
			<AdminLogin
				enabled={browserLoginEnabled}
				onEnabledResolved={setBrowserLoginEnabled}
				onSuccess={() => setAuthed(true)}
			/>
		)
	}

	return <AdminPanel mode={isTelegram() ? "telegram" : "browser"} onLogout={() => setAuthed(false)} />
}
