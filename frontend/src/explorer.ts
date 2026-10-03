// Block-explorer links (tonviewer). Network is picked from the build-time env
// VITE_TON_NETWORK so the client needs no API call to build a tx link.
const NET = (import.meta.env.VITE_TON_NETWORK as string) === "testnet" ? "testnet" : "mainnet"

const BASE: Record<string, string> = {
	mainnet: "https://tonviewer.com",
	testnet: "https://testnet.tonviewer.com",
}

export const tonviewerBase = BASE[NET]

export function txUrl(hash: string): string {
	return `${tonviewerBase}/transaction/${hash}`
}
