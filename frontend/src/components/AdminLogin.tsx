import { useEffect, useState } from "react"
import { api } from "../api"
import { useI18n } from "../i18n"

export default function AdminLogin({
	enabled,
	onEnabledResolved,
	onSuccess,
}: {
	enabled: boolean
	onEnabledResolved: (v: boolean) => void
	onSuccess: () => void
}) {
	const { t } = useI18n()
	const [password, setPassword] = useState("")
	const [err, setErr] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	// Discover whether browser password login is enabled at all (ADMIN_PASSWORD set).
	useEffect(() => {
		api
			.adminMe()
			.then(() => onSuccess())
			.catch(() => {
				/* not logged in yet */
			})
	}, [])

	async function submit(e: React.FormEvent) {
		e.preventDefault()
		setErr(null)
		setBusy(true)
		try {
			await api.adminLogin(password)
			onSuccess()
		} catch (e2) {
			const msg = (e2 as Error).message
			if (msg.includes("disabled")) onEnabledResolved(false)
			setErr(t("login_error"))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="app admin">
			<div className="login-wrap">
				<form className="card login-card" onSubmit={submit}>
					<div className="card-head">{t("admin_login_title")}</div>
					{!enabled && <div className="notice error">browser admin login disabled</div>}
					<label className="field">
						<span className="muted">{t("password")}</span>
						<input
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</label>
					{err && <div className="notice error">{err}</div>}
					<button type="submit" className="btn btn-primary" disabled={busy || !password}>
						{busy ? "…" : t("login")}
					</button>
				</form>
			</div>
		</div>
	)
}
