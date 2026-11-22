#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Токен Telegram-бота — отдельно от server.py.

Откуда берётся токен (по приоритету):
  1) переменная окружения BOT_TOKEN   (так на Render)
  2) локальный файл bot_token.local   (так на вашем компьютере; он в .gitignore и в Git не попадает)

Команды:
  python bot_token.py set <ТОКЕН>   проверить токен через Telegram и сохранить в bot_token.local
  python bot_token.py check         проверить текущий токен (getMe)
  python bot_token.py show          показать токен в замаскированном виде
  python bot_token.py clear         удалить bot_token.local
"""
import json
import os
import re
import sys
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = os.path.join(BASE, "bot_token.local")
_RE = re.compile(r"^\d{5,19}:[A-Za-z0-9_-]{30,}$")


def get_token():
    t = (os.environ.get("BOT_TOKEN") or "").strip()
    if t:
        return t
    try:
        with open(TOKEN_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def mask(t):
    return (t[:6] + "…" + t[-4:]) if len(t) > 12 else ("(пусто)" if not t else "***")


def get_me(token):
    """Возвращает (ok, описание)."""
    if not _RE.match(token or ""):
        return False, "Токен выглядит неправильно (формат 123456:ABC…)"
    try:
        with urllib.request.urlopen("https://api.telegram.org/bot%s/getMe" % token, timeout=15) as r:
            d = json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa
        return False, "Не удалось связаться с Telegram: %s" % e
    if d.get("ok"):
        return True, "@%s (id %s)" % (d["result"].get("username"), d["result"].get("id"))
    return False, d.get("description", "Telegram отклонил токен")


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "check"
    if cmd == "set":
        if len(argv) < 3:
            print("Использование: python bot_token.py set <ТОКЕН>")
            return 1
        tok = argv[2].strip()
        ok, info = get_me(tok)
        if not ok:
            print("✗", info)
            return 1
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            f.write(tok)
        try:
            os.chmod(TOKEN_FILE, 0o600)
        except OSError:
            pass
        print("✓ Токен сохранён в bot_token.local — бот", info)
        return 0
    if cmd == "clear":
        try:
            os.remove(TOKEN_FILE)
            print("bot_token.local удалён")
        except OSError:
            print("Файла нет")
        return 0
    tok = get_token()
    if cmd == "show":
        print(mask(tok))
        return 0
    if cmd == "check":
        if not tok:
            print("Токен не задан: python bot_token.py set <ТОКЕН>  или переменная BOT_TOKEN")
            return 1
        ok, info = get_me(tok)
        print(("✓ " if ok else "✗ ") + info)
        return 0 if ok else 1
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
