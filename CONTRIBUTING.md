# Contributing / Как внести вклад

Thanks for your interest! / Спасибо за интерес к проекту!

## English

### Prerequisites

- **Node 20 or 22 LTS** (an `.nvmrc` pins 22). Newer/odd Node versions can't build
  `better-sqlite3` — see the README Troubleshooting section.

### Getting started

```bash
nvm use            # picks up .nvmrc (22)
./manage.sh setup  # install deps + seed .env
./manage.sh config # fill in BOT_TOKEN, merchant, etc.
./manage.sh dev    # backend + Vite with HMR
```

### Before opening a PR

1. Make sure it builds & typechecks: `npm run build`.
2. Keep the diff focused; match the existing code style (tabs, TypeScript).
3. **Never commit secrets.** Only `.env.example` is committed. Run `./manage.sh secrets`
   before pushing.
4. If you touch payment verification, describe how you tested it (testnet is fine).

### Reporting bugs

Open an issue with steps to reproduce, expected vs. actual behavior, your Node version
(`node -v`), OS, and `TON_NETWORK`. Redact any tokens/addresses you don't want public.

---

## Русский

### Требования

- **Node 20 или 22 LTS** (в `.nvmrc` зафиксирована 22). На новых/нечётных версиях Node
  `better-sqlite3` не собирается — см. раздел «Устранение неполадок» в README.

### Начало работы

```bash
nvm use            # берёт версию из .nvmrc (22)
./manage.sh setup  # установка зависимостей + создание .env
./manage.sh config # заполни BOT_TOKEN, merchant и т.д.
./manage.sh dev    # backend + Vite с HMR
```

### Перед созданием PR

1. Проверь сборку и типы: `npm run build`.
2. Держи изменения сфокусированными; соблюдай текущий стиль (табы, TypeScript).
3. **Никогда не коммить секреты.** В репозиторий попадает только `.env.example`. Перед push
   запусти `./manage.sh secrets`.
4. Если меняешь проверку оплаты — опиши, как тестировал (testnet подойдёт).

### Сообщения об ошибках

Создай issue с шагами воспроизведения, ожидаемым и фактическим поведением, версией Node
(`node -v`), ОС и `TON_NETWORK`. Скрой токены/адреса, которые не хочешь публиковать.
