export type TonNetwork = "mainnet" | "testnet"

export type NetworkEndpoints = {
	rpc: string
	explorer: string
}

// Public per-network endpoints. RPC is overridable per-deploy via TON_API_ENDPOINT.
export const NETWORKS: Record<TonNetwork, NetworkEndpoints> = {
	mainnet: {
		// aislop-ignore-next-line ai-slop/hardcoded-url -- public default RPC; override per-deploy via TON_API_ENDPOINT
		rpc: "https://toncenter.com/api/v2/jsonRPC",
		explorer: "https://tonviewer.com",
	},
	testnet: {
		// aislop-ignore-next-line ai-slop/hardcoded-url -- public default testnet RPC; override per-deploy via TON_API_ENDPOINT
		rpc: "https://testnet.toncenter.com/api/v2/jsonRPC",
		explorer: "https://testnet.tonviewer.com",
	},
}
