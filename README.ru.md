# TON Mini App Starter

<p>
  <a href="./README.md">English</a> ·
  <a href="./README.ru.md"><b>Русский</b></a>
</p>

![License: MIT](https://img.shields.io/badge/License-MIT-informational)
![Node](https://img.shields.io/badge/Node-20%20%7C%2022%20LTS-339933?logo=node.js&logoColor=white)
![TON](https://img.shields.io/badge/TON-Mini%20App-0098EA?logo=ton&logoColor=white)

Переиспользуемый open-source **Telegram Mini App на TON**, который можно склонировать и
запустить. Даёт безопасное ядро «платежи + заказы»: тихую авторизацию через Telegram, работу
с кошельком через TON Connect, оплату **TON + USDT** с **проверкой транзакций на блокчейне
на стороне бэкенда**, историю заказов и админ-панель, которую можно открыть **прямо в браузере**.

- **Фронтенд:** React + TypeScript + Vite, TON Connect UI, i18n RU/EN, нативная тема Telegram.
- **Бэкенд:** Node + TypeScript, Express, better-sqlite3, `@ton/ton`.
- **Единый origin:** бэкенд отдаёт собранный фронтенд + API + манифест TON Connect на одном
  порту — один туннель в dev и один nginx-vhost в проде.

> Попробовать вживую в Telegram: **[@ton_starterbot](https://t.me/ton_starterbot)**

---

## Демо

<video src="https://raw.githubusercontent.com/Ab4kshin/ton-mini-app-starter/main/docs/media/demo.mp4" controls muted width="320"></video>

_Плеер не загрузился? [Посмотреть / скачать видео](docs/media/demo.mp4)._

## Скриншоты

<p align="center">
  <b>Главная страница админки</b><br>
  <img src="docs/media/admin.png" alt="Главная страница админки" width="560">
</p>

<p align="center">
  <b>История заказов</b><br>
  <img src="docs/media/history.png" alt="История заказов" width="260">
</p>

---

## Возможности

- **Тихая авторизация Telegram.** Клиент присылает `initData`; сервер проверяет подпись
  `HMAC-SHA256` (и свежесть `auth_date`) прежде чем доверять пользователю. Никакого экрана входа.
- **TON Connect.** Подключение / отключение кошелька, показ адреса и балансов (нативная монета
  и USDT).
- **Платежи (TON + USDT).** Бэкенд создаёт счёт с **уникальным memo** и точной ожидаемой суммой,
  клиент подписывает транзакцию через TON Connect, а **watcher подтверждает оплату на блокчейне**.
  Клиент никогда не помечает оплату сам.
- **Быстрое подтверждение.** Watcher опрашивает сеть **каждые 3 секунды** и делает **мгновенную
  доп-проверку** сразу после подписи, поэтому заказ обычно переходит в «оплачено» за ~1–3 c.
  При ошибках RPC включается автоматический backoff.
- **Идемпотентность.** Каждая обработанная транзакция записывается — оплату нельзя засчитать дважды.
- **История заказов** для каждого пользователя.
- **Админ-панель** — сводка (пользователи / заказы / выручка), заказы с фильтром по статусу и
  детальной карточкой + ссылкой на транзакцию в **tonviewer**, а также список пользователей.
  Только чтение.
- **Админка в браузере на `/admin`.** Т.к. приложение живёт внутри Telegram, админку можно открыть
  в обычной вкладке браузера на `/admin` и войти по **паролю из `.env`** (без отдельного
  поддомена).
- **Нативные ощущения.** Тема 1:1 совпадает с темой Telegram (в реальном времени), нет синей
  подсветки нажатий на Android, футер закреплён при любом оверскролле, есть хаптика.
- **RU / EN.** ��втоопределение по `language_code` из Telegram + ручной переключатель.

---

## Структура проекта

```
ton-mini-app-starter/
├─ backend/            Node + TS API, TON watcher, SQLite
│  └─ src/
│     ├─ telegram/    проверка initData
│     ├─ auth/        подписанная cookie админ-сессии
│     ├─ middleware/  telegram-авторизация + шлюз админки
│     ├─ ton/         client, jetton, payments, watcher
│     └─ routes/      auth, ton, payments, admin
├─ frontend/           Mini App на React + TS + Vite (+ /admin)
├─ deploy/             примеры nginx-vhost + systemd-юнита
├─ .env.example        все настройки с описанием (скопировать в .env)
└─ manage.sh           setup / dev / ngrok / build / deploy / secrets
```

---

## Быстрый старт (локально + телефон через ngrok)

> Нужен **Node 20 или 22 LTS** (см. раздел «Устранение неполадок» — на новых нечётных версиях
> Node нативный модуль `better-sqlite3` не собирается). В репозитории есть `.nvmrc` c версией 22.

```bash
./manage.sh setup      # установка зависимостей (npm workspaces) + создание .env
./manage.sh config     # спросит: BOT_TOKEN, админов, merchant, сеть, API-ключ,
                       #          ADMIN_PASSWORD; сам сгенерирует SESSION_SECRET
```

Dev с горячей перезагрузкой (только браузер):

```bash
./manage.sh dev        # backend :8080 + Vite :5173 (проксирует /api). Открой :5173
```

Тест на телефоне внутри Telegram (единый origin по HTTPS):

```bash
./manage.sh ngrok                 # терминал A -> скопируй https-URL
./manage.sh serve                 # терминал B -> сам находит туннель, собирает,
                                  #               прописывает PUBLIC_URL + манифест
./manage.sh run                   # терминал B -> отдаёт приложение + API по ngrok-URL
```

`serve` также ставит **menu button** Telegram на твой URL через Bot API (если не вышло —
напомнит выставить его в @BotFather).

---

## Как работает проверка оплаты (on-chain)

1. Пользователь жмёт **Оплатить**. Клиент вызывает `POST /api/payments/invoice`.
2. Бэкенд создаёт **pending**-заказ с уникальным memo (`ord_…`) и точной ожидаемой суммой в
   базовых единицах и возвращает запрос транзакции TON Connect:
   - **TON:** перевод на адрес мерчанта с memo в виде текстового комментария.
   - **USDT:** перевод jetton по TEP-74 с jetton-кошелька пользователя на мерчанта, memo — в
     forward payload.
3. Пользователь подписывает транзакцию в кошельке.
4. **Watcher** (каждые 3 c + мгновенный «пинок» сразу после подписи) читает транзакции:
   - **TON:** на адресе мерчанта; сверяет memo и проверяет `value >= expected`.
   - **USDT:** на **jetton-кошельке мерчанта** (это гарантирует подлинность jetton), парсит
     входящий `internal_transfer` (op `0x178d4519`), сверяет memo и сумму.
5. При совпадении за��аз переводится `pending -> paid` одним идемпотентным `UPDATE`, а транзакция
   записывается, чтобы её нельзя было засчитать дважды. Клиент просто опрашивает статус заказа.

> ⚠️ **Про USDT-парсинг:** jetton-кошелёк мерчанта *получает* сообщение `internal_transfer`
> (op `0x178d4519`), а `transfer_notification` (op `0x7362d09c`) он, наоборот, *отправляет*
> владельцу. Поэтому watcher парсит именно `internal_transfer` — иначе USDT-платежи никогда
> не подтвержд��лись бы.

---

## Доступ в админку

Админка доступна двумя способами и **всегда проверяется на сервере** (URL `/admin` — не секрет):

- **Браузер (рекомендуется):** открой `https://<твой-домен>/admin` в любом браузере и войди по
  `ADMIN_PASSWORD`. При успехе выдаётся подписанная сессионная cookie **HttpOnly, Secure,
  SameSite** (сверка пароля через `crypto.timingSafeEqual` + rate-limit от перебора). Оставь
  `ADMIN_PASSWORD` пустым, чтобы полностью отключить вход через браузер.
- **Внутри Telegram:** пользователи, чей Telegram id есть в `ADMIN_TELEGRAM_IDS`, видят вкладку
  **Admin** и авторизуются через проверенный `initData` — без пароля.

---

## Безопасность

Проект спроектирован так, чтобы его было безопасно выкладывать в open-source:

- **Никаких секретов в коде или git.** Всё чувствительное живёт в `.env`; в репозиторий попадает
  только `.env.example`. `.gitignore` исключает `.env`, `node_modules`, `dist` и базу SQLite.
- **Доверие только на сервере.** Токен бота и вся проверка оплаты — на бэкенде. Клиент не может
  объявить оплату успешной.
- **Проверенные входные данные.** Подпись + свежесть `initData`, сумма/memo счёта и идемпотентность
  проверяются на сервере. Запросы валидируются через `zod`.
- **Харднинг.** `helmet` CSP (разрешает скрипт и frame-ancestors Telegram), allow-list CORS, лимит
  размера запроса, rate-limiting, timing-safe сравнения, подписанные сессионные cookie.
- **Перед публикацией:** запусти `./manage.sh secrets`.

```bash
./manage.sh secrets    # ищет закоммиченный .env и паттерны токенов/сид-фраз
```

---

## Деплой на поддомен (например, ton-starter.mattpixel.dev)

1. **DNS.** Добавь `A`-запись `ton-starter` -> IP твоего VPS (или `CNAME`). Если используешь
   Cloudflare — режим SSL/TLS **Full (strict)**.
2. **Подготовка сервера.** Установи Node ≥ 20, nginx и certbot. Склонируй репозиторий в
   `/home/deploy/ton-mini-app-starter`.
3. **Настройка.**
   ```bash
   ./manage.sh setup && ./manage.sh config
   ./manage.sh webapp https://ton-starter.mattpixel.dev   # PUBLIC_URL + манифест + menu button
   ```
4. **nginx + TLS.**
   ```bash
   sudo cp deploy/nginx.conf.example /etc/nginx/conf.d/ton-starter.conf
   sudo certbot --nginx -d ton-starter.mattpixel.dev      # выпустит сертификат + https-редирект
   sudo nginx -t && sudo systemctl reload nginx
   ```
   `.dev` входит в список HSTS preload, поэтому HTTPS обязателен — vhost ставит заголовок HSTS,
   а certbot автопродлевает сертификат (`systemctl status certbot.timer`).
5. **Запуск как сервис.**
   ```bash
   sudo cp deploy/ton-starter.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now ton-starter
   ./manage.sh deploy                                     # прод-сборка + рестарт + menu button
   ```
6. **BotFather.** Направь Mini App / menu button на `https://ton-starter.mattpixel.dev`
   (`manage.sh` делает это сам, если есть `BOT_TOKEN`). Поскольку браузерная админка использует
   пароль, `/setdomain` для login-виджета не нужен.
7. **Админка.** Открой `https://ton-starter.mattpixel.dev/admin` и войди по `ADMIN_PASSWORD`.

---

## Деплой через Docker

Предпочитаешь контейнеры? В репозитории есть многостадийный `Dockerfile` и `docker-compose.yml`, который запускает приложение за **Caddy** — он сам получает и продлевает HTTPS-сертификаты, без ручной настройки nginx и certbot.

**Требования:** сервер с Docker + Docker Compose, открытые порты **80/443** и DNS `ton-starter.mattpixel.dev` → IP твоего сервера.

```bash
git clone https://github.com/Ab4kshin/ton-mini-app-starter.git
cd ton-mini-app-starter

cp .env.example .env
# Заполни BOT_TOKEN, MERCHANT_ADDRESS, ADMIN_PASSWORD, TON_API_KEY, ...
# Сгенерируй секрет сессии:  echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env

docker compose up -d --build
```

При первом запуске Caddy выпустит сертификат Let's Encrypt для домена из `deploy/Caddyfile`. База SQLite хранится в томе `app-data`, поэтому переживает пересборки.

```bash
docker compose logs -f app     # логи watcher + бота
docker compose ps              # статус
docker compose down            # остановить всё

git pull && docker compose up -d --build   # обновить до свежего кода
```

Docker не запускает `manage.sh`, поэтому кнопку меню Telegram задай один раз (или через @BotFather → Bot Settings → Menu Button):

```bash
curl -s "https://api.telegram.org/bot<BOT_TOKEN>/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d '{"menu_button":{"type":"web_app","text":"Open App","web_app":{"url":"https://ton-starter.mattpixel.dev"}}}'
```

> Другой домен? Поменяй хост в `deploy/Caddyfile`, `PUBLIC_URL` в `.env` и URL в `frontend/public/tonconnect-manifest.json`, затем `docker compose up -d --build`.

---

## Переменные окружения

Все переменные описаны в [`.env.example`](./.env.example). Ключевые:

| Переменная | Назначение |
| --- | --- |
| `BOT_TOKEN` | Токен Telegram-бота (только сервер) |
| `ADMIN_TELEGRAM_IDS` | Telegram id, кому разрешён вход в админку из Telegram |
| `ADMIN_PASSWORD` | Пароль браузерной `/admin` (пусто = выключено) |
| `SESSION_SECRET` | Подписывает cookie админ-сессии (генерируется в `config`) |
| `MERCHANT_ADDRESS` | Кошелёк, принимающий платежи |
| `JETTON_MASTER_ADDRESS` | Мастер USDT-jetton (по умолчанию mainnet) |
| `TON_NETWORK` / `TON_API_KEY` | Сеть + ключ toncenter (повышает лимиты) |
| `WATCH_INTERVAL_MS` | Интервал опроса watcher (по умолчанию 3000) |
| `PUBLIC_URL` | Публичный HTTPS origin (ngrok в dev, поддомен в проде) |

---

## Команды `manage.sh`

| Команда | Что делает |
| --- | --- |
| `setup` | Установка зависимостей + создание `.env` |
| `config` | Запрос токенов/адресов/пароля админа; автогенерация `SESSION_SECRET` |
| `dev` | Backend + Vite с HMR (браузер) |
| `ngrok` | Публикует порт бэкенда через ngrok |
| `serve [url]` | Сборка single-origin; автопоиск туннеля; прописывает `PUBLIC_URL` + манифест |
| `build` / `run` | Собрать всё / запустить single-origin сервер |
| `webapp <url>` | Переставить `PUBLIC_URL` / CORS / манифест / menu button |
| `deploy` | Прод-сборка + рестарт systemd + установка menu button |
| `secrets` | Проверка на утечки секретов перед публикацией |

---

## Устранение неполадок

**`npm install` падает на сборке `better-sqlite3` (node-gyp / ошибки V8 вроде `no member named
'GetPrototype'`).** Ты на слишком новой / не-LTS версии Node (например, 23/25/26). `better-sqlite3`
поставляет готовые бинарники только для **LTS** Node, поэтому новые версии пытаются ко��пилировать
и падают. Используй Node 20 или 22:

```bash
# установи nvm, если его нет:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# затем из папки проекта (.nvmrc фиксирует 22):
nvm install 22 && nvm use 22
rm -rf node_modules package-lock.json backend/node_modules frontend/node_modules
./manage.sh setup
```

**Сборка падает с ошибкой п��ти (`/bin/sh: .../No such file or directory`).** В пути к проекту есть
**пробел** (macOS называет дубликаты загрузок как `… 2`). `node-gyp` не умеет пробелы — переименуй
папку, убрав их:

```bash
mv "ton-mini-app-starter 2" ton-mini-app-starter && cd ton-mini-app-starter
```

**Ошибки peer-зависимостей `ERESOLVE`.** Убедись, что у тебя свежий zip — `@ton/core` зафиксирован
на версии, совместимой с `@ton/ton`.

**`command not found: nvm`.** Открой новый терминал или выполни `source ~/.zshrc` (`source
~/.bashrc`) после установки nvm.

**USDT не подтверждается, а TON подтверждается.** Убедись, что используешь свежую версию —
watcher парсит `internal_transfer` (op `0x178d4519`) на jetton-кошельке мерчанта. Также помогает
задать `TON_API_KEY` (без него у toncenter низкий лимит запросов).

## Лицензия

MIT — см. [LICENSE](./LICENSE).
