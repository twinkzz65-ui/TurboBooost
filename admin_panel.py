#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Админ-панель Vexis — отдельное локальное приложение (только стандартная библиотека).

Запуск:   python admin_panel.py
Открыть:  http://127.0.0.1:8099

Панель слушает ТОЛЬКО 127.0.0.1 и ходит на ваш сервер (локальный или на Render) по API /api/panel/*,
подставляя ключ админки на своей стороне — браузер ключ не видит.

Настройка (любой способ):
  python admin_panel.py --server https://vexis.onrender.com --key КЛЮЧ     (сохранится в panel.local.json)
  или переменные SERVER_URL и ADMIN_KEY
Ключ: переменная ADMIN_KEY на сервере (на Render задайте её в Environment),
      либо на локальном сервере:  python server.py adminkey
"""
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
CFG_FILE = os.path.join(BASE, "panel.local.json")
PANEL_PORT = int(os.environ.get("PANEL_PORT", "8099"))
CFG = {"server": "http://127.0.0.1:8080", "key": ""}


def load_cfg(argv):
    try:
        with open(CFG_FILE, encoding="utf-8") as f:
            CFG.update(json.load(f))
    except (OSError, ValueError):
        pass
    if os.environ.get("SERVER_URL"):
        CFG["server"] = os.environ["SERVER_URL"]
    if os.environ.get("ADMIN_KEY"):
        CFG["key"] = os.environ["ADMIN_KEY"]
    changed = False
    for i, a in enumerate(argv):
        if a == "--server" and i + 1 < len(argv):
            CFG["server"], changed = argv[i + 1], True
        if a == "--key" and i + 1 < len(argv):
            CFG["key"], changed = argv[i + 1], True
    CFG["server"] = CFG["server"].rstrip("/")
    if not CFG["key"]:
        try:
            CFG["key"], changed = input("Ключ админ-панели (ADMIN_KEY): ").strip(), True
        except EOFError:
            pass
    if changed:
        with open(CFG_FILE, "w", encoding="utf-8") as f:
            json.dump(CFG, f, ensure_ascii=False)
        try:
            os.chmod(CFG_FILE, 0o600)
        except OSError:
            pass


def call_server(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(CFG["server"] + path, data=data, method=method,
                                 headers={"Content-Type": "application/json", "X-Admin-Key": CFG["key"]})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # noqa
        return 502, json.dumps({"error": "Сервер недоступен (%s): %s" % (CFG["server"], e)}).encode("utf-8")


class H(BaseHTTPRequestHandler):
    server_version = "VexisPanel/1.0"

    def log_message(self, *a):
        pass

    def _out(self, code, data, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(data)

    def _guard(self):
        """Защита от DNS-rebinding и чужих сайтов: только localhost и только свой Origin."""
        host = (self.headers.get("Host") or "").split(":")[0]
        if host not in ("127.0.0.1", "localhost"):
            self._out(403, b'{"error":"forbidden"}')
            return False
        org = self.headers.get("Origin")
        if org and urlparse(org).hostname not in ("127.0.0.1", "localhost"):
            self._out(403, b'{"error":"forbidden"}')
            return False
        return True

    def do_GET(self):
        if not self._guard():
            return
        u = urlparse(self.path)
        if u.path in ("/", "/index.html"):
            return self._out(200, PAGE.encode("utf-8"), "text/html; charset=utf-8")
        if u.path.startswith("/p/"):
            code, data = call_server("GET", "/api/panel/" + u.path[3:] + ("?" + u.query if u.query else ""))
            return self._out(code, data)
        if u.path == "/cfg":
            return self._out(200, json.dumps({"server": CFG["server"]}).encode("utf-8"))
        self._out(404, b'{"error":"not found"}')

    def do_POST(self):
        if not self._guard():
            return
        u = urlparse(self.path)
        if not u.path.startswith("/p/") or self.headers.get("X-Panel") != "1":
            return self._out(403, b'{"error":"forbidden"}')
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._out(400, b'{"error":"bad json"}')
        code, data = call_server("POST", "/api/panel/" + u.path[3:], body)
        self._out(code, data)


PAGE = r'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vexis · админ-панель</title>
<style>
:root{--bg:#0f1115;--card:#171a21;--line:#262b36;--fg:#e8eaf0;--mut:#8b93a7;--acc:#4c9bff;--ok:#3ecf8e;--bad:#ff6b6b;--warn:#f5b84b}
@media(prefers-color-scheme:light){:root{--bg:#f4f5f8;--card:#fff;--line:#e2e5ec;--fg:#1b1f2a;--mut:#6a7388}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,Segoe UI,Roboto,sans-serif}
header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:5}
h1{font-size:17px;margin:0}.srv{color:var(--mut);font-size:12px;margin-left:auto}
nav{display:flex;gap:4px}nav button{background:none;border:0;color:var(--mut);padding:7px 12px;border-radius:8px;cursor:pointer;font:inherit}
nav button.on{background:var(--card);color:var(--fg);box-shadow:0 0 0 1px var(--line)}
main{max-width:1180px;margin:0 auto;padding:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.k{color:var(--mut);font-size:12px}.v{font-size:24px;font-weight:600;margin-top:2px}
input,select{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit}
input[type=search]{width:100%;max-width:360px}
table{width:100%;border-collapse:collapse;margin-top:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--mut);font-weight:500;font-size:12px}
tr:last-child td{border-bottom:0}.wrap{overflow-x:auto}
.chip{display:inline-block;padding:2px 9px;border-radius:99px;border:1px solid var(--line);color:var(--mut);cursor:pointer;font-size:12px;user-select:none;margin-right:4px}
.chip.on{color:#fff;border-color:transparent}.chip.verified.on{background:var(--acc)}.chip.grib.on{background:var(--ok)}.chip.scam.on{background:var(--bad)}.chip.frozen.on{background:#6bc7ff;color:#04223a}.chip.premium.on{background:var(--warn);color:#2b1c00}
button.b{background:var(--acc);border:0;color:#fff;border-radius:8px;padding:7px 12px;cursor:pointer;font:inherit}button.b.g{background:var(--card);color:var(--fg);border:1px solid var(--line)}button.b.r{background:var(--bad)}
#toast{position:fixed;right:18px;bottom:18px;background:var(--card);border:1px solid var(--line);padding:10px 14px;border-radius:10px;opacity:0;transition:.2s;pointer-events:none}#toast.on{opacity:1}#toast.err{border-color:var(--bad)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mut{color:var(--mut)}.perm{margin-right:10px;white-space:nowrap}
</style></head><body>
<header><h1>Vexis · админ-панель</h1>
<nav><button data-t="dash" class="on">Обзор</button><button data-t="users">Пользователи</button><button data-t="admins">Админы</button></nav>
<span class="srv" id="srv"></span></header>
<main id="m"></main><div id="toast"></div>
<script>
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(t,err){const e=$('#toast');e.textContent=t;e.className='on'+(err?' err':'');clearTimeout(toast.h);toast.h=setTimeout(()=>e.className='',2600)}
async function api(path,body){
  const o=body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Panel':'1'},body:JSON.stringify(body)};
  const r=await fetch('/p/'+path,o);let d={};try{d=await r.json()}catch(e){}
  if(!r.ok){toast(d.error||('Ошибка '+r.status),1);throw new Error(d.error||r.status)}return d}
const ago=t=>{if(!t)return'—';const s=Math.floor(Date.now()/1000)-t;if(s<60)return'онлайн';if(s<3600)return Math.floor(s/60)+' мин назад';if(s<86400)return Math.floor(s/3600)+' ч назад';return Math.floor(s/86400)+' дн назад'};
let tab='dash',timer=null;
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));tab=b.dataset.t;render()});
async function render(){clearInterval(timer);if(tab==='dash')return dash();if(tab==='users')return users();return admins()}
async function dash(){
  const draw=async()=>{const s=await api('stats');const L=[['Пользователи','users'],['Онлайн','online'],['Чаты','chats'],['Каналы','channels'],['Группы','groups'],['Сообщения','messages'],['С галочкой','verified'],['Заморожено','frozen'],['Звёзд всего','stars_total'],['NFT-подарки','nft_gifts'],['NFT-юзернеймы','nft_usernames'],['Админы','admins']];
    $('#m').innerHTML='<div class="grid">'+L.map(([n,k])=>`<div class="card"><div class="k">${n}</div><div class="v">${(s[k]||0).toLocaleString('ru')}</div></div>`).join('')+'</div>'};
  try{await draw();timer=setInterval(()=>draw().catch(()=>{}),5000)}catch(e){$('#m').innerHTML='<p class="mut">Нет связи с сервером или неверный ключ. Проверьте настройки (--server / --key).</p>'}}
async function users(q=''){
  $('#m').innerHTML='<div class="row"><input type="search" id="q" placeholder="Поиск: @юзернейм, имя, телефон или id" value="'+esc(q)+'"></div><div class="wrap" id="t"></div>';
  const inp=$('#q');let h;inp.oninput=()=>{clearTimeout(h);h=setTimeout(()=>load(inp.value),250)};inp.focus();load(q);
  async function load(q){const d=await api('users?limit=100&q='+encodeURIComponent(q));
    $('#t').innerHTML='<table><tr><th>id</th><th>Юзернейм</th><th>Имя</th><th>Метки</th><th>⭐</th><th>Был(а)</th><th></th></tr>'+d.users.map(u=>`<tr data-id="${u.id}"><td>${u.id}</td><td>@${esc(u.username)}</td><td>${esc(u.display_name)}</td><td>${['verified','grib','scam','frozen','premium'].map(f=>`<span class="chip ${f}${u[f]?' on':''}" data-f="${f}">${{verified:'галочка',grib:'гриб',scam:'scam',frozen:'заморозка',premium:'premium'}[f]}</span>`).join('')}</td><td class="st">${u.stars||0}</td><td class="mut">${ago(u.last_seen)}</td><td><button class="b g" data-s="100">+100</button> <button class="b g" data-s="-100">−100</button> <button class="b g" data-s="x">±…</button></td></tr>`).join('')+'</table>';
    document.querySelectorAll('.chip').forEach(c=>c.onclick=async()=>{const tr=c.closest('tr'),on=!c.classList.contains('on');await api('user_flag',{id:+tr.dataset.id,flag:c.dataset.f,value:on});c.classList.toggle('on',on);toast('Готово')});
    document.querySelectorAll('button[data-s]').forEach(b=>b.onclick=async()=>{const tr=b.closest('tr');let d=b.dataset.s;if(d==='x'){d=prompt('Сколько звёзд? (минус — списать)','100');if(!d)return}
      const r=await api('stars',{id:+tr.dataset.id,delta:parseInt(d)});tr.querySelector('.st').textContent=r.stars;toast('Баланс: '+r.stars)})}}
async function admins(){
  const d=await api('admins');
  $('#m').innerHTML='<div class="card" style="margin-bottom:14px"><div class="k">Добавить / изменить админа по Telegram ID</div><div class="row" style="margin-top:8px"><input id="nid" placeholder="Telegram ID" inputmode="numeric"><button class="b" id="add">Сохранить права</button></div><div id="np" style="margin-top:8px">'+Object.entries(d.all_perms).map(([k,v])=>`<label class="perm" title="${esc(v)}"><input type="checkbox" value="${k}"> ${k}</label>`).join('')+'</div></div>'+
  '<div class="wrap"><table><tr><th>Telegram ID</th><th>Роль</th><th>Права</th><th></th></tr>'+d.admins.map(a=>`<tr><td>${a.tg_id}</td><td>${a.owner?'владелец':'админ'}</td><td>${a.perms.join(', ')||'—'}</td><td>${a.owner?'':`<button class="b g" data-e="${a.tg_id}" data-p="${a.perms.join(',')}">Изменить</button> <button class="b r" data-d="${a.tg_id}">Убрать</button>`}</td></tr>`).join('')+'</table></div>';
  $('#add').onclick=async()=>{const id=+$('#nid').value;if(!id)return toast('Введите ID',1);await api('admin_set',{tg_id:id,perms:[...document.querySelectorAll('#np input:checked')].map(x=>x.value)});toast('Сохранено');admins()};
  document.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{$('#nid').value=b.dataset.e;const p=b.dataset.p.split(',');document.querySelectorAll('#np input').forEach(x=>x.checked=p.includes(x.value));scrollTo(0,0)});
  document.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{if(!confirm('Убрать админа '+b.dataset.d+'?'))return;await api('admin_remove',{tg_id:+b.dataset.d});admins()})}
fetch('/cfg').then(r=>r.json()).then(c=>$('#srv').textContent='сервер: '+c.server);render();
</script></body></html>'''


def main():
    load_cfg(sys.argv[1:])
    srv = ThreadingHTTPServer(("127.0.0.1", PANEL_PORT), H)
    print("Админ-панель:  http://127.0.0.1:%d   (сервер: %s)" % (PANEL_PORT, CFG["server"]))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено")


if __name__ == "__main__":
    main()
