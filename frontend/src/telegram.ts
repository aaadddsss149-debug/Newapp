// Telegram WebApp SDK wrapper with browser-safe fallbacks.

type HapticKind = "light" | "medium" | "heavy" | "success" | "error" | "warning"

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined

export function isTelegram(): boolean {
	return !!tg && !!tg.initData
}

export function getInitData(): string {
	return tg?.initData || ""
}

export function getUnsafeUser(): unknown {
	return tg?.initDataUnsafe?.user
}

export function getLanguageCode(): string {
	const fromTg = tg?.initDataUnsafe?.user?.language_code
	if (fromTg) return fromTg
	if (typeof navigator !== "undefined") return navigator.language.slice(0, 2)
	return "en"
}

// Called once at startup: mark ready, expand to full height, lock vertical
// swipes so overscroll can't drag/close the app.
export function ready(): void {
	try {
		tg?.ready?.()
		tg?.expand?.()
		tg?.disableVerticalSwipes?.()
	} catch {
		/* not in Telegram */
	}
}

export function haptic(kind: HapticKind = "light"): void {
	try {
		const h = tg?.HapticFeedback
		if (!h) return
		if (kind === "success" || kind === "error" || kind === "warning") h.notificationOccurred(kind)
		else h.impactOccurred(kind)
	} catch {
		/* ignore */
	}
}

export function onThemeChanged(cb: () => void): void {
	try {
		tg?.onEvent?.("themeChanged", cb)
	} catch {
		/* ignore */
	}
}

export function colorScheme(): "light" | "dark" {
	return tg?.colorScheme === "dark" ? "dark" : "light"
}

export function themeParams(): Record<string, string> {
	return tg?.themeParams || {}
}

export { tg }
