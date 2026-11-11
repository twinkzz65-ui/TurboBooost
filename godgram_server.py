#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GodGram — Python-сервер (только стандартная библиотека, база SQLite).

Заменяет C#-сервер + PostgreSQL одним файлом: раздаёт веб-интерфейс из папки wwwroot/
и реализует тот же API. Работает на Windows, Linux, macOS и в Termux (Android).

Запуск:
    python godgram_server.py                 # http://127.0.0.1:8080/app (только этот компьютер/телефон)
    python godgram_server.py --lan           # доступен по Wi-Fi (для APK/IPA и других устройств)
    python godgram_server.py --port 9000
    python godgram_server.py --admin 79001234567   # сделать существующего пользователя админом

Переменные окружения (необязательно):
    GODGRAM_HOST, GODGRAM_PORT, GODGRAM_SQLITE (путь к базе),
    GODGRAM_OWNER_PHONE (этот номер при регистрации получит права админа),
    GODGRAM_DEV_CODES (1 — код входа показывается на экране и в консоли; по умолчанию 1, если нет
                       Telegram-бота, и 0, если бот подключён. НЕ выставляй сервер в интернет с DEV-кодами).
    GODGRAM_BOT_TOKEN (токен бота от @BotFather: коды входа приходят в Telegram), GODGRAM_TG_API
                       (адрес Bot API, если api.telegram.org недоступен и есть прокси/зеркало).

Коды в Telegram: создай бота в @BotFather, запусти сервер с --bot-token ТОКЕН. Пользователь один раз открывает
бота, жмёт Start и «Поделиться номером» — после этого коды для этого номера приходят ему в бота.
"""
import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import socket
import sqlite3
import sys
import threading
import time
import urllib.request
from contextlib import contextmanager
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote

BASE_DIR = Path(__file__).resolve().parent
WWWROOT = BASE_DIR / "wwwroot"
MAX_BODY = 8 * 1024 * 1024

SCHEMA = r"""
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 phone TEXT UNIQUE, username TEXT UNIQUE, nft_username TEXT, nft_number TEXT,
 first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '',
 name TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
 avatar TEXT NOT NULL DEFAULT '', avv INTEGER NOT NULL DEFAULT 0,
 is_admin INTEGER NOT NULL DEFAULT 0, is_service INTEGER NOT NULL DEFAULT 0,
 is_bot INTEGER NOT NULL DEFAULT 0, bot_owner INTEGER NOT NULL DEFAULT 0,
 bot_token TEXT UNIQUE, bot_script TEXT NOT NULL DEFAULT '{}',
 bot_desc TEXT NOT NULL DEFAULT '', frozen INTEGER NOT NULL DEFAULT 0,
 deleted INTEGER NOT NULL DEFAULT 0,
 created REAL NOT NULL DEFAULT (strftime('%s','now')),
 last_seen REAL NOT NULL DEFAULT 0, premium_until REAL NOT NULL DEFAULT 0,
 balance INTEGER NOT NULL DEFAULT 0, rating INTEGER NOT NULL DEFAULT 0,
 banner_color INTEGER NOT NULL DEFAULT -1, banner_pattern TEXT NOT NULL DEFAULT '',
 emoji_status TEXT NOT NULL DEFAULT '',
 birthday TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
 work_from TEXT NOT NULL DEFAULT '', work_to TEXT NOT NULL DEFAULT '',
 pchannel INTEGER NOT NULL DEFAULT 0, status_text TEXT NOT NULL DEFAULT '',
 status_nft INTEGER NOT NULL DEFAULT 0, boost_inf INTEGER NOT NULL DEFAULT 0,
 cloud_hash TEXT NOT NULL DEFAULT '', cloud_salt TEXT NOT NULL DEFAULT '',
 cloud_hint TEXT NOT NULL DEFAULT '', uorder TEXT NOT NULL DEFAULT '[]',
 umain TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created REAL NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_codes(
 phone TEXT PRIMARY KEY, code_hash TEXT NOT NULL, sent_at REAL NOT NULL,
 expires_at REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pending_passwords(
 token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 expires_at REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS registration_tokens(
 token TEXT PRIMARY KEY, phone TEXT NOT NULL, expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS chats (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kind TEXT NOT NULL CHECK (kind IN ('private','saved','group','channel')),
 title TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', avv INTEGER NOT NULL DEFAULT 0,
 owner INTEGER REFERENCES users(id), private_peer INTEGER REFERENCES users(id),
 created REAL NOT NULL DEFAULT (strftime('%s','now')),
 frozen INTEGER NOT NULL DEFAULT 0, descr TEXT NOT NULL DEFAULT '',
 handle TEXT UNIQUE, sign INTEGER NOT NULL DEFAULT 0,
 bcolor INTEGER NOT NULL DEFAULT -1, bpattern TEXT NOT NULL DEFAULT '',
 estatus TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0,
 pub INTEGER NOT NULL DEFAULT 1, boost_extra INTEGER NOT NULL DEFAULT 0,
 discussion_chat_id INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_private_pair ON chats(owner,private_peer) WHERE kind='private';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_saved_chat ON chats(owner) WHERE kind='saved';
CREATE TABLE IF NOT EXISTS members(
 chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 last_read INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(chat_id,user_id)
);
CREATE INDEX IF NOT EXISTS members_by_user ON members(user_id);
CREATE TABLE IF NOT EXISTS messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id),
 text TEXT NOT NULL DEFAULT '',
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 gift_id INTEGER NOT NULL DEFAULT 0, media_key TEXT NOT NULL DEFAULT '',
 media_kind TEXT NOT NULL DEFAULT '', media_dur INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS messages_chat_idx ON messages(chat_id,id DESC);
CREATE TABLE IF NOT EXISTS pins(
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 PRIMARY KEY(user_id,chat_id)
);
CREATE TABLE IF NOT EXISTS media(
 key TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL,
 owner INTEGER NOT NULL REFERENCES users(id), ts REAL NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS gifts(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0,
 model TEXT NOT NULL DEFAULT 'extrude', glyph TEXT NOT NULL DEFAULT '🎁',
 color TEXT NOT NULL DEFAULT '#2aabee', anim TEXT NOT NULL DEFAULT 'spin',
 supply INTEGER NOT NULL DEFAULT 0, sold INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1, created REAL NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS user_gifts(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 gift_id INTEGER NOT NULL REFERENCES gifts(id),
 owner_id INTEGER REFERENCES users(id), from_id INTEGER REFERENCES users(id),
 note TEXT NOT NULL DEFAULT '', number INTEGER NOT NULL DEFAULT 0,
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 listed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS user_gifts_owner_idx ON user_gifts(owner_id,id);
CREATE TABLE IF NOT EXISTS nft_usernames(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 handle TEXT NOT NULL UNIQUE, owner_id INTEGER REFERENCES users(id),
 created REAL NOT NULL DEFAULT (strftime('%s','now')),
 active INTEGER NOT NULL DEFAULT 1, price INTEGER NOT NULL DEFAULT 0,
 issued REAL NOT NULL DEFAULT 0, listed INTEGER NOT NULL DEFAULT 0,
 list_price INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS nft_numbers(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 number TEXT NOT NULL UNIQUE, owner_id INTEGER REFERENCES users(id),
 created REAL NOT NULL DEFAULT (strftime('%s','now')),
 listed INTEGER NOT NULL DEFAULT 0, list_price INTEGER NOT NULL DEFAULT 0,
 price INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS nft_colls(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, glyph TEXT NOT NULL DEFAULT '',
 supply INTEGER NOT NULL DEFAULT 0, minted INTEGER NOT NULL DEFAULT 0,
 price INTEGER NOT NULL DEFAULT 100, models TEXT NOT NULL DEFAULT '[]',
 active INTEGER NOT NULL DEFAULT 1,
 created REAL NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS nft_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 coll_id INTEGER REFERENCES nft_colls(id), number INTEGER NOT NULL,
 owner_id INTEGER REFERENCES users(id), model TEXT, backdrop TEXT, symbol TEXT,
 anim TEXT NOT NULL DEFAULT 'spin', price INTEGER NOT NULL DEFAULT 0,
 listed INTEGER NOT NULL DEFAULT 0, from_id INTEGER REFERENCES users(id),
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 UNIQUE(coll_id,number)
);
CREATE INDEX IF NOT EXISTS nft_items_owner_idx ON nft_items(owner_id,id);
CREATE TABLE IF NOT EXISTS badge_defs(
 key TEXT PRIMARY KEY, title TEXT NOT NULL, descr TEXT NOT NULL DEFAULT '',
 color TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'verify',
 icon TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS entity_badges(
 kind TEXT NOT NULL, tid INTEGER NOT NULL, bkey TEXT NOT NULL REFERENCES badge_defs(key),
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 PRIMARY KEY(kind,tid,bkey)
);
CREATE TABLE IF NOT EXISTS boosts(
 chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 PRIMARY KEY(chat_id,user_id)
);
CREATE TABLE IF NOT EXISTS reports(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reporter_id INTEGER NOT NULL REFERENCES users(id),
 tkind TEXT NOT NULL, tid INTEGER NOT NULL, reason TEXT NOT NULL,
 text TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open',
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS stories(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id), kind TEXT NOT NULL,
 media_key TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '',
 bg INTEGER NOT NULL DEFAULT 0,
 ts REAL NOT NULL DEFAULT (strftime('%s','now')), expires REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS story_views(
 story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 PRIMARY KEY(story_id,user_id)
);
CREATE TABLE IF NOT EXISTS tx(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 amount INTEGER NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 ts REAL NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS rating_log(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id), delta INTEGER NOT NULL,
 kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 from_id INTEGER NOT NULL DEFAULT 0, ref_id INTEGER NOT NULL DEFAULT 0,
 ts REAL NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS star_checks(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE, creator_id INTEGER NOT NULL REFERENCES users(id),
 amount INTEGER NOT NULL, max_uses INTEGER NOT NULL DEFAULT 1,
 used INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1,
 created REAL NOT NULL DEFAULT (strftime('%s','now')),
 expires REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS star_check_claims(
 check_id INTEGER NOT NULL REFERENCES star_checks(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 ts REAL NOT NULL DEFAULT (strftime('%s','now')),
 PRIMARY KEY(check_id,user_id)
);
CREATE TABLE IF NOT EXISTS tg_links(
 phone TEXT PRIMARY KEY, chat_id INTEGER NOT NULL, tg_user_id INTEGER NOT NULL,
 tg_username TEXT NOT NULL DEFAULT '', ts REAL NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS bot_updates(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 bot_id INTEGER NOT NULL REFERENCES users(id), chat_id INTEGER REFERENCES chats(id),
 from_id INTEGER REFERENCES users(id), text TEXT NOT NULL DEFAULT '',
 ts REAL NOT NULL DEFAULT (strftime('%s','now'))
);
"""

SEED = [
    ("INSERT OR IGNORE INTO badge_defs(key,title,descr,color,kind,icon,sort) VALUES(?,?,?,?,?,?,?)", [
        ("owner", "Owner GodGram", "Владелец GodGram", "#111111", "verify", "</>", 0),
        ("major", "Мажор", "Внутренняя метка", "#f5b82e", "verify", "★", 1),
        ("scam", "СКАМ", "Предупреждение администрации", "#e0443c", "label", "СКАМ", 2),
        ("fake", "ФЕЙК", "Предупреждение администрации", "#f08a24", "label", "ФЕЙК", 3)]),
]
GIFTS = [
    ("Сердце", 25, "extrude", "❤️", "#ff4d6d", "pulse"),
    ("Мишка", 50, "extrude", "🧸", "#ff8fb1", "float"),
    ("Торт", 75, "extrude", "🎂", "#ff9ccb", "bounce"),
    ("Подарок", 100, "box", "🎀", "#ff7a45", "spin"),
    ("Ракета", 150, "extrude", "🚀", "#5b8cff", "bounce"),
    ("Звезда", 200, "extrude", "⭐", "#ffd54a", "spin"),
    ("Алмаз", 500, "extrude", "💎", "#33c9ff", "spin"),
    ("Корона", 1000, "extrude", "👑", "#ffc83d", "float"),
]


# ───────────────────────── утилиты ─────────────────────────
class ApiError(Exception):
    def __init__(self, status, reason):
        super().__init__(reason)
        self.status = status
        self.reason = reason


def now():
    return time.time()


def token_hex(n=32):
    return secrets.token_hex(n)


def hash_code(code):
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def hash_password(password, salt_hex):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 200000, 32).hex()


def safe_eq(a, b):
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def S(row, key):
    v = row.get(key) if row else None
    return "" if v is None else str(v)


def L(row, key):
    v = row.get(key) if row else None
    try:
        return 0 if v is None else int(v)
    except (TypeError, ValueError):
        return 0


def D(row, key):
    v = row.get(key) if row else None
    try:
        return 0.0 if v is None else float(v)
    except (TypeError, ValueError):
        return 0.0


def F(row, key):
    return bool(row.get(key)) if row else False


def norm_phone(text):
    digits = re.sub(r"\D", "", text)
    if len(digits) < 7 or len(digits) > 15 or digits.startswith("888"):
        raise ApiError(400, "Номер должен содержать 7–15 цифр; +888 — только NFT")
    return digits


def check_username(name):
    if not re.fullmatch(r"[a-z][a-z0-9_]{4,31}", name):
        raise ApiError(400, "Username: от 5 до 32 символов, a-z, 0-9, _")


def contains(hay, needle):
    return needle.casefold() in (hay or "").casefold()


class Body:
    """Разбор JSON-тела так же, как RequestData в C#-версии."""

    def __init__(self, data):
        self.d = data if isinstance(data, dict) else {}

    def text(self, key, fallback=""):
        v = self.d.get(key)
        if isinstance(v, str):
            return v
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (int, float)):
            return str(v)
        return fallback

    def number(self, key, fallback=0):
        try:
            return int(self.text(key))
        except ValueError:
            return fallback

    def boolean(self, key):
        return self.text(key).lower() in ("true", "1")

    def numbers(self, key):
        a = self.d.get(key)
        if not isinstance(a, list):
            return []
        return [x for x in a if isinstance(x, int) and not isinstance(x, bool)]


# ───────────────────────── база данных ─────────────────────────
class Db:
    def __init__(self, path):
        self.lock = threading.RLock()
        self.cn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.cn.row_factory = sqlite3.Row
        self.cn.execute("PRAGMA journal_mode=WAL")
        self.cn.execute("PRAGMA foreign_keys=ON")
        self.cn.execute("PRAGMA busy_timeout=5000")
        self._tx = 0

    def init(self):
        with self.lock:
            self.cn.executescript(SCHEMA)
            for sql, rows in SEED:
                for r in rows:
                    self.cn.execute(sql, r)
            if not self.one("SELECT id FROM users WHERE username='godgram'"):
                self.cn.execute("INSERT INTO users(username,first_name,name,is_service,is_admin) VALUES('godgram','GodGram','GodGram',1,0)")
            for g in GIFTS:
                if not self.one("SELECT id FROM gifts WHERE name=?", g[0]):
                    self.cn.execute("INSERT INTO gifts(name,price,model,glyph,color,anim) VALUES(?,?,?,?,?,?)", g)

    def query(self, sql, *args):
        with self.lock:
            return [dict(r) for r in self.cn.execute(sql, args).fetchall()]

    def one(self, sql, *args):
        rows = self.query(sql, *args)
        return rows[0] if rows else None

    def scalar(self, sql, *args):
        with self.lock:
            r = self.cn.execute(sql, args).fetchone()
            return None if r is None else r[0]

    def exec(self, sql, *args):
        """Выполнить запрос, вернуть lastrowid."""
        with self.lock:
            cur = self.cn.execute(sql, args)
            return cur.lastrowid

    @contextmanager
    def tx(self):
        with self.lock:
            self.cn.execute("BEGIN IMMEDIATE")
            try:
                yield
                self.cn.execute("COMMIT")
            except BaseException:
                self.cn.execute("ROLLBACK")
                raise


class ChangeFeed:
    def __init__(self):
        self.cond = threading.Condition()
        self.version = 1

    def notify(self):
        with self.cond:
            self.version += 1
            self.cond.notify_all()

    def wait(self, seen, timeout=22):
        with self.cond:
            if seen != self.version:
                return self.version
            self.cond.wait(timeout)
            return self.version


DB = None
FEED = ChangeFeed()
DEV_CODES = True
OWNER_PHONE = ""
BOT = None  # TelegramBot или None



# ───────────────────────── Telegram-бот для кодов входа ─────────────────────────
class TelegramBot:
    def __init__(self, token, api_base):
        self.token = token
        self.base = f"{api_base.rstrip('/')}/bot{token}"
        self.username = ""
        self.offset = 0

    def call(self, method, params=None, timeout=35):
        data = json.dumps(params or {}).encode("utf-8")
        rq = urllib.request.Request(f"{self.base}/{method}", data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(rq, timeout=timeout) as resp:
            j = json.loads(resp.read().decode("utf-8"))
        if not j.get("ok"):
            raise RuntimeError(j.get("description", "Telegram API error"))
        return j["result"]

    def send(self, chat_id, text, markup=None):
        p = {"chat_id": chat_id, "text": text}
        if markup is not None:
            p["reply_markup"] = markup
        return self.call("sendMessage", p, timeout=15)

    def send_code(self, phone, code):
        link = DB.one("SELECT chat_id FROM tg_links WHERE phone=?", phone)
        if not link:
            return False
        try:
            self.send(L(link, "chat_id"), f"🔐 Код для входа в GodGram: {code}\n\nДействует 5 минут. Никому его не говорите.")
            return True
        except Exception as e:  # noqa
            sys.stderr.write(f"[bot] не удалось отправить код: {e}\n")
            return False

    def handle(self, upd):
        msg = upd.get("message") or {}
        chat = msg.get("chat") or {}
        if chat.get("type") != "private" or "from" not in msg:
            return
        cid = chat["id"]
        frm = msg["from"]
        contact = msg.get("contact")
        if contact:
            if contact.get("user_id") != frm.get("id"):
                self.send(cid, "Нужен именно ваш номер: нажмите кнопку «Поделиться номером» внизу.")
                return
            phone = re.sub(r"\D", "", contact.get("phone_number", ""))
            if len(phone) < 7:
                self.send(cid, "Не удалось прочитать номер. Попробуйте ещё раз.")
                return
            DB.exec("INSERT INTO tg_links(phone,chat_id,tg_user_id,tg_username,ts) VALUES(?,?,?,?,?) "
                    "ON CONFLICT(phone) DO UPDATE SET chat_id=excluded.chat_id,tg_user_id=excluded.tg_user_id,"
                    "tg_username=excluded.tg_username,ts=excluded.ts",
                    phone, cid, frm["id"], frm.get("username") or "", now())
            self.send(cid, f"✅ Номер +{phone} привязан. Теперь вернитесь в приложение GodGram и запросите код: он придёт сюда.",
                      {"remove_keyboard": True})
            return
        self.send(cid, "Привет! Это бот GodGram. Он присылает коды для входа.\n\nНажмите кнопку «Поделиться номером» внизу, "
                       "затем запросите код в приложении.",
                  {"keyboard": [[{"text": "📱 Поделиться номером", "request_contact": True}]],
                   "resize_keyboard": True, "one_time_keyboard": True})

    def loop(self):
        delay = 2
        while True:
            try:
                ups = self.call("getUpdates", {"offset": self.offset, "timeout": 25, "allowed_updates": ["message"]}, timeout=40)
                delay = 2
                for u in ups:
                    self.offset = u["update_id"] + 1
                    try:
                        self.handle(u)
                    except Exception as e:  # noqa
                        sys.stderr.write(f"[bot] ошибка обработки: {e!r}\n")
            except Exception as e:  # noqa
                sys.stderr.write(f"[bot] нет связи с Telegram: {e}. Повтор через {delay} с\n")
                time.sleep(delay)
                delay = min(delay * 2, 60)

    def start(self):
        me = self.call("getMe", timeout=15)
        self.username = me.get("username", "")
        try:
            self.call("deleteWebhook", {}, timeout=15)
        except Exception:
            pass
        threading.Thread(target=self.loop, daemon=True).start()


# ───────────────────────── профили ─────────────────────────
def public_user(u, viewer=None):
    mine = viewer is not None and (L(u, "id") == L(viewer, "id") or F(viewer, "is_admin"))
    uid = L(u, "id")
    handles = []
    if S(u, "username").strip():
        handles.append({"handle": S(u, "username"), "nft": False, "main": True})
    for n in DB.query("SELECT handle,price,issued,active FROM nft_usernames WHERE owner_id=? AND active ORDER BY id", uid):
        handles.append({"handle": S(n, "handle"), "nft": True, "main": False, "price": L(n, "price"), "issued": D(n, "issued")})
    badge_rows = DB.query("SELECT b.* FROM badge_defs b JOIN entity_badges e ON e.bkey=b.key WHERE e.kind='user' AND e.tid=? ORDER BY b.sort", uid)
    badges = [{"key": S(b, "key"), "title": S(b, "title"), "descr": S(b, "descr"), "color": S(b, "color"),
               "kind": S(b, "kind"), "icon": S(b, "icon")} for b in badge_rows]
    if F(u, "is_admin") and not any(S(b, "key") == "owner" for b in badge_rows):
        badges.insert(0, {"key": "owner", "title": "Owner GodGram", "descr": "Администратор GodGram",
                          "color": "#111111", "kind": "verify", "icon": "</>"})
    premium = D(u, "premium_until") > now()
    username = S(u, "username")
    return {
        "id": uid, "deleted": F(u, "deleted"), "service": F(u, "is_service"),
        "name": S(u, "name"), "first_name": S(u, "first_name"), "last_name": S(u, "last_name"),
        "username": username if username.strip() else None, "usernames": handles,
        "nft_username": False, "nft_number": bool(S(u, "nft_number")),
        "phone": S(u, "phone") if mine else S(u, "nft_number"),
        "real_phone": S(u, "phone") if mine else "",
        "own_username": username if mine else None,
        "avatar_url": f"/av/u/{uid}?v={L(u, 'avv')}" if S(u, "avatar") else "",
        "bio": S(u, "bio"), "online": now() - D(u, "last_seen") < 45,
        "last_seen": D(u, "last_seen"), "is_admin": F(u, "is_admin"),
        "is_bot": F(u, "is_bot"), "frozen": F(u, "frozen"),
        "bot_desc": S(u, "bot_desc"), "balance": L(u, "balance") if mine else 0,
        "rating": L(u, "rating"), "premium": premium, "premium_until": D(u, "premium_until") if premium else 0,
        "boost_inf": mine and F(u, "boost_inf"),
        "emoji_status": S(u, "emoji_status") if premium else "",
        "banner": {"color": L(u, "banner_color"), "pattern": S(u, "banner_pattern")}
        if premium and L(u, "banner_color") >= 0 else None,
        "badges": badges, "birthday": S(u, "birthday"), "address": S(u, "address"),
        "work_from": S(u, "work_from"), "work_to": S(u, "work_to"), "status_text": S(u, "status_text"),
        "pchannel": None, "status_nft": None,
        "has_cloud_pw": mine and bool(S(u, "cloud_hash")),
    }


# ───────────────────────── запрос ─────────────────────────
class Req:
    def __init__(self, handler, method, path, query):
        self.h = handler
        self.method = method
        self.path = path
        self.q = query
        self._body = None

    def qtext(self, key):
        v = self.q.get(key)
        return v[0] if v else ""

    def qlong(self, key):
        try:
            return int(self.qtext(key))
        except ValueError:
            return 0

    def body(self):
        if self._body is None:
            n = int(self.h.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                raise ApiError(413, "Слишком большой запрос")
            raw = self.h.rfile.read(n) if n else b""
            try:
                self._body = Body(json.loads(raw.decode("utf-8")) if raw else {})
            except (ValueError, UnicodeDecodeError):
                raise ApiError(400, "Некорректный JSON")
        return self._body

    def bearer(self):
        header = self.h.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "Нужен вход")
        return header[7:]

    def me(self):
        row = DB.one("SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id "
                     "WHERE s.token=? AND NOT u.deleted AND NOT u.frozen", self.bearer())
        if not row:
            raise ApiError(401, "Нужен вход")
        return row


ROUTES = {}


def route(method, path):
    def deco(fn):
        ROUTES[(method, path)] = fn
        return fn
    return deco


# ───────────────────────── авторизация ─────────────────────────
@route("POST", "/api/auth/send_code")
def send_code(r):
    if not DEV_CODES and not BOT:
        raise ApiError(503, "Не настроена доставка кодов: подключи Telegram-бота (--bot-token) или включи GODGRAM_DEV_CODES=1")
    phone = norm_phone(r.body().text("phone"))
    t = now()
    if BOT and not DB.one("SELECT 1 AS x FROM tg_links WHERE phone=?", phone) and not DEV_CODES:
        raise ApiError(404, f"Сначала откройте бота @{BOT.username} в Telegram, нажмите Start и поделитесь номером")
    prev = DB.one("SELECT sent_at FROM login_codes WHERE phone=?", phone)
    if prev and t - D(prev, "sent_at") < 5:
        raise ApiError(429, "Повтори через 5 секунд")
    code = f"{secrets.randbelow(100000):05d}"
    DB.exec("INSERT INTO login_codes(phone,code_hash,sent_at,expires_at,attempts) VALUES(?,?,?,?,0) "
            "ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,sent_at=excluded.sent_at,"
            "expires_at=excluded.expires_at,attempts=0", phone, hash_code(code), t, t + 300)
    existing = DB.one("SELECT id FROM users WHERE phone=? AND NOT deleted", phone)
    via = ""
    if BOT:
        if BOT.send_code(phone, code):
            via = "telegram"
        elif not DEV_CODES:
            raise ApiError(502, "Не удалось отправить код в Telegram. Попробуйте позже")
    if DEV_CODES:
        print(f"[DEV LOGIN CODE] +{phone}: {code}", flush=True)
    res = {"ok": True, "registered": existing is not None, "length": 5, "via": via}
    if DEV_CODES:
        res["code"] = code
    if via:
        res["bot"] = BOT.username
    return res


@route("POST", "/api/auth/sign_in")
def sign_in(r):
    b = r.body()
    phone = norm_phone(b.text("phone"))
    code = b.text("code")
    att = DB.one("SELECT * FROM login_codes WHERE phone=?", phone)
    if not att or D(att, "expires_at") < now():
        raise ApiError(400, "Код истёк")
    if L(att, "attempts") >= 5:
        raise ApiError(429, "Слишком много попыток")
    DB.exec("UPDATE login_codes SET attempts=attempts+1 WHERE phone=?", phone)
    if not safe_eq(S(att, "code_hash"), hash_code(code)):
        raise ApiError(400, "Неверный код")
    DB.exec("DELETE FROM login_codes WHERE phone=?", phone)
    user = DB.one("SELECT * FROM users WHERE phone=? AND NOT deleted", phone)
    if not user:
        tok = token_hex()
        DB.exec("INSERT INTO registration_tokens(token,phone,expires_at) VALUES(?,?,?)", tok, phone, now() + 900)
        return {"registered": False, "reg_token": tok}
    if F(user, "frozen"):
        raise ApiError(403, "Аккаунт заморожен")
    if S(user, "cloud_hash"):
        pending = token_hex()
        DB.exec("INSERT INTO pending_passwords(token,user_id,expires_at) VALUES(?,?,?)", pending, L(user, "id"), now() + 600)
        return {"registered": True, "need_password": True, "pw_token": pending, "hint": S(user, "cloud_hint")}
    session = token_hex()
    DB.exec("INSERT INTO sessions(token,user_id) VALUES(?,?)", session, L(user, "id"))
    return {"registered": True, "token": session}


@route("POST", "/api/auth/check_password")
def check_password(r):
    b = r.body()
    pending = b.text("pw_token")
    row = DB.one("SELECT p.*,u.cloud_hash,u.cloud_salt FROM pending_passwords p JOIN users u ON u.id=p.user_id WHERE p.token=?", pending)
    if not row or D(row, "expires_at") < now():
        raise ApiError(400, "Время ввода пароля истекло")
    if L(row, "attempts") >= 5:
        raise ApiError(429, "Слишком много попыток")
    DB.exec("UPDATE pending_passwords SET attempts=attempts+1 WHERE token=?", pending)
    if not safe_eq(hash_password(b.text("password"), S(row, "cloud_salt")), S(row, "cloud_hash")):
        raise ApiError(400, "Неверный пароль")
    DB.exec("DELETE FROM pending_passwords WHERE token=?", pending)
    tok = token_hex()
    DB.exec("INSERT INTO sessions(token,user_id) VALUES(?,?)", tok, L(row, "user_id"))
    return {"token": tok}


@route("POST", "/api/auth/sign_up")
def sign_up(r):
    b = r.body()
    reg = b.text("reg_token")
    temp = DB.one("SELECT * FROM registration_tokens WHERE token=?", reg)
    if not temp or D(temp, "expires_at") < now():
        raise ApiError(400, "Регистрация истекла")
    first = b.text("first_name").strip()
    last = b.text("last_name").strip()
    if len(first) < 1 or len(first) > 40 or len(last) > 40:
        raise ApiError(400, "Проверь имя и фамилию")
    phone = S(temp, "phone")
    owner = bool(OWNER_PHONE) and OWNER_PHONE == phone
    avatar = b.text("avatar")
    if avatar and (len(avatar) > 3500000 or not avatar.startswith("data:image/")):
        avatar = ""
    try:
        uid = DB.exec("INSERT INTO users(phone,first_name,last_name,name,is_admin,last_seen,avatar,avv) VALUES(?,?,?,?,?,?,?,?)",
                      phone, first, last, f"{first} {last}".strip(), 1 if owner else 0, now(), avatar, 1 if avatar else 0)
    except sqlite3.IntegrityError:
        raise ApiError(409, "Этот номер уже зарегистрирован")
    DB.exec("DELETE FROM registration_tokens WHERE token=?", reg)
    tok = token_hex()
    DB.exec("INSERT INTO sessions(token,user_id) VALUES(?,?)", tok, uid)
    FEED.notify()
    return {"token": tok}


@route("POST", "/api/logout")
def logout(r):
    me = r.me()
    DB.exec("DELETE FROM sessions WHERE token=? AND user_id=?", r.bearer(), L(me, "id"))
    return {"ok": True}


@route("POST", "/api/sessions/terminate_others")
def terminate_others(r):
    me = r.me()
    DB.exec("DELETE FROM sessions WHERE user_id=? AND token<>?", L(me, "id"), r.bearer())
    return {"ok": True}


@route("POST", "/api/cloud_password")
def cloud_password(r):
    me = r.me()
    b = r.body()
    if S(me, "cloud_hash"):
        if not safe_eq(hash_password(b.text("current"), S(me, "cloud_salt")), S(me, "cloud_hash")):
            raise ApiError(403, "Неверный текущий пароль")
    password = b.text("new")
    if not password:
        DB.exec("UPDATE users SET cloud_hash='',cloud_salt='',cloud_hint='' WHERE id=?", L(me, "id"))
    else:
        if len(password) < 8 or len(password) > 128:
            raise ApiError(400, "Пароль: от 8 до 128 символов")
        salt = token_hex(16)
        DB.exec("UPDATE users SET cloud_hash=?,cloud_salt=?,cloud_hint=? WHERE id=?",
                hash_password(password, salt), salt, b.text("hint")[:60], L(me, "id"))
    return {"ok": True}


@route("GET", "/api/me")
def api_me(r):
    me = r.me()
    DB.exec("UPDATE users SET last_seen=? WHERE id=?", now(), L(me, "id"))
    me["last_seen"] = now()
    return {"me": public_user(me, me), "v": FEED.version}


@route("GET", "/api/poll")
def api_poll(r):
    r.me()
    return {"v": FEED.wait(r.qlong("v"))}


# ───────────────────────── пользователи ─────────────────────────
def ensure_username(un, uid):
    check_username(un)
    taken = un in ("telegram", "godgram") \
        or DB.one("SELECT id FROM users WHERE username=? AND id<>?", un, uid) \
        or DB.one("SELECT id FROM nft_usernames WHERE handle=?", un)
    if taken:
        raise ApiError(409, "Это имя занято")


@route("GET", "/api/users")
def users_search(r):
    me = r.me()
    term = r.qtext("q").strip().lstrip("@")
    rows = DB.query("SELECT * FROM users WHERE NOT deleted AND NOT is_service AND id<>? ORDER BY id DESC", L(me, "id"))
    rows = [u for u in rows if term == "" or contains(S(u, "name"), term) or contains(S(u, "username"), term)][:50]
    return {"users": [public_user(u, me) for u in rows]}


@route("GET", "/api/user")
def user_get(r):
    me = r.me()
    u = DB.one("SELECT * FROM users WHERE id=?", r.qlong("id"))
    if not u:
        raise ApiError(404, "Пользователь не найден")
    res = public_user(u, me)
    res["gifts"] = []
    res["nft_gifts"] = []
    return {"user": res}


@route("POST", "/api/username/check")
def username_check(r):
    me = r.me()
    un = r.body().text("username").strip().lstrip("@").lower()
    try:
        ensure_username(un, L(me, "id"))
        return {"ok": True}
    except ApiError as e:
        return {"ok": False, "error": e.reason}


def parse_birthday(s):
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%m/%d/%Y"):
        try:
            datetime.strptime(s, fmt)
            return True
        except ValueError:
            pass
    return False


@route("POST", "/api/profile")
def profile(r):
    me = r.me()
    b = r.body()
    first = b.text("first_name", S(me, "first_name")).strip()
    last = b.text("last_name", S(me, "last_name")).strip()
    if len(first) < 1 or len(first) > 40 or len(last) > 40:
        raise ApiError(400, "Проверь имя")
    bio = b.text("bio", S(me, "bio"))[:200]
    un = b.text("username", S(me, "username")).strip().lstrip("@").lower()
    if un and un != S(me, "username"):
        ensure_username(un, L(me, "id"))
    avatar = b.text("avatar", S(me, "avatar"))
    if len(avatar) > 3500000 or (avatar and not avatar.startswith("data:image/")):
        raise ApiError(400, "Неверный аватар")
    birthday = b.text("birthday", S(me, "birthday"))
    if birthday and not parse_birthday(birthday):
        raise ApiError(400, "Неверная дата")
    DB.exec("UPDATE users SET first_name=?,last_name=?,name=?,bio=?,username=?,avatar=?,avv=avv+1,"
            "birthday=?,address=?,work_from=?,work_to=?,status_text=? WHERE id=?",
            first, last, f"{first} {last}".strip(), bio, un or None, avatar, birthday,
            b.text("address", S(me, "address"))[:120], b.text("work_from", S(me, "work_from")),
            b.text("work_to", S(me, "work_to")), b.text("status_text", S(me, "status_text"))[:120], L(me, "id"))
    FEED.notify()
    return {"ok": True}


@route("POST", "/api/profile/style")
def profile_style(r):
    me = r.me()
    if D(me, "premium_until") < now():
        raise ApiError(403, "Нужен GodGram Premium")
    b = r.body()
    col = b.number("banner_color", -1)
    if col < -1 or col > 12:
        raise ApiError(400, "Неверный цвет")
    pattern = b.text("banner_pattern")
    emoji = b.text("emoji_status")
    if len(pattern) > 1200000 or len(emoji) > 700000:
        raise ApiError(413, "Слишком большой файл")
    DB.exec("UPDATE users SET banner_color=?,banner_pattern=?,emoji_status=? WHERE id=?", col, pattern, emoji, L(me, "id"))
    FEED.notify()
    return {"ok": True}


@route("GET", "/api/my_nft")
def my_nft(r):
    me = r.me()
    names = DB.query("SELECT * FROM nft_usernames WHERE owner_id=? ORDER BY id", L(me, "id"))
    nums = DB.query("SELECT number FROM nft_numbers WHERE owner_id=? ORDER BY id", L(me, "id"))
    return {
        "active": [{"handle": S(x, "handle"), "nft": True, "price": L(x, "price"), "issued": D(x, "issued")} for x in names if F(x, "active")],
        "inactive": [S(x, "handle") for x in names if not F(x, "active")],
        "numbers": [S(x, "number") for x in nums],
    }


# ───────────────────────── чаты ─────────────────────────
def ensure_member(cid, uid):
    if not DB.one("SELECT 1 AS x FROM members WHERE chat_id=? AND user_id=?", cid, uid):
        raise ApiError(403, "Нет доступа к чату")


def avatar_url(kind, row_avatar, ident, avv):
    return f"/av/{kind}/{ident}?v={avv}" if row_avatar else ""


@route("GET", "/api/chats")
def chats_list(r):
    me = r.me()
    uid = L(me, "id")
    chats = DB.query("SELECT c.*,m.last_read, EXISTS(SELECT 1 FROM pins p WHERE p.chat_id=c.id AND p.user_id=?) AS pinned "
                     "FROM chats c JOIN members m ON m.chat_id=c.id AND m.user_id=? WHERE NOT c.deleted ORDER BY c.created DESC", uid, uid)
    result = []
    for c in chats:
        cid = L(c, "id")
        last = DB.one("SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON m.user_id=u.id WHERE m.chat_id=? ORDER BY m.id DESC LIMIT 1", cid)
        unread = DB.scalar("SELECT count(*) FROM messages WHERE chat_id=? AND id>? AND user_id<>?", cid, L(c, "last_read"), uid)
        kind = S(c, "kind")
        peer = None
        if kind == "private":
            peer = DB.one("SELECT u.* FROM users u JOIN members m ON m.user_id=u.id WHERE m.chat_id=? AND m.user_id<>?", cid, uid)
        p = public_user(peer, me) if peer else None
        if kind == "saved":
            title = "Избранное"
        elif kind == "private":
            title = S(peer, "name") if peer else "Удалённый аккаунт"
        else:
            title = S(c, "title")
        if kind == "private":
            av = avatar_url("u", peer and S(peer, "avatar"), L(peer, "id"), L(peer, "avv")) if peer else ""
        else:
            av = avatar_url("c", S(c, "avatar"), cid, L(c, "avv"))
        result.append({
            "id": cid, "kind": kind, "title": title, "avatar_url": av, "unread": unread, "pinned": F(c, "pinned"),
            "created": D(c, "created"), "frozen": F(c, "frozen"), "deleted": F(c, "deleted"), "owner": L(c, "owner"),
            "handle": S(c, "handle"), "members": None, "saved": kind == "saved",
            "can_post": not F(c, "frozen") and (kind != "channel" or L(c, "owner") == uid),
            "peer": public_user(me, me) if kind == "saved" else p, "badges": [],
            "last": None if not last else {"id": L(last, "id"), "text": S(last, "text"), "ts": D(last, "ts"),
                                           "mine": L(last, "user_id") == uid, "from": S(last, "sender_name")},
        })
    return {"chats": result}


@route("GET", "/api/chat")
def chat_get(r):
    me = r.me()
    cid = r.qlong("id")
    ensure_member(cid, L(me, "id"))
    chat = DB.one("SELECT * FROM chats WHERE id=? AND NOT deleted", cid)
    if not chat:
        raise ApiError(404, "Чат не найден")
    members = DB.query("SELECT u.* FROM users u JOIN members m ON u.id=m.user_id WHERE m.chat_id=?", cid)
    return {"id": cid, "kind": S(chat, "kind"), "title": S(chat, "title"), "owner": L(chat, "owner"),
            "frozen": F(chat, "frozen"), "descr": S(chat, "descr"), "handle": S(chat, "handle"), "level": 0, "badges": [],
            "members": [public_user(m, me) for m in members],
            "avatar_url": avatar_url("c", S(chat, "avatar"), cid, L(chat, "avv"))}


@route("POST", "/api/chat/private")
def chat_private(r):
    me = r.me()
    other = r.body().number("user_id")
    uid = L(me, "id")
    if uid == other:
        raise ApiError(400, "Нельзя создать чат с самим собой")
    if not DB.one("SELECT id FROM users WHERE id=? AND NOT deleted AND NOT is_service", other):
        raise ApiError(404, "Пользователь не найден")
    a, c = min(uid, other), max(uid, other)
    with DB.tx():
        ex = DB.one("SELECT id FROM chats WHERE kind='private' AND owner=? AND private_peer=?", a, c)
        if ex:
            cid = L(ex, "id")
            DB.exec("UPDATE chats SET deleted=0 WHERE id=?", cid)
        else:
            cid = DB.exec("INSERT INTO chats(kind,owner,private_peer) VALUES('private',?,?)", a, c)
        for i in (a, c):
            DB.exec("INSERT OR IGNORE INTO members(chat_id,user_id) VALUES(?,?)", cid, i)
    FEED.notify()
    return {"chat_id": cid}


@route("POST", "/api/chat/group")
def chat_group(r):
    me = r.me()
    b = r.body()
    title = b.text("title").strip()
    if len(title) < 1 or len(title) > 50:
        raise ApiError(400, "Проверь название группы")
    avatar = b.text("avatar")
    if len(avatar) > 3500000:
        raise ApiError(413, "Аватар слишком большой")
    ids = list(dict.fromkeys(b.numbers("members")[:200] + [L(me, "id")]))
    with DB.tx():
        cid = DB.exec("INSERT INTO chats(kind,title,owner,avatar,avv) VALUES('group',?,?,?,1)", title, L(me, "id"), avatar)
        for i in ids:
            DB.exec("INSERT OR IGNORE INTO members(chat_id,user_id) SELECT ?,id FROM users WHERE id=? AND NOT deleted", cid, i)
    FEED.notify()
    return {"chat_id": cid}


@route("GET", "/api/messages")
def messages_get(r):
    me = r.me()
    uid = L(me, "id")
    cid = r.qlong("chat_id")
    ensure_member(cid, uid)
    rows = DB.query("SELECT m.*,u.name AS sender_name,u.avatar AS sender_avatar,u.avv AS sender_avv,"
                    "u.is_bot AS sender_bot,u.deleted AS sender_deleted FROM messages m JOIN users u ON u.id=m.user_id "
                    "WHERE m.chat_id=? ORDER BY m.id DESC LIMIT 200", cid)[::-1]
    if r.qtext("read") and rows:
        DB.exec("UPDATE members SET last_read=? WHERE chat_id=? AND user_id=?", L(rows[-1], "id"), cid, uid)
    chat = DB.one("SELECT kind FROM chats WHERE id=?", cid)
    peer_read = 0
    if chat and S(chat, "kind") == "private":
        o = DB.one("SELECT last_read FROM members WHERE chat_id=? AND user_id<>?", cid, uid)
        peer_read = L(o, "last_read") if o else 0
    out = []
    for m in rows:
        out.append({
            "id": L(m, "id"), "uid": L(m, "user_id"), "text": S(m, "text"), "ts": D(m, "ts"), "gift": None,
            "media_url": "/media/" + S(m, "media_key") if S(m, "media_key") else "",
            "media_kind": S(m, "media_kind"), "media_dur": L(m, "media_dur"),
            "sender": {"id": L(m, "user_id"), "name": S(m, "sender_name"),
                       "avatar_url": f"/av/u/{L(m, 'user_id')}?v={L(m, 'sender_avv')}" if S(m, "sender_avatar") else "",
                       "deleted": F(m, "sender_deleted"), "service": False, "premium": False, "emoji_status": "",
                       "bot": F(m, "sender_bot"), "badges": [], "status_nft": None},
        })
    return {"messages": out, "peer_last_read": peer_read}


@route("POST", "/api/send")
def send(r):
    me = r.me()
    b = r.body()
    cid = b.number("chat_id")
    uid = L(me, "id")
    text = b.text("text").strip()
    if len(text) == 0 or len(text) > 4000:
        raise ApiError(400, "Длина сообщения: 1–4000 символов")
    ensure_member(cid, uid)
    chat = DB.one("SELECT * FROM chats WHERE id=? AND NOT deleted", cid)
    if not chat:
        raise ApiError(404, "Чат не найден")
    if F(chat, "frozen") or (S(chat, "kind") == "channel" and L(chat, "owner") != uid):
        raise ApiError(403, "Нет прав на отправку сообщения")
    if S(chat, "kind") == "private":
        o = DB.one("SELECT u.deleted,u.frozen,u.is_service FROM users u JOIN members m ON m.user_id=u.id WHERE m.chat_id=? AND m.user_id<>?", cid, uid)
        if not o or F(o, "deleted") or F(o, "frozen") or F(o, "is_service"):
            raise ApiError(403, "Сообщение отправить нельзя")
    mid = DB.exec("INSERT INTO messages(chat_id,user_id,text,ts) VALUES(?,?,?,?)", cid, uid, text, now())
    DB.exec("UPDATE members SET last_read=? WHERE chat_id=? AND user_id=?", mid, cid, uid)
    FEED.notify()
    return {"ok": True, "id": mid}


@route("POST", "/api/saved")
def saved(r):
    me = r.me()
    uid = L(me, "id")
    with DB.tx():
        ex = DB.one("SELECT id FROM chats WHERE kind='saved' AND owner=?", uid)
        if ex:
            cid = L(ex, "id")
            DB.exec("UPDATE chats SET deleted=0 WHERE id=?", cid)
        else:
            cid = DB.exec("INSERT INTO chats(kind,title,owner) VALUES('saved','Избранное',?)", uid)
        DB.exec("INSERT OR IGNORE INTO members(chat_id,user_id) VALUES(?,?)", cid, uid)
    FEED.notify()
    return {"chat_id": cid}


@route("POST", "/api/chat/channel")
def chat_channel(r):
    me = r.me()
    b = r.body()
    title = b.text("title").strip()
    if len(title) < 1 or len(title) > 50:
        raise ApiError(400, "Проверь название канала")
    handle = b.text("handle").strip().lstrip("@").lower()
    if handle:
        check_username(handle)
    uid = L(me, "id")
    with DB.tx():
        cid = DB.exec("INSERT INTO chats(kind,title,owner,handle,descr,pub) VALUES('channel',?,?,?,?,?)",
                      title, uid, handle or None, b.text("descr"), 0 if b.boolean("private") else 1)
        DB.exec("INSERT INTO members(chat_id,user_id) VALUES(?,?)", cid, uid)
    FEED.notify()
    return {"chat_id": cid}


@route("GET", "/api/channels")
def channels(r):
    me = r.me()
    uid = L(me, "id")
    term = r.qtext("q").strip()
    rows = DB.query("SELECT c.* FROM chats c WHERE c.kind='channel' AND NOT c.deleted AND "
                    "(c.pub OR c.owner=? OR EXISTS(SELECT 1 FROM members m WHERE m.chat_id=c.id AND m.user_id=?)) "
                    "ORDER BY c.created DESC", uid, uid)
    rows = [c for c in rows if term == "" or contains(S(c, "title"), term) or contains(S(c, "handle"), term)][:30]
    out = []
    for c in rows:
        cid = L(c, "id")
        out.append({"id": cid, "kind": "channel", "title": S(c, "title"),
                    "members": DB.scalar("SELECT count(*) FROM members WHERE chat_id=?", cid),
                    "handle": S(c, "handle"), "descr": S(c, "descr"), "owner": L(c, "owner"), "pub": F(c, "pub"),
                    "level": 0, "joined": DB.one("SELECT 1 AS x FROM members WHERE chat_id=? AND user_id=?", cid, uid) is not None,
                    "boosts": 0, "badges": [], "frozen": F(c, "frozen"),
                    "avatar_url": avatar_url("c", S(c, "avatar"), cid, L(c, "avv"))})
    return {"channels": out}


@route("POST", "/api/channel/join")
def channel_join(r):
    me = r.me()
    b = r.body()
    cid = b.number("chat_id")
    if cid == 0:
        c0 = DB.one("SELECT id FROM chats WHERE handle=?", b.text("handle").lstrip("@"))
        cid = L(c0, "id") if c0 else 0
    c = DB.one("SELECT * FROM chats WHERE id=? AND kind='channel' AND NOT deleted", cid)
    if not c:
        raise ApiError(404, "Канал не найден")
    if not F(c, "pub") and L(c, "owner") != L(me, "id"):
        raise ApiError(403, "Приватный канал: требуется приглашение")
    DB.exec("INSERT OR IGNORE INTO members(chat_id,user_id) VALUES(?,?)", cid, L(me, "id"))
    FEED.notify()
    return {"ok": True, "chat_id": cid}


@route("POST", "/api/channel/leave")
def channel_leave(r):
    me = r.me()
    cid = r.body().number("chat_id")
    c = DB.one("SELECT owner FROM chats WHERE id=?", cid)
    if c and L(c, "owner") == L(me, "id"):
        raise ApiError(403, "Владелец не может покинуть свой канал")
    DB.exec("DELETE FROM members WHERE chat_id=? AND user_id=?", cid, L(me, "id"))
    FEED.notify()
    return {"ok": True}


@route("POST", "/api/pin")
def pin(r):
    me = r.me()
    b = r.body()
    cid = b.number("chat_id")
    ensure_member(cid, L(me, "id"))
    if b.boolean("on"):
        DB.exec("INSERT OR IGNORE INTO pins(user_id,chat_id) VALUES(?,?)", L(me, "id"), cid)
    else:
        DB.exec("DELETE FROM pins WHERE user_id=? AND chat_id=?", L(me, "id"), cid)
    FEED.notify()
    return {"ok": True}


# ───────────────────────── подарки, NFT, кошелёк, прочее ─────────────────────────
def nft_view(row, coll):
    def parts(s, n):
        p = s.split("|")
        return p if len(p) == n else [""] * n

    def i(s):
        try:
            return int(s)
        except ValueError:
            return 0
    model, bg, sym = parts(S(row, "model"), 3), parts(S(row, "backdrop"), 4), parts(S(row, "symbol"), 3)
    name = S(coll, "name") if coll else "Коллекция"
    return {"id": L(row, "id"), "coll_id": L(row, "coll_id"), "coll": name,
            "supply": L(coll, "supply") if coll else 0, "number": L(row, "number"), "glyph": model[1],
            "model": {"name": model[0], "glyph": model[1], "rar": i(model[2])},
            "backdrop": {"name": bg[0], "c1": bg[1], "c2": bg[2], "rar": i(bg[3])},
            "symbol": {"name": sym[0], "glyph": sym[1], "rar": i(sym[2])},
            "anim": S(row, "anim"), "price": L(row, "price"), "listed": F(row, "listed"),
            "owner": None, "ts": D(row, "ts"), "name": f"{name} #{L(row, 'number')}", "nft": True}


def nft_items(which, uid=0):
    if which == "mine":
        rows = DB.query("SELECT * FROM nft_items WHERE owner_id=? ORDER BY id DESC LIMIT 100", uid)
    elif which == "listed":
        rows = DB.query("SELECT * FROM nft_items WHERE listed ORDER BY price ASC,id DESC LIMIT 120")
    else:
        rows = []
    colls = {L(c, "id"): c for c in DB.query("SELECT id,name,supply FROM nft_colls")}
    return [nft_view(x, colls.get(L(x, "coll_id"))) for x in rows]


@route("GET", "/api/gifts")
def gifts(r):
    r.me()
    rows = DB.query("SELECT * FROM gifts WHERE active ORDER BY price,id")
    return {"gifts": [{"id": L(x, "id"), "name": S(x, "name"), "price": L(x, "price"), "model": S(x, "model"),
                       "glyph": S(x, "glyph"), "color": S(x, "color"), "anim": S(x, "anim"),
                       "supply": L(x, "supply"), "sold": L(x, "sold")} for x in rows]}


@route("GET", "/api/nft/mine")
def nft_mine(r):
    me = r.me()
    rows = DB.query("SELECT ug.*,g.name,g.glyph,g.price,g.color,g.model,g.anim FROM user_gifts ug "
                    "JOIN gifts g ON ug.gift_id=g.id WHERE ug.owner_id=? ORDER BY ug.id DESC", L(me, "id"))
    g = [{"id": L(x, "id"), "gift_id": L(x, "gift_id"), "name": S(x, "name"), "glyph": S(x, "glyph"),
          "color": S(x, "color"), "model": S(x, "model"), "anim": S(x, "anim"), "price": L(x, "price"),
          "listed": F(x, "listed"), "note": S(x, "note"), "number": L(x, "number")} for x in rows]
    return {"items": nft_items("mine", L(me, "id")), "gifts": g, "listed": {}}


@route("POST", "/api/nft/wear")
def nft_wear(r):
    me = r.me()
    i = r.body().number("id")
    if i > 0 and not DB.one("SELECT 1 AS x FROM nft_items WHERE id=? AND owner_id=?", i, L(me, "id")):
        raise ApiError(403, "Это не твой предмет")
    DB.exec("UPDATE users SET status_nft=? WHERE id=?", i, L(me, "id"))
    FEED.notify()
    return {"ok": True}


@route("GET", "/api/market")
def market(r):
    me = r.me()
    colls = []
    for c in DB.query("SELECT * FROM nft_colls WHERE active ORDER BY id"):
        st = DB.one("SELECT count(*) AS listed,min(price) AS floor FROM nft_items WHERE coll_id=? AND listed", L(c, "id"))
        colls.append({"id": L(c, "id"), "name": S(c, "name"), "glyph": S(c, "glyph"), "supply": L(c, "supply"),
                      "minted": L(c, "minted"), "floor": L(st, "floor"), "listed": L(st, "listed")})
    return {"items": nft_items("listed"), "gifts": [], "colls": colls, "balance": L(me, "balance")}


@route("GET", "/api/fragment")
def fragment(r):
    me = r.me()
    tab = r.qtext("tab") or "usernames"
    q = r.qtext("q").lstrip("@+")
    bal = L(me, "balance")
    if tab == "collectibles":
        return {"tab": tab, "balance": bal, "items": nft_items("listed")}
    if tab == "mine":
        names = DB.query("SELECT * FROM nft_usernames WHERE owner_id=?", L(me, "id"))
        nums = DB.query("SELECT * FROM nft_numbers WHERE owner_id=?", L(me, "id"))
        return {"tab": tab, "balance": bal,
                "usernames": [{"id": L(x, "id"), "handle": S(x, "handle"), "listed": F(x, "listed"), "price": L(x, "list_price"),
                               "value": L(x, "price"), "kind": "username", "active": F(x, "active")} for x in names],
                "numbers": [{"id": L(x, "id"), "number": S(x, "number"), "listed": F(x, "listed"),
                             "price": L(x, "list_price"), "kind": "number"} for x in nums],
                "nfts": nft_items("mine", L(me, "id"))}
    if tab == "usernames":
        rows = DB.query("SELECT * FROM nft_usernames WHERE (listed OR owner_id IS NULL) AND (list_price>0 OR price>0) ORDER BY price,id")
        rows = [x for x in rows if contains(S(x, "handle"), q)][:100]
        return {"tab": tab, "balance": bal, "items": [
            {"id": L(x, "id"), "handle": S(x, "handle"), "price": L(x, "list_price") if F(x, "listed") else L(x, "price"),
             "issued": D(x, "issued"), "value": L(x, "price"), "kind": "username", "pool": x.get("owner_id") is None, "owner": None} for x in rows]}
    if tab == "numbers":
        rows = DB.query("SELECT * FROM nft_numbers WHERE (listed OR owner_id IS NULL) AND (list_price>0 OR price>0) ORDER BY price,id")
        rows = [x for x in rows if q in S(x, "number")][:100]
        return {"tab": tab, "balance": bal, "items": [
            {"id": L(x, "id"), "number": S(x, "number"), "price": L(x, "list_price") if F(x, "listed") else L(x, "price"),
             "kind": "number", "pool": x.get("owner_id") is None, "owner": None} for x in rows]}
    raise ApiError(400, "Неизвестная вкладка")


@route("GET", "/api/wallet")
def wallet(r):
    me = r.me()
    rows = DB.query("SELECT * FROM tx WHERE user_id=? ORDER BY id DESC LIMIT 50", L(me, "id"))
    return {"balance": L(me, "balance"),
            "tx": [{"id": L(x, "id"), "amount": L(x, "amount"), "kind": S(x, "kind"), "note": S(x, "note"), "ts": D(x, "ts")} for x in rows]}


@route("GET", "/api/checks")
def checks(r):
    me = r.me()
    rows = DB.query("SELECT * FROM star_checks WHERE creator_id=? ORDER BY id DESC LIMIT 50", L(me, "id"))
    return {"checks": [{"id": L(x, "id"), "code": S(x, "code"), "amount": L(x, "amount"), "max_uses": L(x, "max_uses"),
                        "used": L(x, "used"), "active": F(x, "active"), "note": S(x, "note"), "created": D(x, "created"),
                        "expires": D(x, "expires"), "left": L(x, "max_uses") - L(x, "used")} for x in rows],
            "balance": L(me, "balance")}


@route("GET", "/api/badges")
def badges(r):
    r.me()
    rows = DB.query("SELECT * FROM badge_defs ORDER BY sort")
    return {"badges": [{"key": S(x, "key"), "title": S(x, "title"), "descr": S(x, "descr"), "color": S(x, "color"),
                        "kind": S(x, "kind"), "icon": S(x, "icon")} for x in rows]}


@route("GET", "/api/bots")
def bots(r):
    me = r.me()
    rows = DB.query("SELECT id,username,name,bot_desc,frozen FROM users WHERE is_bot AND NOT deleted AND bot_owner=?", L(me, "id"))
    return {"bots": [{"id": L(x, "id"), "username": S(x, "username"), "name": S(x, "name"),
                      "desc": S(x, "bot_desc"), "frozen": F(x, "frozen")} for x in rows]}


@route("POST", "/api/report")
def report(r):
    me = r.me()
    b = r.body()
    kind = b.text("kind")
    if kind not in ("user", "chat", "channel", "message"):
        raise ApiError(400, "Неверный тип жалобы")
    reason = b.text("reason")
    if len(reason) < 1 or len(reason) > 50:
        raise ApiError(400, "Неверная причина")
    DB.exec("INSERT INTO reports(reporter_id,tkind,tid,reason,text,ts) VALUES(?,?,?,?,?,?)",
            L(me, "id"), kind, b.number("id"), reason, b.text("text")[:500], now())
    return {"ok": True}


@route("GET", "/api/stories")
def stories(r):
    me = r.me()
    uid = L(me, "id")
    rows = DB.query("SELECT s.user_id,count(*) AS count,max(s.ts) AS last,"
                    "sum(CASE WHEN v.user_id IS NULL THEN 1 ELSE 0 END) AS unseen "
                    "FROM stories s LEFT JOIN story_views v ON v.story_id=s.id AND v.user_id=? "
                    "WHERE s.expires>? GROUP BY s.user_id", uid, now())
    out = []
    for x in rows:
        u = DB.one("SELECT * FROM users WHERE id=? AND NOT deleted", L(x, "user_id"))
        if not u:
            continue
        mine = L(x, "user_id") == uid
        out.append({"user": public_user(u, me), "count": L(x, "count"), "last": D(x, "last"),
                    "unseen": 0 if mine else L(x, "unseen"), "mine": mine})
    return {"stories": out}


@route("POST", "/api/story/create")
def story_create(r):
    me = r.me()
    b = r.body()
    if b.text("kind") != "text":
        raise ApiError(501, "Фотографии историй пока не поддерживаются")
    text = b.text("text").strip()
    if len(text) < 1 or len(text) > 300:
        raise ApiError(400, "Текст истории: 1–300 символов")
    t = now()
    DB.exec("INSERT INTO stories(user_id,kind,text,bg,ts,expires) VALUES(?,'text',?,?,?,?)",
            L(me, "id"), text, max(0, min(12, b.number("bg"))), t, t + 86400)
    FEED.notify()
    return {"ok": True}


@route("GET", "/api/stories/user")
def stories_user(r):
    me = r.me()
    uid = r.qlong("id")
    u = DB.one("SELECT * FROM users WHERE id=? AND NOT deleted", uid)
    if not u:
        raise ApiError(404, "Не найден")
    rows = DB.query("SELECT * FROM stories WHERE user_id=? AND expires>? ORDER BY id", uid, now())
    return {"user": public_user(u, me),
            "stories": [{"id": L(s, "id"), "kind": S(s, "kind"), "text": S(s, "text"), "bg": L(s, "bg"), "ts": D(s, "ts"),
                         "expires": D(s, "expires"), "media_url": "", "viewers": 0, "viewed": False} for s in rows]}


# ───────────────────────── админ ─────────────────────────
def require_admin(r):
    me = r.me()
    if not F(me, "is_admin"):
        raise ApiError(403, "Нет прав администратора")
    return me


@route("GET", "/api/admin/users")
def admin_users(r):
    me = require_admin(r)
    rows = DB.query("SELECT * FROM users WHERE NOT is_service ORDER BY id DESC LIMIT 200")
    return {"users": [public_user(u, me) for u in rows]}


@route("POST", "/api/admin/delete")
def admin_delete(r):
    """Удаление аккаунта: для всех он становится «Удалённый аккаунт» (призрак)."""
    me = require_admin(r)
    uid = r.body().number("user_id")
    u = DB.one("SELECT * FROM users WHERE id=?", uid)
    if not u or F(u, "is_service"):
        raise ApiError(404, "Пользователь не найден")
    if uid == L(me, "id"):
        raise ApiError(400, "Нельзя удалить самого себя")
    if F(u, "is_admin"):
        raise ApiError(403, "Нельзя удалить администратора")
    with DB.tx():
        DB.exec("UPDATE users SET deleted=1,name='Удалённый аккаунт',first_name='Удалённый',last_name='аккаунт',"
                "phone=NULL,username=NULL,avatar='',avv=avv+1,bio='',cloud_hash='',cloud_salt='',cloud_hint='',"
                "last_seen=0,nft_number=NULL,banner_color=-1,banner_pattern='',emoji_status='' WHERE id=?", uid)
        DB.exec("DELETE FROM sessions WHERE user_id=?", uid)
        DB.exec("DELETE FROM pending_passwords WHERE user_id=?", uid)
        DB.exec("DELETE FROM members WHERE user_id=? AND chat_id IN (SELECT id FROM chats WHERE kind IN ('group','channel') AND owner<>?)", uid, uid)
    FEED.notify()
    return {"ok": True}


# ───────────────────────── HTTP ─────────────────────────
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "GodGramPy/1.0"

    def log_message(self, fmt, *args):
        if os.environ.get("GODGRAM_LOG"):
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")

    def _send(self, status, body, ctype, extra=None):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status, obj):
        self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8",
                   {"Cache-Control": "no-store"})

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_HEAD(self):
        self._dispatch("GET")

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    do_PUT = do_POST
    do_DELETE = do_POST

    def _dispatch(self, method):
        url = urlparse(self.path)
        path = url.path
        req = Req(self, method, path, parse_qs(url.query))
        try:
            if path.startswith("/api/") or path == "/api":
                fn = ROUTES.get((method, path))
                if path == "/api/health":
                    return self._json(200, {"ok": True, "database": "SQLite", "backend": "Python"})
                if fn is None:
                    req.me()
                    return self._json(501, {"error": "Эта функция ещё не реализована на сервере", "path": path})
                return self._json(200, fn(req))
            if method == "GET" and path.startswith("/av/"):
                return self._avatar(path)
            if method == "GET":
                return self._static(path)
            self._json(404, {"error": "Не найдено"})
        except ApiError as e:
            self._json(e.status, {"error": e.reason})
        except sqlite3.IntegrityError:
            self._json(409, {"error": "Конфликт данных"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa
            sys.stderr.write(f"Unhandled error on {path}: {e!r}\n")
            try:
                self._json(500, {"error": "Ошибка сервера"})
            except Exception:
                pass

    def _avatar(self, path):
        m = re.fullmatch(r"/av/([uc])/(\d+)", path)
        if not m:
            return self._json(404, {"error": "Не найдено"})
        table = "users" if m.group(1) == "u" else "chats"
        row = DB.one(f"SELECT avatar FROM {table} WHERE id=?", int(m.group(2)))
        av = S(row, "avatar") if row else ""
        if not av.startswith("data:image/") or "," not in av:
            return self._json(404, {"error": "Не найдено"})
        head, data = av.split(",", 1)
        mime = head[5:].split(";")[0]
        if mime not in ("image/png", "image/webp", "image/jpeg", "image/gif"):
            return self._json(404, {"error": "Не найдено"})
        import base64
        try:
            raw = base64.b64decode(data, validate=False)
        except Exception:
            return self._json(404, {"error": "Не найдено"})
        self._send(200, raw, mime, {"Cache-Control": "public, max-age=31536000, immutable"})

    def _static(self, path):
        if path in ("/", ""):
            self.send_response(302)
            self.send_header("Location", "/app")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        rel = "app.html" if path == "/app" else unquote(path).lstrip("/")
        f = (WWWROOT / rel).resolve()
        if WWWROOT.resolve() not in f.parents and f != WWWROOT.resolve() or not f.is_file():
            return self._json(404, {"error": "Не найдено"})
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self._send(200, f.read_bytes(), ctype, {"Cache-Control": "no-cache"})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for i in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not i.startswith("127."):
                ips.add(i)
    except OSError:
        pass
    return sorted(ips)


def main():
    global DB, DEV_CODES, OWNER_PHONE, WWWROOT, BOT
    ap = argparse.ArgumentParser(description="GodGram Python server (SQLite)")
    ap.add_argument("--host", default=os.environ.get("GODGRAM_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("GODGRAM_PORT", "8080")))
    ap.add_argument("--lan", action="store_true", help="слушать на всех интерфейсах (0.0.0.0): доступ по Wi-Fi")
    ap.add_argument("--db", default=os.environ.get("GODGRAM_SQLITE", str(BASE_DIR / "godgram.sqlite3")))
    ap.add_argument("--wwwroot", default=os.environ.get("GODGRAM_WWWROOT", str(WWWROOT)))
    ap.add_argument("--admin", metavar="PHONE", help="выдать права админа существующему пользователю и выйти")
    ap.add_argument("--bot-token", default=os.environ.get("GODGRAM_BOT_TOKEN", ""), help="токен Telegram-бота: коды входа приходят в бота")
    ap.add_argument("--tg-api", default=os.environ.get("GODGRAM_TG_API", "https://api.telegram.org"))
    ap.add_argument("--no-dev-codes", action="store_true", help="не показывать код входа (нужен свой SMS-провайдер)")
    a = ap.parse_args()

    WWWROOT = Path(a.wwwroot).resolve()
    dev_env = os.environ.get("GODGRAM_DEV_CODES")
    DEV_CODES = not a.no_dev_codes and ((dev_env == "1") if dev_env is not None else not a.bot_token)
    OWNER_PHONE = re.sub(r"\D", "", os.environ.get("GODGRAM_OWNER_PHONE", ""))
    DB = Db(a.db)
    DB.init()

    if a.admin:
        phone = re.sub(r"\D", "", a.admin)
        if not DB.one("SELECT id FROM users WHERE phone=?", phone):
            print(f"Пользователь с номером {phone} не найден. Сначала зарегистрируйся в приложении.")
            return 1
        DB.exec("UPDATE users SET is_admin=1 WHERE phone=?", phone)
        print(f"Готово: +{phone} теперь администратор.")
        return 0

    if not (WWWROOT / "app.html").is_file():
        print(f"Не найден {WWWROOT / 'app.html'}. Положи папку wwwroot рядом с godgram_server.py.")
        return 1

    if a.bot_token:
        BOT = TelegramBot(a.bot_token.strip(), a.tg_api)
        try:
            BOT.start()
        except Exception as e:  # noqa
            print(f"Не удалось подключиться к Telegram-боту: {e}")
            print("Проверь токен и доступ к api.telegram.org (при блокировке укажи прокси/зеркало: --tg-api).")
            return 1

    host = "0.0.0.0" if a.lan else a.host
    try:
        srv = Server((host, a.port), Handler)
    except OSError as e:
        print(f"Не удалось занять {host}:{a.port}: {e}")
        return 1
    print("GodGram (Python + SQLite)")
    print(f"  База: {a.db}")
    print(f"  Открой: http://127.0.0.1:{a.port}/app")
    if host == "0.0.0.0":
        for ip in lan_ips():
            print(f"  По Wi-Fi / для APK и IPA: http://{ip}:{a.port}")
    if BOT:
        print(f"  Коды входа: Telegram-бот @{BOT.username} (пользователь открывает бота, жмёт Start и делится номером)")
    if DEV_CODES:
        print("  Режим DEV: код входа показывается на экране и здесь. Не выставляй сервер в интернет в таком режиме.")
    if OWNER_PHONE:
        print(f"  Админ при регистрации: +{OWNER_PHONE}")
    print("  Остановить: Ctrl+C", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлен.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
