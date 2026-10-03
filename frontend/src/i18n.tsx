import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react"
import { getLanguageCode } from "./telegram"

type Lang = "ru" | "en"

const en = {
	app_title: "TON Mini App Starter",
	tab_pay: "Pay",
	tab_history: "History",
	tab_admin: "Admin",
	wallet: "Wallet",
	connect: "Connect wallet",
	disconnect: "Disconnect",
	address: "Address",
	balance: "Balance",
	pay_title: "Payment",
	amount: "Amount",
	pay: "Pay",
	paying: "Waiting for payment…",
	paid: "Paid ✅",
	pending: "Pending",
	expired: "Expired",
	connect_first: "Connect your wallet to pay",
	history_title: "Your orders",
	no_orders: "No orders yet",
	admin_title: "Admin",
	users: "Users",
	orders: "Orders",
	revenue: "Revenue",
	all: "All",
	view_tx: "View transaction",
	view_tx_short: "Transaction",
	paid_desc: "Payment received and confirmed",
	login: "Log in",
	password: "Password",
	logout: "Log out",
	login_error: "Wrong password",
	admin_login_title: "Admin access",
	no_access: "No access",
}

type Dict = typeof en

const ru: Dict = {
	app_title: "TON Mini App Starter",
	tab_pay: "Оплата",
	tab_history: "История",
	tab_admin: "Админка",
	wallet: "Кошелёк",
	connect: "Подключить кошелёк",
	disconnect: "Отключить",
	address: "Адрес",
	balance: "Баланс",
	pay_title: "Оплата",
	amount: "Сумма",
	pay: "Оплатить",
	paying: "Ожидаем платёж…",
	paid: "Оплачено ✅",
	pending: "Ожидание",
	expired: "Истёк",
	connect_first: "Подключите кошелёк для оплаты",
	history_title: "Ваши заказы",
	no_orders: "Заказов пока нет",
	admin_title: "Админка",
	users: "Пользователи",
	orders: "Заказы",
	revenue: "Выручка",
	all: "Все",
	view_tx: "Смотреть транзакцию",
	view_tx_short: "Транзакция",
	paid_desc: "Платёж получен и подтверждён",
	login: "Войти",
	password: "Пароль",
	logout: "Выйти",
	login_error: "Неверный пароль",
	admin_login_title: "Доступ в админку",
	no_access: "Нет доступа",
}

const dicts: Record<Lang, Dict> = { en, ru }

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof Dict) => string }
const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
	const [lang, setLang] = useState<Lang>(() => {
		try {
			const saved = localStorage.getItem("lang")
			if (saved === "ru" || saved === "en") return saved
		} catch {
			/* ignore */
		}
		return getLanguageCode().startsWith("ru") ? "ru" : "en"
	})

	useEffect(() => {
		try {
			localStorage.setItem("lang", lang)
		} catch {
			/* ignore */
		}
	}, [lang])

	const value = useMemo<Ctx>(
		() => ({ lang, setLang, t: (k) => dicts[lang][k] ?? dicts.en[k] ?? String(k) }),
		[lang],
	)
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
	const c = useContext(I18nContext)
	if (!c) throw new Error("useI18n must be used within I18nProvider")
	return c
}

// Localize an order status string.
export function statusText(t: (k: keyof Dict) => string, status: string): string {
	return status === "paid" ? t("paid") : status === "expired" ? t("expired") : t("pending")
}

// UI ticker for an asset (GRAM since the 2026 rebrand; asset code stays "TON").
export function assetLabel(asset: string): string {
	return asset === "TON" ? "GRAM" : asset
}
