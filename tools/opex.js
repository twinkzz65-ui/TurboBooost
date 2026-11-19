/* ===== OPEX-LIST: логика экрана «Чаты» (шапка-стопка, счётчики папок, баннер, значок «без звука») ===== */
(function(){
  var MUTE = '<svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 8v2.2l2.4 2.4c.07-.2.1-.4.1-.6zM19 12c0 .9-.2 1.7-.5 2.5l1.5 1.5A8.8 8.8 0 0 0 21 12a9 9 0 0 0-6-8.5v2.1A7 7 0 0 1 19 12zM4.3 3L3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3c-.7.5-1.4.9-2.3 1.1v2.1a9 9 0 0 0 3.6-1.8l2 2 1.3-1.3-9-9zM12 4L9.9 6.1 12 8.2z"/></svg>';
  var CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  function g(id){ return document.getElementById(id); }
  function bdKey(){ return 'vexis_bd_hide_' + (me ? me.id : 0); }
  function accounts(){
    var out = [];
    try{ var a = JSON.parse(localStorage.getItem('vexis_accounts') || '[]'); if(Array.isArray(a)) out = a; }catch(_){}
    return out.filter(function(u){ return u && me && u.id !== me.id; }).slice(0, 2);
  }
  function avHtml(u){
    if(u.avatar_data) return '<img src="' + u.avatar_data + '" alt="">';
    var ini = ((u.display_name || u.username || '?') + '').slice(0, 2).toUpperCase();
    return '<div style="background:' + (u.avatar_color || '#44576d') + '">' + ini + '</div>';
  }
  var stackSig = '';
  function header(){
    if(!me) return;
    var l = document.querySelector('#screen-list .header-left'); if(!l) return;
    var accs = [me].concat(accounts());
    var sig = accs.map(function(u){ return u.id + (u.avatar_data ? 'a' : '') + (u.avatar_color || ''); }).join('|') + document.title;
    if(sig === stackSig && l.querySelector('.ox-stack')) return;
    stackSig = sig;
    l.innerHTML = '<div class="ox-stack">' + accs.map(function(u){ return '<div class="ox-av">' + avHtml(u) + '</div>'; }).join('') + '</div><span class="logo">Vexis</span>';
  }
  function post(chats){
    header();
    var box = g('chatList'); if(!box) return;
    var byId = {}; (chats || []).forEach(function(c){ byId[c.id] = c; });
    box.querySelectorAll('.chat-item').forEach(function(el){
      var c = byId[+el.dataset.id]; if(!c) return;
      var muted = !!(c.muted || (typeof isMuted === 'function' && isMuted(c.id)));
      if(c.unread > 0 && !muted) el.classList.add('unm');
      if(muted){
        var row = el.querySelector('.chat-name-row');
        if(row && !row.querySelector('.ox-mute')){ var s = document.createElement('span'); s.className = 'ox-mute'; s.innerHTML = MUTE; row.appendChild(s); }
      }
    });
    // баннер «Укажите день рождения»
    var old = g('oxBd'); if(old) old.remove();
    var hide = false; try{ hide = !!localStorage.getItem(bdKey()); }catch(_){}
    if(me && !me.birthday && !hide && (chats || []).length){
      var b = document.createElement('div'); b.id = 'oxBd'; b.className = 'ox-bd';
      b.innerHTML = '<div class="t"><b>Укажите свой день рождения! 🎂</b><span>Контакты будут знать, когда Вас поздравить.</span></div><div class="x" id="oxBdX">' + CLOSE + '</div>';
      box.insertBefore(b, box.firstChild);
      g('oxBdX').onclick = function(e){ e.stopPropagation(); try{ localStorage.setItem(bdKey(), '1'); }catch(_){} b.remove(); };
      b.onclick = function(){ var t = document.querySelector('#tabBar .nav-item[data-tab="profile"]'); if(t) t.click(); };
    }
  }
  var prev = renderChatList;
  renderChatList = function(c){ prev(c); post(c); };
  window.vxOpexHeader = header;
})();
