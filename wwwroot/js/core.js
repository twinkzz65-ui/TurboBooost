const $=s=>document.querySelector(s);
const GHOST='<svg viewBox="0 0 24 24" width="62%" height="62%"><path fill="#fff" d="M12 2C8.1 2 5 5.1 5 9v11.2c0 .6.7.9 1.1.5l1.6-1.5c.3-.3.8-.3 1.1 0l1.8 1.7c.3.3.8.3 1.1 0l1.8-1.7c.3-.3.8-.3 1.1 0l1.6 1.5c.4.4 1.1.1 1.1-.5V9c0-3.9-3.1-7-7-7z"/></svg>';
const LOGO='<svg viewBox="0 0 24 24" width="62%" height="62%"><ellipse cx="12" cy="3.9" rx="5.2" ry="1.5" fill="none" stroke="#ffd86b" stroke-width="1.3"/><path d="M16.9 10.1A6.4 6.4 0 1 0 18.4 14.2H12.6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SEND_LOGO='<svg viewBox="0 0 24 24" width="70%" height="70%"><path d="M5.5 12.5l4.8 4.8 8.4-9.6" fill="none" stroke="#1a1400" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18.2" cy="6.2" r="3.4" fill="#fff"/><path d="M18.2 4.4l.55 1.2 1.3.18-1 .95.24 1.28-1.09-.6-1.09.6.24-1.28-1-.95 1.3-.18z" fill="#f0a500"/></svg>';
const OSINT_LOGO='<svg viewBox="0 0 24 24" width="70%" height="70%"><circle cx="10.2" cy="10.2" r="6.4" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M15 15l5.2 5.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="10.2" cy="10.2" r="2.2" fill="#fff" opacity=".4"/></svg>';
const STAR='<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-0.14em"><path fill="url(#pg)" d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.5 6.8L12 17l-6.2 3.5 1.5-6.8L2.2 9l6.9-.7z"/></svg>';
const BIGSTAR='<svg viewBox="0 0 24 24" width="60%" height="60%"><path fill="#fff" d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.5 6.8L12 17l-6.2 3.5 1.5-6.8L2.2 9l6.9-.7z"/></svg>';
let token=localStorage.getItem('tok')||sessionStorage.getItem('tok')||'',me=null,chats=[],cur=null,ver=0,pollId=0,seenLast={},firstLoad=true;
let muted=JSON.parse(localStorage.getItem('muted')||'{}');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function h(t,a={},...c){const e=document.createElement(t);
 for(const k in a){const v=a[k];if(v==null||v===false)continue;
  if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
  else if(k==='html')e.innerHTML=v;else e.setAttribute(k,v===true?'':v);}
 c.flat(9).forEach(x=>{if(x==null||x===false)return;e.append(x.nodeType?x:document.createTextNode(x));});return e;}
// безопасная замена содержимого: понимает массивы и пропускает null
function setKids(el,...k){el.replaceChildren(...k.flat(9).filter(x=>x!=null&&x!==false));}

async function post(path,body){
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Ошибка');return j;}
async function api(path,body){
 const o={headers:{'Authorization':'Bearer '+token}};
 if(body!==undefined){o.method='POST';o.headers['Content-Type']='application/json';o.body=JSON.stringify(body);}
 const r=await fetch(path,o);const j=await r.json().catch(()=>({}));
 if(r.status===401){logout(true);throw new Error('auth');}
 if(!r.ok)throw new Error(j.error||'Ошибка');return j;}
async function refreshMe(){const j=await api('/api/me');me=j.me;}

function toast(t,fn){const e=h('div',{id:'toast',onclick:()=>{e.remove();fn&&fn();}},t);
 document.querySelectorAll('#toast').forEach(x=>x.remove());document.body.append(e);setTimeout(()=>e.remove(),3500);}

function color(s){let x=0;for(const ch of s||'?')x=(x*31+ch.charCodeAt(0))>>>0;return `hsl(${x%360},45%,42%)`;}
function av(o,size=48){
 const d=h('div',{class:'av'});d.style.width=d.style.height=size+'px';d.style.fontSize=(size*.42)+'px';
 if(o.deleted){d.classList.add('ghost');d.innerHTML=GHOST;}
 else if(o.service){d.classList.add('svc');d.innerHTML=LOGO;}
 else if(o.avatar_url){d.append(h('img',{src:o.avatar_url,loading:'lazy'}));}
 else if(o.username==='send'||(o.name==='Send'&&o.is_bot)){d.classList.add('bot-send');d.innerHTML=SEND_LOGO;}
 else if(o.username==='osint'||(o.name==='OSINT'&&o.is_bot)){d.classList.add('bot-osint');d.innerHTML=OSINT_LOGO;}
 else{const nm=(o.name||o.title||'?').trim();d.style.background=color(nm);d.textContent=([...nm][0]||'?').toUpperCase();}
 return d;}
const pad=n=>String(n).padStart(2,'0');
function fmtTime(ts){const d=new Date(ts*1000),n=new Date();
 if(d.toDateString()===n.toDateString())return pad(d.getHours())+':'+pad(d.getMinutes());
 return pad(d.getDate())+'.'+pad(d.getMonth()+1);}
function fmtDT(t){const d=new Date(t*1000);return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
function nftNameEl(x,u){
 if(!x.nft)return h('span',{class:'acc'},'@'+x.handle);
 return h('span',{class:'acc',style:'cursor:pointer',onclick:e=>{e.stopPropagation();nftNameInfo(x,u);}},'@'+x.handle);}
function nftNameInfo(x,u){
 const ov=h('div',{class:'overlay dim',style:'z-index:80',onclick:e=>{if(e.target===ov)ov.remove();}});
 const line=(l,v)=>h('div',{style:'display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-top:1px solid #2c3e50'},h('span',{class:'sub'},l),h('b',{style:'text-align:right'},v));
 ov.append(h('div',{style:'background:#17212b;border-radius:18px;padding:22px;max-width:340px;width:100%'},
  h('div',{style:'font-size:22px;font-weight:600;margin-bottom:4px'},'@'+x.handle),
  h('div',{class:'sub',style:'margin-bottom:12px'},'NFT-юзернейм'),
  line('Цена',x.price>0?x.price.toLocaleString('ru-RU')+' ⭐':'не указана'),
  line('Выдан',x.issued>0?fmtDT(x.issued):'—'),
  line('Владелец',u.name),
  h('button',{class:'btn',style:'margin-top:14px',onclick:()=>ov.remove()},'Закрыть')));
 document.body.append(ov);}
function premDate(t){if(t>3e10)return 'навсегда';const d=new Date(t*1000);return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();}
function status(u){
 if(u.service)return 'служебные уведомления';
 if(u.is_bot)return u.frozen?'бот · заморожен ❄️':'бот';
 if(u.deleted||!u.last_seen)return 'был(а) давно';
 if(u.online)return 'в сети';
 const s=Date.now()/1000-u.last_seen;
 if(s<120)return 'был(а) только что';
 if(s<3600)return 'был(а) '+Math.floor(s/60)+' мин. назад';
 if(s<86400)return 'был(а) '+Math.floor(s/3600)+' ч. назад';
 if(s<172800)return 'был(а) вчера';
 return 'был(а) давно';}

/* ---------- v6: метки (верификации, СКАМ/ФЕЙК) ---------- */
function badgeInfo(b){
 const ov=h('div',{class:'overlay dim'});
 ov.append(h('div',{class:'modal',style:'text-align:center;max-width:360px'},
  b.key==='owner'?(()=>{const d=h('div',{style:'width:72px;height:72px;margin:0 auto 12px'});d.innerHTML=OWNER_SVG;return d;})()
  :h('div',{style:'width:72px;height:72px;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:'+(b.icon.length>2?'16':'34')+'px;font-weight:700;color:#fff;background:'+b.color},b.icon),
  h('h3',{},b.title),h('div',{class:'sub',style:'font-size:14px;line-height:1.4;margin-bottom:6px'},b.descr),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Понятно')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}
function nftStatusEl(s,big){
 const e=h('span',{class:'nfts'+(big?' big':''),title:s.name,style:'background:radial-gradient(circle at 40% 35%,'+s.c1+','+s.c2+')'});
 if(String(s.glyph).startsWith('svg:'))e.append(artEl(s.glyph));else e.textContent=s.glyph;
 if(!big)e.style.fontSize='.8em';return e;}
function statusEl(v,size){
 size=size||20;
 if(!v)return '';
 const s=String(v).trim();
 if(/^data:image\//i.test(s))
  return h('img',{class:'stimg',src:s,alt:'',draggable:'false',
   style:'width:'+size+'px;height:'+size+'px;border-radius:6px;object-fit:cover;vertical-align:middle;display:inline-block'});
 return s;}
const OWNER_SVG='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#000" stroke="#6b7785" stroke-width="1.2"/><path d="M9.6 8.6 6.2 12l3.4 3.4M14.4 8.6 17.8 12l-3.4 3.4M13 7.6l-2 8.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function ownerIcon(b,style){const e=h('span',{class:'vb own',style:style||'',title:b.title,onclick:ev=>{ev.stopPropagation();badgeInfo(b);}});e.innerHTML=OWNER_SVG;return e;}
function ownerEl(u){const b=(u.badges||[]).find(x=>x.key==='owner');return b?ownerIcon(b,'margin-right:6px'):null;}
function badge(u,noOwner){
 if(!u||u.deleted)return null;
 const out=[];
 (u.badges||[]).filter(b=>!(noOwner&&b.key==='owner')).forEach(b=>b.key==='owner'?out.push(ownerIcon(b)):out.push(b.kind==='label'
  ?h('span',{class:'vlabel',style:'background:'+b.color,title:b.title,onclick:e=>{e.stopPropagation();badgeInfo(b);}},b.icon)
  :h('span',{class:'vb',style:'background:'+b.color,title:b.title,onclick:e=>{e.stopPropagation();badgeInfo(b);}},b.icon)));
 if(u.service)out.push(h('span',{style:'color:#2aabee;margin-left:4px'},'✔'));
 else if(u.is_bot)out.push(h('span',{class:'bt'},'БОТ'));
 else if(u.status_nft)out.push(nftStatusEl(u.status_nft));
 else if(u.emoji_status)out.push(h('span',{class:'pb'},statusEl(u.emoji_status,20)));
 else if(u.estatus)out.push(h('span',{class:'pb'},statusEl(u.estatus,20)));
 else if(u.premium){const s=h('span',{class:'pb'});s.innerHTML=STAR;out.push(s);}
 return out.length?h('span',{class:'bw'},out):null;}
const hasLabel=(u,k)=>!!(u&&(u.badges||[]).some(b=>b.key===k));
function warnEl(u){
 if(!u)return null;
 const bs=(u.badges||[]).filter(b=>b.kind==='label');
 return bs.length?bs.map(b=>h('div',{class:'pwarn',style:'background:'+b.color+'26;border:1px solid '+b.color+'80;color:#fff'},h('b',{},'⚠ '+b.title+'. '),b.descr)):null;}

/* ---------- закрепы и жалобы ---------- */
async function togglePin(c){
 try{await api('/api/pin',{chat_id:c.id,on:!c.pinned});await loadChats();toast(c.pinned?'Откреплено':'Закреплено 📌');}catch(e){toast(e.message);}}
function reportDialog(kind,id,name){
 const ov=h('div',{class:'overlay dim'});let reason='spam';
 const R=[['spam','Спам'],['scam','Мошенничество'],['fake','Выдаёт себя за другого'],['violence','Насилие'],['porn','Порнография'],['copyright','Нарушение авторских прав'],['other','Другое']];
 const txt=h('textarea',{class:'inp',rows:3,placeholder:'Комментарий (необязательно)',maxlength:500}),err=h('div',{class:'err'});
 ov.append(h('div',{class:'modal'},h('h3',{},'🚩 Пожаловаться'),h('div',{class:'sub',style:'margin-bottom:8px'},name||''),
  h('div',{class:'rep'},R.map(([k,t],i)=>h('label',{},h('input',{type:'radio',name:'rr',class:'ck',checked:i===0,onchange:()=>reason=k}),t))),txt,err,
  h('button',{class:'btn red',onclick:async()=>{try{await api('/api/report',{kind,id,reason,text:txt.value});ov.remove();toast('Жалоба отправлена админу');}catch(e){err.textContent=e.message;}}},'Отправить жалобу'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

