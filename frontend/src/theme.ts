import { colorScheme, onThemeChanged, themeParams } from "./telegram"

// Map Telegram themeParams -> our CSS variables so the app matches the user's
// Telegram colors 1:1 and reacts live to theme changes.
const MAP: Record<string, string> = {
	bg_color: "--tg-bg",
	secondary_bg_color: "--tg-secondary-bg",
	text_color: "--tg-text",
	hint_color: "--tg-hint",
	link_color: "--tg-link",
	button_color: "--tg-button",
	button_text_color: "--tg-button-text",
	header_bg_color: "--tg-header-bg",
	accent_text_color: "--tg-accent",
	destructive_text_color: "--tg-destructive",
}

export function applyTheme(): void {
	const params = themeParams()
	const root = document.documentElement
	for (const [key, cssVar] of Object.entries(MAP)) {
		const value = params[key]
		if (value) root.style.setProperty(cssVar, value)
	}
	const scheme = colorScheme()
	root.dataset.theme = scheme
	root.style.colorScheme = scheme
}

export function initTheme(): void {
	applyTheme()
	onThemeChanged(applyTheme)
}
