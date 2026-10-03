# TON Mini App Starter

<p>
  <a href="./README.md"><b>English</b></a> ·
  <a href="./README.ru.md">Русский</a>
</p>

![License: MIT](https://img.shields.io/badge/License-MIT-informational)
![Node](https://img.shields.io/badge/Node-20%20%7C%2022%20LTS-339933?logo=node.js&logoColor=white)
![TON](https://img.shields.io/badge/TON-Mini%20App-0098EA?logo=ton&logoColor=white)

A reusable, open-source **Telegram Mini App on TON** you can clone and ship. It gives you a
secure “payments + orders” core: silent Telegram auth, TON Connect wallet flow, **TON + USDT**
payments verified **on-chain by the backend**, an order history, and an admin panel you can open
**right in your browser**.

- **Frontend:** React + TypeScript + Vite, TON Connect UI, RU/EN i18n, native Telegram theme.
- **Backend:** Node + TypeScript, Express, better-sqlite3, `@ton/ton`.
- **Single origin:** the backend serves the built frontend + API + TON Connect manifest on one
  port — one tunnel in dev, one nginx vhost in prod.

> Try it live in Telegram: **[@ton_starterbot](https://t.me/ton_starterbot)**

---

## Demo

<video src="https://raw.githubusercontent.com/Ab4kshin/ton-mini-app-starter/main/docs/media/demo.mp4" controls muted width="320"></video>

_Player not loading? [Watch / download the demo](docs/media/demo.mp4)._

## Screenshots

<p align="center">
  <b>Admin dashboard</b><br>
  <img src="docs/media/admin.png" alt="Admin dashboard" width="560">
</p>

<p align="center">
  <b>Order history</b><br>
  <img src="docs/media/history.png" alt="Order history" width="260">
</p>

---

## Features

- **Silent Telegram auth.** The client sends `initData`; the server verifies the
  `HMAC-SHA256` signature (and `auth_date` freshness) before trusting any user. No login screen.
- **TON Connect.** Connect / disconnect, show address + balances (native coin and USDT).
- **Payments (TON + USDT).** The backend issues an invoice with a **unique memo** and the exact
  expected amount, the client signs with TON Connect, and a **watcher confirms the payment
  on-chain**. The client never marks itself paid.
- **Fast confirmation.** The watcher polls **every 3 seconds** and also does an **instant re-check**
  the moment the user signs, so orders usually flip to “paid” in ~1–3s. It backs off automatically
  if the RPC errors.
- **Idempotent.** Every processed transaction is recorded; a payment can never be counted twice.
- **Order history** for each user.
- **Admin panel** — summary (users / orders / revenue), orders with a status filter + detail view
  and a **tonviewer** transaction link, and a user list. Read-only.
- **Browser admin at `/admin`.** Since the app lives inside Telegram, the admin panel opens in a
  normal browser tab at `/admin` and logs in with a **password from `.env`** (no subdomain).
- **Native feel.** Matches the user’s Telegram theme 1:1 (live), no blue tap-highlight on Android,
  a footer that stays pinned no matter how you overscroll, and haptics.
- **RU / EN.** Auto-detects from Telegram `language_code`, with a manual toggle.

---

## Project layout

```
ton-mini-app-starter/
├─ backend/            Node + TS API, TON watcher, SQLite
│  └─ src/
│     ├─ telegram/    initData verification
│     ├─ auth/        signed admin session cookie
│     ├─ middleware/  telegram auth + admin gate
│     ├─ ton/         client, jetton, payments, watcher
│     └─ routes/      auth, ton, payments, admin
├─ frontend/           React + TS + Vite Mini App (+ /admin)
├─ deploy/             nginx vhost + systemd unit examples
├─ .env.example        every setting, documented (copy to .env)
└─ manage.sh           setup / dev / ngrok / build / deploy / secrets
```

---

## Quick start (local + phone via ngrok)

```bash
./manage.sh setup      # install deps (npm workspaces) + seed .env
./manage.sh config     # prompts: BOT_TOKEN, admins, merchant, network, API key,
                       #          ADMIN_PASSWORD; auto-generates SESSION_SECRET
```

Dev with hot reload (browser only):

```bash
./manage.sh dev        # backend :8080 + Vite :5173 (proxies /api). Open :5173
```

Test on your phone inside Telegram (single origin over HTTPS):

```bash
./manage.sh ngrok                 # terminal A -> copy the https URL
./manage.sh serve                 # terminal B -> auto-detects tunnel, builds,
                                  #               points PUBLIC_URL + manifest
./manage.sh run                   # terminal B -> serves app + API at the ngrok URL
```

`serve` also sets the Telegram **menu button** to your URL via the Bot API (falls back to a
reminder to set it in @BotFather).

---

## How payment verification works (on-chain)

1. The user taps **Pay**. The client calls `POST /api/payments/invoice`.
2. The backend creates a **pending** order with a unique memo (`ord_…`) and the exact expected
   amount in base units, and returns a TON Connect transaction request:
   - **TON:** a transfer to the merchant address carrying the memo as a text comment.
   - **USDT:** a TEP-74 jetton transfer from the user’s jetton wallet to the merchant, with the
     memo in the forward payload.
3. The user signs in their wallet.
4. The **watcher** (every 3s + an instant kick right after signing) reads transactions:
   - **TON:** on the merchant address; matches the memo and checks `value >= expected`.
   - **USDT:** on the merchant’s **jetton wallet** (which guarantees the jetton is authentic),
     parses the incoming `internal_transfer` (op `0x178d4519`), matches the memo and amount.
5. On a match it flips the order `pending -> paid` with a single idempotent `UPDATE`, and records
   the transaction so it can never be counted twice. The client just polls the order status.

---

## Admin access

The admin panel is available two ways and is **always enforced server-side** (the `/admin` URL is
not a secret):

- **Browser (recommended):** open `https://<your-domain>/admin` in any browser and log in with
  `ADMIN_PASSWORD`. On success you get an **HttpOnly, Secure, SameSite** signed session cookie
  (`crypto.timingSafeEqual` password check + brute-force rate limiting). Leave `ADMIN_PASSWORD`
  empty to disable browser login entirely.
- **Inside Telegram:** users whose Telegram id is in `ADMIN_TELEGRAM_IDS` see an **Admin** tab and
  are authorized via their verified `initData` — no password needed.

---

## Security

Designed to be safe to open-source:

- **No secrets in code or git.** Everything sensitive lives in `.env`; only `.env.example` is
  committed. `.gitignore` excludes `.env`, `node_modules`, `dist`, and the SQLite db.
- **Server-only trust.** The bot token and all payment verification live on the backend. The
  client can never declare a payment successful.
- **Verified inputs.** `initData` signature + freshness, invoice amount/memo, and idempotency are
  all enforced on the server. Requests are validated with `zod`.
- **Hardening.** `helmet` CSP (allows Telegram’s script + frame ancestors), CORS allow-list,
  request-size limit, rate limiting, timing-safe comparisons, signed session cookies.
- **Before publishing:** run `./manage.sh secrets`.

```bash
./manage.sh secrets    # scans for tracked .env + token/seed-like patterns
```

---

## Deploy to a subdomain (e.g. ton-starter.mattpixel.dev)

1. **DNS.** Add an `A` record `ton-starter` -> your VPS IP (or a `CNAME`). If you use Cloudflare,
   set SSL/TLS mode to **Full (strict)**.
2. **Server prep.** Install Node ≥ 20, nginx, and certbot. Clone the repo to
   `/home/deploy/ton-mini-app-starter`.
3. **Configure.**
   ```bash
   ./manage.sh setup && ./manage.sh config
   ./manage.sh webapp https://ton-starter.mattpixel.dev   # PUBLIC_URL + manifest + menu button
   ```
4. **nginx + TLS.**
   ```bash
   sudo cp deploy/nginx.conf.example /etc/nginx/conf.d/ton-starter.conf
   sudo certbot --nginx -d ton-starter.mattpixel.dev      # issues cert + https redirect
   sudo nginx -t && sudo systemctl reload nginx
   ```
   `.dev` is on the HSTS preload list, so HTTPS is mandatory — the vhost sets an HSTS header and
   certbot auto-renews (`systemctl status certbot.timer`).
5. **Run as a service.**
   ```bash
   sudo cp deploy/ton-starter.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now ton-starter
   ./manage.sh deploy                                     # prod build + restart + menu button
   ```
6. **BotFather.** Point the Mini App / menu button at `https://ton-starter.mattpixel.dev`
   (`manage.sh` does this automatically when it has `BOT_TOKEN`). Because browser admin uses a
   password, you do **not** need `/setdomain` for a login widget.
7. **Admin.** Open `https://ton-starter.mattpixel.dev/admin` and log in with `ADMIN_PASSWORD`.

---

## Deploy with Docker

Prefer containers? The repo ships a multi-stage `Dockerfile` plus a `docker-compose.yml` that runs the app behind **Caddy**, which obtains and auto-renews HTTPS certificates for you — no nginx or certbot to configure.

**Prerequisites:** a server with Docker + Docker Compose, ports **80/443** open, and DNS `ton-starter.mattpixel.dev` → your server's IP.

```bash
git clone https://github.com/Ab4kshin/ton-mini-app-starter.git
cd ton-mini-app-starter

cp .env.example .env
# Fill BOT_TOKEN, MERCHANT_ADDRESS, ADMIN_PASSWORD, TON_API_KEY, ...
# Generate a session secret:  echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env

docker compose up -d --build
```

Caddy issues a Let's Encrypt certificate for the hostname in `deploy/Caddyfile` on first boot. The SQLite database is persisted in the `app-data` volume, so it survives rebuilds.

```bash
docker compose logs -f app     # watcher + bot logs
docker compose ps              # status
docker compose down            # stop everything

git pull && docker compose up -d --build   # update to the latest code
```

Docker doesn't run `manage.sh`, so set the Telegram menu button once (or in @BotFather → Bot Settings → Menu Button):

```bash
curl -s "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d '{"menu_button":{"type":"web_app","text":"Open App","web_app":{"url":"https://ton-starter.mattpixel.dev"}}}'
```

> Different domain? Change the hostname in `deploy/Caddyfile`, `PUBLIC_URL` in `.env`, and the URLs in `frontend/public/tonconnect-manifest.json`, then `docker compose up -d --build`.

---

## Environment

Every variable is documented in [`.env.example`](./.env.example). Key ones:

| Variable | Purpose |
| --- | --- |
| `BOT_TOKEN` | Telegram bot token (server only) |
| `ADMIN_TELEGRAM_IDS` | Telegram ids allowed into admin from inside Telegram |
| `ADMIN_PASSWORD` | Browser `/admin` password (empty = disabled) |
| `SESSION_SECRET` | Signs admin session cookies (auto-generated by `config`) |
| `MERCHANT_ADDRESS` | Wallet that receives payments |
| `JETTON_MASTER_ADDRESS` | USDT jetton master (mainnet default provided) |
| `TON_NETWORK` / `TON_API_KEY` | Network + toncenter key (raises rate limits) |
| `WATCH_INTERVAL_MS` | Watcher poll interval (default 3000) |
| `PUBLIC_URL` | Public HTTPS origin (ngrok in dev, subdomain in prod) |

---

## `manage.sh` commands

| Command | Does |
| --- | --- |
| `setup` | Install deps + seed `.env` |
| `config` | Prompt for tokens/addresses/admin password; auto-gen `SESSION_SECRET` |
| `dev` | Backend + Vite with HMR (browser) |
| `ngrok` | Expose the backend port via ngrok |
| `serve [url]` | Single-origin build; auto-detect tunnel; point `PUBLIC_URL` + manifest |
| `build` / `run` | Build everything / run the single-origin server |
| `webapp <url>` | Re-point `PUBLIC_URL` / CORS / manifest / menu button |
| `deploy` | Prod build + restart systemd + set menu button |
| `secrets` | Scan for leaked secrets before open-sourcing |

---

## Troubleshooting

**`npm install` fails building `better-sqlite3` (node-gyp / V8 errors like `no member named 'GetPrototype'`).**
You are on a too-new / non-LTS Node (e.g. 23/25/26). `better-sqlite3` only ships prebuilt binaries
for **LTS** Node, so newer versions try to compile and fail. Use Node 20 or 22:

```bash
# install nvm if you don't have it:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# then, from the project folder (an .nvmrc pins 22):
nvm install 22 && nvm use 22
rm -rf node_modules package-lock.json backend/node_modules frontend/node_modules
./manage.sh setup
```

**Build fails with a path error (`/bin/sh: .../No such file or directory`).**
The project path contains a **space** (macOS names duplicate downloads like `… 2`). `node-gyp`
can’t handle spaces — rename the folder so it has none, e.g.:

```bash
mv "ton-mini-app-starter 2" ton-mini-app-starter && cd ton-mini-app-starter
```

**`ERESOLVE` peer dependency errors.** Make sure you’re on the latest zip — `@ton/core` is pinned
to a version compatible with `@ton/ton`.

## License

MIT — see [LICENSE](./LICENSE).
