#!/usr/bin/env bash
# =====================================================================
#  TON Mini App Starter — one management script (single-origin).
#  Backend serves the built frontend + API + TON Connect manifest on ONE
#  port, so you only ever need ONE tunnel (dev) or ONE nginx vhost (prod).
#  Secrets live only in .env (never committed).
#
#  Usage: ./manage.sh <command> [args]   (run ./manage.sh help)
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
ENV_FILE="$ROOT/.env"
NGROK_API="http://127.0.0.1:4040/api/tunnels"

c_blue="\033[1;34m"; c_grn="\033[1;32m"; c_yel="\033[1;33m"; c_red="\033[1;31m"; c_off="\033[0m"
say()  { echo -e "${c_blue}\u25b8${c_off} $*"; }
ok()   { echo -e "${c_grn}\u2714${c_off} $*"; }
warn() { echo -e "${c_yel}\u26a0${c_off} $*"; }
die()  { echo -e "${c_red}\u2716${c_off} $*" >&2; exit 1; }

# --- env helpers -----------------------------------------------------------
ask() { local prompt="$1" def="${2:-}" ans; if [ -n "$def" ]; then read -r -p "$prompt [$def]: " ans || true; echo "${ans:-$def}"; else read -r -p "$prompt: " ans || true; echo "$ans"; fi; }

ensure_env() { if [ ! -f "$ENV_FILE" ] && [ -f "$ROOT/.env.example" ]; then cp "$ROOT/.env.example" "$ENV_FILE"; ok "created .env from .env.example"; fi; }

set_env_var() {
  local key="$1" val="$2"; touch "$ENV_FILE"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import re, sys
f, k, v = sys.argv[1], sys.argv[2], sys.argv[3]
t = open(f, encoding="utf-8").read()
t = re.sub(rf"(?m)^{re.escape(k)}=.*$", f"{k}={v}", t)
open(f, "w", encoding="utf-8").write(t)
PY
  else printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"; fi
}
read_env_var() { local key="$1"; [ -f "$ENV_FILE" ] || return 0; grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2-; }

detect_ngrok_url() {
  curl -s "$NGROK_API" 2>/dev/null | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  print(next((t['public_url'] for t in d.get('tunnels',[]) if t.get('public_url','').startswith('https')), ''))
except Exception:
  print('')" 2>/dev/null || true
}

set_menu_button() {  # point the Telegram menu button at the Mini App
  local url="$1" token payload
  token="$(read_env_var BOT_TOKEN)"
  [ -n "$token" ] || { warn "No BOT_TOKEN yet; skipping menu button."; return 0; }
  say "Setting Telegram menu button via Bot API"
  payload="{\"menu_button\":{\"type\":\"web_app\",\"text\":\"Open App\",\"web_app\":{\"url\":\"$url\"}}}"
  if curl -sf "https://api.telegram.org/bot${token}/setChatMenuButton" -H 'Content-Type: application/json' -d "$payload" >/dev/null; then
    ok "Menu button now opens $url"
  else
    warn "Could not set menu button automatically (set it in @BotFather)."
  fi
}

write_manifest() {  # (re)generate the TON Connect manifest with absolute HTTPS URLs
  local url="${1%/}"
  local out="$FRONTEND/public/tonconnect-manifest.json"
  python3 - "$out" "$url" <<'PY'
import json, sys
out, url = sys.argv[1], sys.argv[2]
json.dump({
  "url": url,
  "name": "TON Mini App Starter",
  "iconUrl": f"{url}/icon-192.png",
  "termsOfUseUrl": url,
  "privacyPolicyUrl": url,
}, open(out, "w", encoding="utf-8"), indent=2)
PY
  ok "Wrote TON Connect manifest -> $url"
}

point_public_url() {  # write PUBLIC_URL + CORS + VITE manifest, regen manifest, set menu button
  local url="${1%/}"
  ensure_env
  set_env_var PUBLIC_URL "$url"
  set_env_var CORS_ORIGINS "$url"
  set_env_var VITE_TONCONNECT_MANIFEST_URL "$url/tonconnect-manifest.json"
  write_manifest "$url"
  ok "PUBLIC_URL / CORS / manifest set to $url"
  set_menu_button "$url"
}

# --- commands --------------------------------------------------------------
check_node() {
  # better-sqlite3 ships prebuilt binaries for LTS Node (18/20/22). On brand-new
  # odd releases (23/25/26...) there are no prebuilds yet, so npm tries to compile
  # the native addon and fails against the changed V8 API. Steer users to LTS.
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$major" -lt 18 ] || [ "$major" -ge 23 ]; then
    warn "You are on Node $(node -v). This project needs an LTS release (20 or 22)."
    warn "On newer/odd Node versions native modules (better-sqlite3) fail to build."
    warn "Fix with nvm:  nvm install 22 && nvm use 22   (an .nvmrc pins 22 for you)"
    die  "Aborting before install. Switch to Node 20/22 and retry ./manage.sh setup"
  fi
}

check_path() {
  # node-gyp / native builds break when the project path contains spaces.
  case "$ROOT" in
    *\ *) warn "Project path contains a space:"
          warn "  $ROOT"
          die  "Rename the folder to remove spaces (e.g. 'ton-mini-app-starter'), then retry." ;;
  esac
}

cmd_setup() {
  command -v node >/dev/null 2>&1 || die "node not found (need Node 20 or 22 LTS)"
  check_node
  check_path
  ensure_env
  say "Installing dependencies (npm workspaces)"
  ( cd "$ROOT" && npm install )
  ok "Dependencies installed"
  echo; ok "Next: ./manage.sh config"
}

cmd_config() {
  ensure_env
  say "Interactive config (Enter keeps current value)"
  local token admins merchant apikey network
  token="$(ask 'BOT_TOKEN from @BotFather' "$(read_env_var BOT_TOKEN)")";       [ -n "$token" ] || die "BOT_TOKEN required"; set_env_var BOT_TOKEN "$token"
  admins="$(ask 'ADMIN_TELEGRAM_IDS (comma-separated)' "$(read_env_var ADMIN_TELEGRAM_IDS)")"; set_env_var ADMIN_TELEGRAM_IDS "$admins"
  merchant="$(ask 'MERCHANT_ADDRESS (receives payments)' "$(read_env_var MERCHANT_ADDRESS)")"; set_env_var MERCHANT_ADDRESS "$merchant"
  network="$(ask 'TON_NETWORK (mainnet/testnet)' "$(read_env_var TON_NETWORK)")"; set_env_var TON_NETWORK "$network"; set_env_var VITE_TON_NETWORK "$network"
  apikey="$(ask 'TON_API_KEY (toncenter, optional)' "$(read_env_var TON_API_KEY)")"; set_env_var TON_API_KEY "$apikey"

  # Browser admin (/admin) password + signed-cookie secret.
  local adminpw
  adminpw="$(ask 'ADMIN_PASSWORD for browser /admin (empty = disable)' "$(read_env_var ADMIN_PASSWORD)")"; set_env_var ADMIN_PASSWORD "$adminpw"
  ensure_session_secret
  ok "Wrote config to .env"
}

# Generate a strong SESSION_SECRET if it is missing or still the placeholder.
ensure_session_secret() {
  local cur; cur="$(read_env_var SESSION_SECRET)"
  if [ -z "$cur" ] || [ "$cur" = "change_me_to_a_long_random_secret" ]; then
    local secret; secret="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))' 2>/dev/null || openssl rand -hex 32)"
    set_env_var SESSION_SECRET "$secret"
    ok "Generated a random SESSION_SECRET"
  fi
}

cmd_dev() {
  # Local dev: backend on PORT, Vite on 5173 proxying /api to it. HMR on.
  ensure_env
  [ -d "$ROOT/node_modules" ] || cmd_setup
  mkdir -p "$ROOT/.logs"
  trap 'kill 0 2>/dev/null || true' EXIT INT TERM
  local port; port="$(read_env_var PORT)"; port="${port:-8080}"
  say "Starting backend on http://localhost:$port"
  ( cd "$BACKEND" && npm run dev > "$ROOT/.logs/backend.log" 2>&1 ) &
  for _ in $(seq 1 40); do curl -sf "http://localhost:$port/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
  ok "Backend is up (logs: .logs/backend.log)"
  say "Starting Vite dev server on http://localhost:5173"
  ( cd "$FRONTEND" && npm run dev > "$ROOT/.logs/frontend.log" 2>&1 ) &
  ok "Open http://localhost:5173 (Ctrl+C to stop). Tailing logs:"
  tail -f "$ROOT/.logs/backend.log" "$ROOT/.logs/frontend.log"
}

cmd_ngrok() {
  command -v ngrok >/dev/null 2>&1 || die "ngrok not installed (https://ngrok.com/download)"
  local port; port="$(read_env_var PORT)"; port="${port:-8080}"
  warn "For a phone test the app must be single-origin. Run in another terminal: ./manage.sh serve"
  say "Tunneling backend :$port via ngrok (copy the https URL below)"
  exec ngrok http "$port"
}

cmd_serve() {
  # SINGLE-ORIGIN dev: build the frontend, point PUBLIC_URL at the ngrok tunnel,
  # then the backend serves the built app + API on one https origin.
  ensure_env
  local url="${1:-}"
  if [ -z "$url" ]; then say "Auto-detecting ngrok tunnel..."; url="$(detect_ngrok_url)"; fi
  [ -n "$url" ] || die "No public URL. Start ./manage.sh ngrok first, or pass one: ./manage.sh serve https://xxxx.ngrok-free.app"
  point_public_url "$url"
  cmd_build
  ok "Built. Now run: ./manage.sh run   (serves the app at $url)"
}

cmd_build() {
  ensure_env
  [ -d "$ROOT/node_modules" ] || cmd_setup
  say "Building backend (tsc) + frontend (vite)"
  ( cd "$BACKEND" && npm run build )
  ( cd "$FRONTEND" && npm run build )
  [ -f "$FRONTEND/dist/index.html" ] || die "Frontend build produced no dist/index.html"
  ok "Build complete (backend/dist + frontend/dist)"
}

cmd_run() {
  ensure_env
  [ -f "$BACKEND/dist/index.js" ] || die "No backend build. Run ./manage.sh build first."
  [ -f "$FRONTEND/dist/index.html" ] || warn "No frontend build; running API-only."
  local port; port="$(read_env_var PORT)"; port="${port:-8080}"
  say "Starting single-origin server on :$port"
  ( cd "$BACKEND" && npm run start )
}

cmd_webapp() { local url="${1:-}"; [ -n "$url" ] || die "Usage: ./manage.sh webapp https://your.url"; point_public_url "$url"; ok "Re-point done. Rebuild if the manifest URL changed: ./manage.sh build"; }

cmd_deploy() {
  # Production build on the server, then (re)start the systemd service.
  ensure_env
  local url; url="$(read_env_var PUBLIC_URL)"
  say "Production deploy for $url"
  set_env_var NODE_ENV production
  cmd_build
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^ton-starter.service'; then
    say "Restarting systemd service ton-starter"
    sudo systemctl restart ton-starter && ok "Service restarted"
  else
    warn "systemd unit 'ton-starter' not installed. See deploy/ton-starter.service and README §Deploy."
    ok "Build is ready. Start with: ./manage.sh run (or install the systemd unit)."
  fi
  set_menu_button "$url"
}

cmd_secrets() {
  # Pre-open-source safety net: catch secrets before they reach git.
  say "Scanning for secrets / accidental commits"
  local bad=0
  if git -C "$ROOT" rev-parse >/dev/null 2>&1; then
    if git -C "$ROOT" ls-files --error-unmatch .env >/dev/null 2>&1; then
      warn ".env is tracked by git! Run: git rm --cached .env"; bad=1
    else ok ".env is not tracked by git"; fi
  fi
  say "Grepping tracked/text files for token-like patterns"
  # Telegram bot token, common private-key/seed markers.
  if grep -RInE '([0-9]{8,10}:[A-Za-z0-9_-]{35})|(BEGIN [A-Z ]*PRIVATE KEY)|(seed[_ ]?phrase)|(mnemonic)' \
       --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude='*.example' "$ROOT" ; then
    warn "Potential secret(s) above — review before publishing!"; bad=1
  else ok "No obvious secrets found"; fi
  [ "$bad" -eq 0 ] && ok "Looks clean. Still review 'git status' before pushing." || die "Fix the findings above before publishing."
}

cmd_help() {
  cat <<'EOF'
TON Mini App Starter - management script (single-origin)

Usage: ./manage.sh <command> [args]

  setup            Install deps (npm workspaces) + seed .env
  config           Prompt for BOT_TOKEN, admins, merchant, network, API key
  dev              Local dev: backend + Vite (HMR) at http://localhost:5173
  ngrok            Expose the backend port via ngrok (terminal A)
  serve [url]      Single-origin dev build; auto-detects ngrok, points PUBLIC_URL
  build            Build backend (tsc) + frontend (vite)
  run              Run the single-origin server (serves app + API + manifest)
  webapp <url>     Re-point PUBLIC_URL / CORS / manifest / menu button
  deploy           Prod build + restart systemd service + set menu button
  secrets          Scan for leaked secrets before open-sourcing
  help             Show this help

Dev flow (phone via ngrok, single-origin):
  ./manage.sh setup && ./manage.sh config
  ./manage.sh ngrok                 # terminal A -> copy https URL
  ./manage.sh serve                 # terminal B (auto-detects tunnel + builds)
  ./manage.sh run                   # terminal B (serves app at the ngrok URL)
  # set that ngrok URL as the Mini App URL in @BotFather (done automatically too)

Prod flow (subdomain):
  # point DNS + nginx + certbot (see README), then on the server:
  ./manage.sh webapp https://ton-starter.mattpixel.dev
  ./manage.sh deploy
EOF
}

main() {
  local cmd="${1:-help}"; shift || true
  case "$cmd" in
    setup)   cmd_setup "$@" ;;
    config)  cmd_config "$@" ;;
    dev)     cmd_dev "$@" ;;
    ngrok)   cmd_ngrok "$@" ;;
    serve)   cmd_serve "$@" ;;
    build)   cmd_build "$@" ;;
    run)     cmd_run "$@" ;;
    webapp|miniapp) cmd_webapp "$@" ;;
    deploy)  cmd_deploy "$@" ;;
    secrets|scan) cmd_secrets "$@" ;;
    help|-h|--help) cmd_help ;;
    *) warn "Unknown command: $cmd"; cmd_help; exit 1 ;;
  esac
}
main "$@"
