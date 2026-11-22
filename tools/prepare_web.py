#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Готовит ассеты Android-приложения (запускается перед сборкой, в GitHub Actions и локально):
  * достаёт интерфейс INDEX_HTML из server.py -> android/app/src/main/assets/index.html
    (адрес API подставляется из SERVER_URL — приложение ходит на ваш сервер на Render)
  * копирует папки res/ и gifts/ внутрь APK (assets/res, assets/gifts)

Использование:  SERVER_URL=https://vexis-e6d8.onrender.com python tools/prepare_web.py
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "android", "app", "src", "main", "assets")
START, END = "INDEX_HTML = r'''", "</html>'''"
API_DECL = "const API = '';"
DEFAULT_URL = "https://vexis-e6d8.onrender.com"  # тот же, что по умолчанию в android/app/build.gradle


def main():
    url = (os.environ.get("SERVER_URL") or (sys.argv[1] if len(sys.argv) > 1 else "") or DEFAULT_URL).strip().rstrip("/")
    if not url.startswith("https://"):
        sys.exit("SERVER_URL должен начинаться с https:// (сейчас: %r)" % url)
    if url == DEFAULT_URL and not os.environ.get("SERVER_URL"):
        print("SERVER_URL не задан — используется адрес по умолчанию: " + DEFAULT_URL)
    src = open(os.path.join(ROOT, "server.py"), encoding="utf-8").read()
    a = src.index(START) + len(START)
    b = src.index(END, a) + len("</html>")
    html = src[a:b]
    if html.count(API_DECL) != 1:
        sys.exit("В интерфейсе не нашлось '%s' — обновите tools/prepare_web.py" % API_DECL)
    html = html.replace(API_DECL, "const API = %r;" % url)
    shutil.rmtree(ASSETS, ignore_errors=True)
    os.makedirs(ASSETS)
    with open(os.path.join(ASSETS, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    for d in ("res", "gifts"):
        s, t = os.path.join(ROOT, d), os.path.join(ASSETS, d)
        os.makedirs(t, exist_ok=True)
        n = 0
        for dp, dn, fns in os.walk(s):
            dn[:] = [x for x in dn if not x.startswith(".")]
            for fn in fns:
                if fn.startswith("."):
                    continue
                rel = os.path.relpath(os.path.join(dp, fn), s)
                os.makedirs(os.path.dirname(os.path.join(t, rel)), exist_ok=True)
                shutil.copy2(os.path.join(dp, fn), os.path.join(t, rel))
                n += 1
        print("%s/: %d файлов" % (d, n))
    print("index.html: %d КБ, сервер: %s" % (len(html) // 1024, url))


if __name__ == "__main__":
    main()
