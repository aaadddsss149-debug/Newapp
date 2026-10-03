import { TonClient } from "@ton/ton"
import { config } from "../config.js"

// Single shared toncenter client. Provide TON_API_KEY to raise rate limits.
export const tonClient = new TonClient({
	endpoint: config.tonApiEndpoint,
	apiKey: config.TON_API_KEY || undefined,
})
