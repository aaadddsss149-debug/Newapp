import { THEME, TonConnectUIProvider } from "@tonconnect/ui-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import AdminApp from "./AdminApp"
import App from "./App"
import { I18nProvider } from "./i18n"
import "./styles.css"
import { colorScheme, ready } from "./telegram"
import { initTheme } from "./theme"

// One-time startup: Telegram ready/expand + bind theme to CSS vars.
ready()
initTheme()

const manifestUrl =
	import.meta.env.VITE_TONCONNECT_MANIFEST_URL ||
	`${window.location.origin}/tonconnect-manifest.json`

// Lightweight routing: the /admin path renders the browser admin app, everything
// else renders the Telegram Mini App. No router dependency needed.
const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin"

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<TonConnectUIProvider
			manifestUrl={manifestUrl}
			uiPreferences={{ theme: colorScheme() === "dark" ? THEME.DARK : THEME.LIGHT }}
		>
			<I18nProvider>{isAdminRoute ? <AdminApp /> : <App />}</I18nProvider>
		</TonConnectUIProvider>
	</StrictMode>,
)
