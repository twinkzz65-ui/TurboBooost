GodGram — сборка через GitHub Actions
=====================================

Исходный проект: ASP.NET Core 8 + PostgreSQL + CSS + JavaScript.
Открывается по /app, файла index.html нет.

Как получить exe через GitHub:
1. Распакуй архив GodGram_GitHub_Actions.zip на компьютере.
2. Создай пустой репозиторий на GitHub.
3. Загрузи именно СОДЕРЖИМОЕ папки GodGram_GitHub_Actions в корень репозитория:
   .github/workflows/build.yml, GodGram.csproj, Api/, Data/, Database/, wwwroot/, ...
   Важно: если .github окажется внутри лишней вложенной папки,
   GitHub не обнаружит workflow.
4. Открой Actions → Build GodGram (.NET 8) → Run workflow.
   Также workflow запускается при push в ветки main и master.
5. Дождись зелёного результата в Actions. Внизу, в Artifacts, появятся:
   GodGram-Windows-x64 и GodGram-Linux-x64.
6. Скачай GodGram-Windows-x64, распакуй оба уровня ZIP и запусти run-built.bat.
   Внутри — GodGram.exe, web-файлы и схема базы.

Работа после сборки:
- Отдельно запусти PostgreSQL 15+ (например, Docker Desktop и docker compose up -d db).
- При необходимости установи переменные окружения GODGRAM_DB и GODGRAM_OWNER_PHONE.
- Открой http://127.0.0.1:8080/app.
- Self-contained сборка Windows содержит .NET runtime; .NET SDK на твоём компьютере не требуется.
- Сам PostgreSQL не упакован в exe: он обязателен при старте.

Внимание:
- GitHub Actions использует временный PostgreSQL 16 только при проверках, в реальном приложении
  данные находятся в твоей постоянной PostgreSQL-базе.
- GODGRAM_DEV_CODES=1 позволяет входить с кодом, показываемым на экране и в консоли.
  Только для локальной разработки; НЕ публикуй так сервер в интернете.
- Конфигурации и секреты не добавляй в GitHub.
- Проект — частичный перенос gg.py; торговля NFT, платежи и часть ботов пока не реализованы.
- При красном статусе в Actions открой шаг Compile release или Smoke test и посмотри ошибку.
- GitHub Actions не является круглосуточным хостингом приложения.


Мобильные приложения: APK (Android) и IPA (iOS)
===============================================

Тот же workflow (Actions → Build GodGram → Run workflow) теперь собирает ещё два файла.
В Artifacts появятся:
  GodGram-Android-APK        -> GodGram.apk
  GodGram-iOS-IPA-unsigned   -> GodGram-unsigned.ipa

Как это устроено: приложение (папка mobile/, Capacitor) содержит веб-интерфейс из wwwroot,
а данные берёт с вашего сервера GodGram. Сервер (Windows/Linux) должен быть запущен и доступен
телефону: по интернету (лучше https) или по Wi-Fi (http://192.168.x.x:8080).

Адрес сервера:
- При первом запуске приложение спросит адрес сервера. Сменить: Настройки -> Прочее -> Сервер.
- Чтобы адрес был вшит заранее: GitHub -> Settings -> Secrets and variables -> Actions -> Variables ->
  New repository variable: GODGRAM_SERVER_URL = https://ваш-сервер

Android:
- Скачай GodGram.apk, открой на телефоне, разреши установку из неизвестных источников.
- Без секретов APK подписывается временным ключом, и каждая новая сборка ставится как "другое" приложение.
  Для обновлений поверх задай Secrets: ANDROID_KEYSTORE_BASE64 (base64 от .jks), ANDROID_KEYSTORE_PASSWORD,
  ANDROID_KEY_ALIAS (пароль ключа = пароль хранилища).

iOS:
- IPA собирается БЕЗ подписи (подпись требует платный аккаунт Apple Developer, на GitHub его нет).
- Установка на свой iPhone: AltStore / Sideloadly (подпишут твоим бесплатным Apple ID, действует 7 дней)
  или TrollStore, если он поддерживается твоей версией iOS.
- Для App Store/TestFlight нужен аккаунт Apple Developer: подпись добавляется отдельным шагом.
- Сборка идёт на macOS-раннере GitHub; для приватных репозиториев минуты macOS тарифицируются х10.

Локально (по желанию): cd mobile && npm install && node scripts/prepare-web.mjs && npx cap add android


Python-сервер (без .NET и PostgreSQL) — godgram_server.py
=========================================================

Тот же API и тот же интерфейс, но на чистом Python (только стандартная библиотека) и SQLite.
Подходит для Windows, Linux, macOS и Termux на телефоне.

  Termux:   pkg install python  ->  sh start-python.sh
  Windows:  start-python.bat (нужен установленный Python 3.9+)
  Любая ОС: python godgram_server.py --lan

Нужна папка wwwroot рядом с godgram_server.py. База создаётся сама: godgram.sqlite3 рядом со скриптом.
- Открыть: http://127.0.0.1:8080/app. Для APK/IPA и других устройств: адрес из строки "По Wi-Fi" в консоли.
- Код входа показывается на экране и в консоли (SMS нет). Не выставляй сервер в интернет в таком режиме.
- Админ: python godgram_server.py --admin 79001234567 (номер уже зарегистрированного пользователя)
  или GODGRAM_OWNER_PHONE=номер до регистрации. Админ может удалять аккаунты (становятся "Удалённый аккаунт").
- Порт: --port 9000. Файл базы: --db путь. Лог запросов: GODGRAM_LOG=1.
- Не перенесено (как и в C#-версии): фото в историях, отправка медиа, платежи/NFT-операции, боты.

Коды входа в Telegram-бота
--------------------------
1. В Telegram открой @BotFather -> /newbot -> получи токен.
2. Запусти: python godgram_server.py --lan --bot-token ТОКЕН   (или переменная GODGRAM_BOT_TOKEN)
3. Каждый пользователь ОДИН раз: открывает бота, жмёт Start и "Поделиться номером" (Telegram сам подтверждает,
   что номер его). Дальше коды для этого номера приходят ему в бота.
- Бот не может написать первым, поэтому привязка номера обязательна. Номер, не привязанный к боту, получит подсказку.
- С ботом код на экране больше не показывается (GODGRAM_DEV_CODES=1 вернёт показ для тестов).
- Серверу нужен выход в интернет к api.telegram.org. Если Telegram у тебя заблокирован: VPN на устройстве
  с сервером или прокси/зеркало Bot API через --tg-api https://адрес.
