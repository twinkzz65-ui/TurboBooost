/* GodGram mobile: приложение лежит внутри телефона, а сервер — по сети.
   Этот файл переписывает относительные адреса (/api/..., /av/...) на адрес сервера. */
(function () {
  window.GG_MOBILE = true;
  var KEY = 'gg_server';

  function normalize(v) {
    v = (v || '').trim().replace(/\/+$/, '');
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) {
      var local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v) || /^[\d.]+(:\d+)?$/.test(v);
      v = (local ? 'http://' : 'https://') + v;
    }
    return v;
  }
  function stored() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  var base = normalize(stored() || window.GG_DEFAULT_SERVER);
  window.GG_BASE = base;

  function fix(u) {
    return (base && typeof u === 'string' && u.charAt(0) === '/' && u.charAt(1) !== '/') ? base + u : u;
  }

  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = fix(input);
    else if (input && input.url && input.url.indexOf(location.origin + '/') === 0 && base) {
      input = new Request(base + input.url.slice(location.origin.length), input);
    }
    return nativeFetch(input, init);
  };

  // картинки/аудио/видео: аватарки приходят как "/av/u/1"
  var MEDIA = { IMG: 1, SOURCE: 1, VIDEO: 1, AUDIO: 1 };
  var nativeSet = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (n === 'src' && MEDIA[this.tagName]) v = fix(v);
    return nativeSet.call(this, n, v);
  };
  [HTMLImageElement, HTMLSourceElement, HTMLMediaElement].forEach(function (C) {
    var d = Object.getOwnPropertyDescriptor(C.prototype, 'src');
    if (!d || !d.set) return;
    Object.defineProperty(C.prototype, 'src', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, fix(v)); }
    });
  });

  window.ggChangeServer = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  };

  function loadApp() {
    (window.GG_SCRIPTS || []).forEach(function (p) {
      var s = document.createElement('script');
      s.src = p; s.async = false;
      document.body.appendChild(s);
    });
  }

  function askServer() {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#17212b;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,sans-serif';
    box.innerHTML =
      '<div style="width:100%;max-width:360px;text-align:center">' +
      '<div style="font-size:30px;font-weight:700;margin-bottom:8px">GodGram</div>' +
      '<div style="opacity:.7;font-size:14px;line-height:1.4;margin-bottom:18px">Введите адрес сервера GodGram, например<br>https://chat.example.com или 192.168.1.10:8080</div>' +
      '<input id="ggSrv" type="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Адрес сервера" style="width:100%;box-sizing:border-box;padding:14px;border-radius:12px;border:1px solid #2b3a4a;background:#0e1621;color:#fff;font-size:16px;outline:none">' +
      '<div id="ggErr" style="color:#ff6b6b;font-size:13px;min-height:18px;margin:10px 0"></div>' +
      '<button id="ggGo" style="width:100%;padding:14px;border:0;border-radius:12px;background:#6b5cff;color:#fff;font-size:16px;font-weight:600">Продолжить</button>' +
      '</div>';
    document.body.appendChild(box);
    var inp = box.querySelector('#ggSrv'), err = box.querySelector('#ggErr'), btn = box.querySelector('#ggGo');
    async function go() {
      var v = normalize(inp.value);
      if (!v) { err.textContent = 'Введите адрес'; return; }
      err.textContent = ''; btn.disabled = true; btn.textContent = 'Проверяю…';
      var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
      try {
        var r = await nativeFetch(v + '/api/health', { signal: ctl.signal });
        var j = await r.json();
        if (!j || j.ok !== true) throw new Error('bad');
        try { localStorage.setItem(KEY, v); } catch (e) {}
        base = v; window.GG_BASE = v;
        box.remove(); loadApp();
      } catch (e) {
        err.textContent = 'Сервер не отвечает. Проверьте адрес и что сервер запущен.';
        btn.disabled = false; btn.textContent = 'Продолжить';
      } finally { clearTimeout(t); }
    }
    btn.onclick = go;
    inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    inp.focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (base) loadApp(); else askServer();
  });
})();
