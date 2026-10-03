/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE?: string
	readonly VITE_TON_NETWORK?: string
	readonly VITE_TONCONNECT_MANIFEST_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

interface Window {
	// Telegram WebApp SDK global (typed loosely; see @twa-dev/sdk for full types)
	Telegram?: {
		WebApp?: any
	}
}
