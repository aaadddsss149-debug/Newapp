import { Address, fromNano } from "@ton/core"
import { Router } from "express"
import { config } from "../config.js"
import { requireTelegramAuth } from "../middleware/auth.js"
import { tonClient } from "../ton/client.js"
import { getJettonWalletAddress } from "../ton/jetton.js"

const router = Router()

router.get("/config", requireTelegramAuth, (_req, res) => {
	res.json({
		network: config.TON_NETWORK,
		merchant: config.MERCHANT_ADDRESS,
		jettonMaster: config.JETTON_MASTER_ADDRESS,
		jettonDecimals: config.JETTON_DECIMALS,
		jettonSymbol: "USDT",
	})
})

// Balances are read on the SERVER (client never needs an API key).
router.get("/balance", requireTelegramAuth, async (req, res) => {
	const address = String(req.query.address || "")
	if (!address) {
		res.status(400).json({ error: "address required" })
		return
	}
	try {
		const owner = Address.parse(address)
		const tonBal = await tonClient.getBalance(owner)
		let usdt = "0"
		try {
			const master = Address.parse(config.JETTON_MASTER_ADDRESS)
			const jw = await getJettonWalletAddress(master, owner)
			const r = await tonClient.runMethod(jw, "get_wallet_data", [])
			const raw = r.stack.readBigNumber()
			usdt = (Number(raw) / 10 ** config.JETTON_DECIMALS).toString()
		} catch {
			/* no jetton wallet yet => 0 */
		}
		res.json({ ton: fromNano(tonBal), usdt })
	} catch {
		res.status(400).json({ error: "invalid address" })
	}
})

export default router
