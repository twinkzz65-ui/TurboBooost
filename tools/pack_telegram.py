#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pack_telegram.py — собирает архив из официального открытого исходника Telegram для Android
(https://github.com/DrKLO/Telegram): иконки, Lottie-анимации, экраны (UI) и логику клиента.

Запуск (нужен интернет, Python 3.8+; git необязателен):
    python pack_telegram.py                    # всё сразу  -> telegram_pack.zip
    python pack_telegram.py --parts gifts      # ТОЛЬКО подарки и маркет подарков -> telegram_pack.zip
    python pack_telegram.py --parts profile    # ТОЛЬКО оформление и настройки профиля
    python pack_telegram.py --parts gifts profile --out gifts_profile.zip   # обе части в одном архиве
    python pack_telegram.py --parts gifts --depth 2 --out gifts.zip
    python pack_telegram.py --src ./Telegram --parts gifts   # из уже скачанной копии

Части (--parts):
    res         иконки (drawable*), анимации (raw/*.json, anim, interpolator), макеты, цвета, строки, звуки, assets
    ui          Java-экраны и виджеты  (org/telegram/ui)
    mechanics   логика клиента: messenger (чаты, сообщения, медиа, настройки) + tgnet (MTProto) + SQLite
    gifts       подарки: маркет (перепродажа), аукционы, коллекционные подарки, отправка/получение,
                профиль с подарками, Stars-подарки, крафт, оферы — Java-экраны и логика + ТОЛЬКО те иконки,
                анимации, макеты и строки, на которые они ссылаются; плюс весь tgnet (схема TL-методов)
    profile     оформление и настройки профиля: ProfileActivity, SettingsActivity, цвета профиля и имени (PeerColor),
                эмодзи-статус, обои и темы (ThemeActivity, Theme.java, .attheme), смена имени/юзернейма/био,
                приватность, уведомления, данные и память, аватар-конструктор, истории и подарки в профиле —
                Java + ТОЛЬКО нужные иконки/анимации/макеты/строки/стили + файлы тем (.attheme) + весь tgnet
    all         res + ui + mechanics (по умолчанию; gifts и profile входят в них, отдельно не нужны)

--depth N (для gifts и profile, по умолчанию 1): сколько «слоёв» зависимостей тянуть от файлов подарков.
    0 — только сами файлы подарков; 1 — + классы, которые они используют напрямую (рекомендуется);
    2 — ещё глубже (почти половина клиента).

ВАЖНО:
  * Код Telegram для Android распространяется под GPLv2. Если вы публикуете приложение на его основе,
    его исходный код тоже должен быть открыт под GPL. Название и логотип Telegram — товарные знаки.
  * Для работы настоящего клиента нужны свои api_id/api_hash (my.telegram.org) и совместимый сервер.
  * Архив — это исходники для изучения/переноса, а не готовое приложение: куски UI зависят
    друг от друга и от messenger/tgnet, поэтому переносите их вместе.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

REPO = "https://github.com/DrKLO/Telegram"
ZIP_URL = "https://codeload.github.com/DrKLO/Telegram/zip/refs/heads/master"
MAIN = "TMessagesProj/src/main"
JAVA = MAIN + "/java"
RES = MAIN + "/res"

PARTS = {
    "res": [MAIN + "/res", MAIN + "/assets"],
    "ui": [MAIN + "/java/org/telegram/ui"],
    "mechanics": [MAIN + "/java/org/telegram/messenger",
                  MAIN + "/java/org/telegram/tgnet",
                  MAIN + "/java/org/telegram/SQLite",
                  MAIN + "/java/org/telegram/PhoneFormat"],
}
ALL_PARTS = ["res", "ui", "mechanics"]
EXTRA_FILES = ["LICENSE", "README.md"]

# ── «подарки»: какие файлы считаем ядром (по имени), и что берём вместе с ними ──
GIFT_SEED_RE = re.compile(r"gift|resale|collectible|auction|craft", re.I)
PROFILE_SEED_RE = re.compile(
    r"^(Profile\w*|\w*Settings\w*|\w*PeerColor\w*|\w*EmojiStatus\w*|Change(Name|Bio|Username|PhoneNumber)\w*|"
    r"\w*Appearance\w*|AvatarConstructor\w*|\w*Theme\w*|\w*Wallpaper\w*|\w*Privacy\w*|Theme)$", re.I)
SEEDS = {"gifts": GIFT_SEED_RE, "profile": PROFILE_SEED_RE}
PROFILE_ASSET_GLOBS = (".attheme",)                          # файлы тем из assets
GIFT_ALWAYS_DIRS = [JAVA + "/org/telegram/tgnet"]          # схема TL (payments.*StarGift*, resale и т.д.)
FILE_RES_TYPES = ("drawable", "mipmap", "raw", "layout", "anim", "xml", "interpolator", "menu", "font", "animator")
R_REF = re.compile(r"\bR\.(%s)\.(\w+)" % "|".join(FILE_RES_TYPES + ("string", "color", "dimen", "style", "id", "array", "plurals", "attr", "integer", "bool")))
XML_REF = re.compile(r"@(%s)/(\w+)" % "|".join(FILE_RES_TYPES))
IMPORT_RE = re.compile(r"^import\s+(?:static\s+)?(org\.telegram\.[\w.]+?)(\.\*)?;", re.M)


def log(*a):
    print(*a, flush=True)


def fetch_with_git(dest):
    if not shutil.which("git"):
        return False
    log("Скачиваю через git (shallow clone)…")
    r = subprocess.run(["git", "clone", "--depth", "1", REPO, dest])
    return r.returncode == 0


def fetch_with_zip(dest):
    log("Скачиваю ZIP с GitHub (может занять несколько минут)…")
    tmp = dest + ".zip"
    with urllib.request.urlopen(ZIP_URL, timeout=120) as r, open(tmp, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        got = 0
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
            got += len(b)
            if total:
                print("\r  %d / %d МБ" % (got >> 20, total >> 20), end="", flush=True)
    print()
    with zipfile.ZipFile(tmp) as z:
        top = z.namelist()[0].split("/")[0]
        z.extractall(os.path.dirname(dest))
    os.replace(os.path.join(os.path.dirname(dest), top), dest)
    os.remove(tmp)
    return True


def get_source(src_arg, workdir):
    if src_arg:
        if not os.path.isdir(os.path.join(src_arg, MAIN)):
            sys.exit("В %s не найден %s — это не копия репозитория Telegram." % (src_arg, MAIN))
        return src_arg
    dest = os.path.join(workdir, "Telegram")
    if fetch_with_git(dest) or fetch_with_zip(dest):
        return dest
    sys.exit("Не удалось скачать исходники. Проверьте интернет или скачайте репозиторий вручную и укажите --src.")


def walk_files(base):
    for dp, dn, fn in os.walk(base):
        dn.sort()
        for f in sorted(fn):
            yield os.path.join(dp, f)


# ───────────────────────── подарки: Java-зависимости ─────────────────────────
def seed_closure(src, depth, seed_re):
    jroot = os.path.join(src, JAVA)
    idx, pkgs = {}, {}
    for p in walk_files(jroot):
        if p.endswith(".java"):
            fq = os.path.relpath(p, jroot)[:-5].replace(os.sep, ".")
            idx[fq] = p
            pkg, _, cls = fq.rpartition(".")
            pkgs.setdefault(pkg, {})[cls] = p
    cache = {}

    def deps(p):
        if p in cache:
            return cache[p]
        t = open(p, encoding="utf-8", errors="ignore").read()
        out, toks = set(), set(re.findall(r"\b[A-Z]\w*\b", t))
        scan = [os.path.relpath(p, jroot)[:-5].replace(os.sep, ".").rpartition(".")[0]]
        for m in IMPORT_RE.finditer(t):
            name, wild = m.group(1), m.group(2)
            if wild:
                scan.append(name)
                continue
            parts = name.split(".")
            while parts and ".".join(parts) not in idx:
                parts.pop()
            if parts:
                out.add(idx[".".join(parts)])
        for pk in scan:
            for c, fp in pkgs.get(pk, {}).items():
                if c in toks and fp != p:
                    out.add(fp)
        cache[p] = out
        return out

    seeds = {p for p in idx.values()
             if seed_re.search(os.path.splitext(os.path.basename(p))[0]) and ("/ui/" in p.replace(os.sep, "/") or "/messenger/" in p.replace(os.sep, "/"))}
    seen, frontier = set(seeds), set(seeds)
    for _ in range(depth):
        nxt = set()
        for p in frontier:
            nxt |= deps(p) - seen
        seen |= nxt
        frontier = nxt
    for d in GIFT_ALWAYS_DIRS:
        seen.update(p for p in walk_files(os.path.join(src, d)) if p.endswith(".java"))
    return sorted(seen), sorted(seeds)


# ───────────────────────── подарки: ресурсы, на которые ссылается код ─────────────────────────
def feature_res(src, java_files):
    rroot = os.path.join(src, RES)
    by_name = {}      # (тип, имя) -> [пути]
    value_files = []  # values*/…xml целиком (строки, цвета, размеры, стили)
    for p in walk_files(rroot):
        d = os.path.relpath(p, rroot).split(os.sep)[0]
        typ = d.split("-")[0]
        if typ == "values":
            value_files.append(p)
        elif typ in FILE_RES_TYPES:
            by_name.setdefault((typ, os.path.splitext(os.path.basename(p))[0].split(".")[0]), []).append(p)
    need, picked = set(), set()
    for jf in java_files:
        t = open(jf, encoding="utf-8", errors="ignore").read()
        for m in R_REF.finditer(t):
            need.add((m.group(1), m.group(2)))
    queue = list(need)
    done = set()
    while queue:                                   # ресурсы, на которые ссылаются XML-ресурсы (layer-list, selector…)
        key = queue.pop()
        if key in done:
            continue
        done.add(key)
        for p in by_name.get(key, []):
            picked.add(p)
            if p.endswith(".xml"):
                t = open(p, encoding="utf-8", errors="ignore").read()
                for m in XML_REF.finditer(t):
                    k = (m.group(1), m.group(2))
                    if k not in done:
                        queue.append(k)
    missing = sorted(k for k in done if k[0] in FILE_RES_TYPES and k not in by_name)
    return sorted(picked), value_files, missing


# ───────────────────────── упаковка ─────────────────────────
def pack(src, parts, out, depth):
    files, notes = [], []
    seen = set()

    def add(p):
        if p not in seen:
            seen.add(p)
            files.append(p)

    for part in [p for p in parts if p in PARTS]:
        for rel in PARTS[part]:
            base = os.path.join(src, rel)
            if not os.path.isdir(base):
                log("  пропущено (нет в репозитории):", rel)
                continue
            n0 = len(files)
            for p in walk_files(base):
                add(p)
            log("  + %-52s %6d файлов" % (rel, len(files) - n0))

    for feat in [p for p in parts if p in SEEDS]:
        jf, seeds = seed_closure(src, depth, SEEDS[feat])
        log("  + %s: %d файлов ядра, всего Java с зависимостями (depth=%d): %d" % (feat, len(seeds), depth, len(jf)))
        rf, vals, missing = feature_res(src, jf)
        log("  + %s: ресурсов (иконки/анимации/макеты): %d, файлов values (строки/цвета): %d" % (feat, len(rf), len(vals)))
        extra = []
        if feat == "profile":
            ad = os.path.join(src, MAIN, "assets")
            extra = [p for p in walk_files(ad) if p.endswith(PROFILE_ASSET_GLOBS)] if os.path.isdir(ad) else []
            log("  + profile: файлов тем (.attheme): %d" % len(extra))
        for p in jf + rf + vals + extra:
            add(p)
        if missing:
            notes.append("[%s] не найдены в res (возможно, из другого модуля): %s" % (feat, ", ".join("%s/%s" % k for k in missing[:40])))
        notes.append("[%s] ядро (%d файлов):\n  " % (feat, len(seeds)) + "\n  ".join(
            sorted(os.path.relpath(p, os.path.join(src, JAVA)) for p in seeds)))

    n = size = 0
    t0 = time.time()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for rel in EXTRA_FILES:
            fp = os.path.join(src, rel)
            if os.path.isfile(fp):
                z.write(fp, "telegram/" + rel)
        for p in files:
            z.write(p, "telegram/" + os.path.relpath(p, src).replace(os.sep, "/"))
            n += 1
            size += os.path.getsize(p)
        z.writestr("telegram/ЧИТАЙ_МЕНЯ.txt", (
            "Собрано pack_telegram.py из %s\nЧасти: %s%s\n\n"
            "Лицензия: GPLv2 (см. LICENSE). Название и логотип Telegram — товарные знаки.\n"
            "Файлы скопированы без изменений, пути сохранены как в репозитории.\n"
            "UI-классы ссылаются на R.* (ресурсы) и на messenger/tgnet, переносите их вместе.\n\n%s\n"
            % (REPO, ", ".join(parts), (" (depth=%d)" % depth) if any(p in SEEDS for p in parts) else "", "\n\n".join(notes))))
    log("\nГотово: %s — %d файлов, %.1f МБ исходников, %.0f с" % (out, n, size / 1048576, time.time() - t0))


def main():
    ap = argparse.ArgumentParser(description="Собрать архив с интерфейсом, анимациями и логикой Telegram для Android")
    ap.add_argument("--parts", nargs="+", default=["all"], choices=list(PARTS) + list(SEEDS) + ["all"])
    ap.add_argument("--depth", type=int, default=1, help="глубина зависимостей для части gifts (0–3, по умолчанию 1)")
    ap.add_argument("--src", help="путь к уже скачанному репозиторию DrKLO/Telegram")
    ap.add_argument("--out", default="telegram_pack.zip")
    a = ap.parse_args()
    parts = ALL_PARTS if "all" in a.parts else a.parts
    log("Части:", ", ".join(parts))
    work = tempfile.mkdtemp(prefix="tgpack_")
    try:
        src = get_source(a.src, work)
        pack(src, parts, a.out, max(0, min(a.depth, 3)))
    finally:
        if not a.src:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
