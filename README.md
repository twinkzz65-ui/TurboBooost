# Vexis

- `server.py` — сервер (Render, Docker). `bot_token.py` — токен бота. `admin_panel.py` — локальная админ-панель.
- `android/` — Android-приложение (APK). Интерфейс, `res/` и `gifts/` лежат внутри APK, API — на сервере Render.
- `res/` — звуки и ресурсы Telegram, `gifts/` — картинки подарков (кладите файлы сюда и пушьте).

## Один раз настроить
1. Render: Web Service из репозитория (Docker, Free). Environment: `BOT_TOKEN`, `ADMIN_KEY`, `ADMIN_IDS`, `PUBLIC_URL`.
2. GitHub → Settings → Secrets and variables → Actions:
   - Secret `RENDER_DEPLOY_HOOK` — Deploy Hook из Render;
   - **Variable** `SERVER_URL` — `https://<имя>.onrender.com` (его вшивает в APK).
3. Push в `main`: `deploy.yml` обновляет сервер, `android.yml` собирает `Vexis.apk`
   (Actions → Artifacts, либо Releases → «latest»).

Локально: `SERVER_URL=https://... python tools/prepare_web.py && gradle -p android assembleRelease`.

## Westside Sign (добавлено)

Коллекция `westsidesign` — 50 моделей из westsidesign_models.zip.

- PNG: `gifts/westsidesign/<Название>.png`
- Lottie: `gifts/westsidesign/anim/<Название>.json`
- При выдаче и выпуске на маркет: случайные модель + фон + узор (по номеру).

Команды:
```
/nft_give westsidesign @user
/nft_give westsidesign @user #номер
/nftmarket_mint westsidesign 20 100
```
Тираж: 5000.
