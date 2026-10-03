import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Env is read from the repo root (single shared .env). Vite only exposes VITE_* vars.
export default defineConfig({
	plugins: [react()],
	envDir: path.resolve(__dirname, ".."),
	server: {
		host: true,
		// Allow ngrok / tunnel hosts during development.
		allowedHosts: true,
		proxy: {
			"/api": { target: "http://localhost:8080", changeOrigin: true },
		},
	},
	build: { outDir: "dist", sourcemap: false },
})
