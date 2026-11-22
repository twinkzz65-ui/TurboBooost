# telegram_src
Исходники клиента Telegram для Android (DrKLO/Telegram, GPLv2): `org/telegram/ui`, `messenger`, `tgnet`, `SQLite`, `PhoneFormat`.
Лежат СПРАВОЧНО и в сборку APK не входят (vexiss — WebView, а эти классы требуют полное ядро Telegram и MTProto).
Используйте как образец вёрстки/анимаций при переносе экранов в интерфейс Vexis.

Обновить/пересобрать набор: `python tools/pack_telegram.py --parts gifts profile` (скачивает официальный репозиторий,
собирает подарки+маркет и оформление/настройки профиля вместе с иконками и анимациями).
