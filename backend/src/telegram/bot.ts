// Minimal Telegram Bot API client with long-polling.
// Handles /start (welcome + "Open app" web_app button) and sends localized
// payment-received notifications. Server-only: uses BOT_TOKEN, never the client.
import { config } from "../config.js"
import { type OrderRow } from "../db.js"
import { logger } from "../logger.js"

const API = `https://api.telegram.org/bot` + config.BOT_TOKEN

// Bot messages are intentionally bilingual (RU + EN in one message) so the same
// notification is readable regardless of the user's Telegram language.
const SEP = "\n\u2014\u2014\u2014\n"

const M = {
	welcome: (name: string) =>
		`Привет, ${name}! 👋\nЭто демо Telegram Mini App на TON: оплата в <b>TON</b> и <b>USDT</b>, история заказов и админка. Нажми кнопку ниже, чтобы открыть приложение.` +
		SEP +
		`Hi, ${name}! 👋\nThis is a TON Telegram Mini App demo: pay with <b>TON</b> and <b>USDT</b>, order history and an admin panel. Tap the button below to open the app.`,
	open: "🚀 Открыть / Open",
	paid: (amount: string, asset: string) =>
		`✅ <b>Оплата получена!</b>\nСумма: <b>${amount} ${asset}</b>\nЗаказ подтверждён. Спасибо!` +
		SEP +
		`✅ <b>Payment received!</b>\nAmount: <b>${amount} ${asset}</b>\nYour order is confirmed. Thank you!`,
	viewTx: "🔎 Транзакция / Transaction",
}

type InlineKeyboard = { inline_keyboard: Array<Array<Record<string, unknown>>> }

async function call(method: string, body: unknown): Promise<{ ok: boolean; result?: unknown }> {
	const res = await fetch(`${API}/${method}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
	return (await res.json()) as { ok: boolean; result?: unknown }
}

export async function sendMessage(
	chatId: number | string,
	text: string,
	replyMarkup?: InlineKeyboard,
): Promise<void> {
	try {
		await call("sendMessage", {
			chat_id: chatId,
			text,
			parse_mode: "HTML",
			disable_web_page_preview: true,
			reply_markup: replyMarkup,
		})
	} catch (e) {
		logger.warn("sendMessage failed", (e as Error).message)
	}
}

function webAppButton(): InlineKeyboard | undefined {
	// web_app buttons require an https URL (ngrok in dev, your domain in prod).
	if (config.PUBLIC_URL && config.PUBLIC_URL.startsWith("https://")) {
		return { inline_keyboard: [[{ text: M.open, web_app: { url: config.PUBLIC_URL } }]] }
	}
	return undefined
}

// Called by the watcher right after an order flips pending -> paid.
export async function notifyPaid(order: OrderRow): Promise<void> {
	try {
		const reply: InlineKeyboard | undefined = order.tx_hash
			? {
					inline_keyboard: [
						[{ text: M.viewTx, url: `${config.tonviewerBase}/transaction/${order.tx_hash}` }],
					],
				}
			: undefined
		await sendMessage(order.telegram_id, M.paid(order.amount, order.asset), reply)
	} catch (e) {
		logger.warn("notifyPaid failed", (e as Error).message)
	}
}

type TgUpdate = {
	update_id: number
	message?: {
		text?: string
		chat: { id: number }
		from?: { first_name?: string; language_code?: string }
	}
}

let polling = false
let offset = 0

export function startBot(): void {
	if (polling) return
	if (!config.botPolling) {
		logger.info("bot polling disabled (BOT_POLLING=false)")
		return
	}
	polling = true
	logger.info("bot polling started")
	void poll()
}

export function stopBot(): void {
	polling = false
}

async function poll(): Promise<void> {
	while (polling) {
		try {
			const r = await call("getUpdates", {
				offset,
				timeout: 30,
				allowed_updates: ["message"],
			})
			if (r.ok && Array.isArray(r.result)) {
				for (const upd of r.result as TgUpdate[]) {
					offset = upd.update_id + 1
					await handleUpdate(upd)
				}
			}
		} catch (e) {
			logger.warn("getUpdates error", (e as Error).message)
			await new Promise((res) => setTimeout(res, 3000))
		}
	}
}

async function handleUpdate(upd: TgUpdate): Promise<void> {
	const msg = upd.message
	if (!msg || !msg.text) return
	const text = msg.text.trim()
	if (text === "/start" || text.startsWith("/start ")) {
		const name = msg.from?.first_name || "there"
		await sendMessage(msg.chat.id, M.welcome(name), webAppButton())
	}
}
