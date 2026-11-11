/* ================= v5: 3D-подарки, кошелёк, боты, каналы, настройки ================= */
const fmtStars=n=>'⭐ '+(n||0).toLocaleString('ru');

// настоящий 3D на CSS: коробка из 6 граней или эмодзи, выдавленный слоями; можно крутить пальцем
function gift3d(g,size,inter){
 size=size||90;
 const obj=h('div',{class:'g3o'});
 if(g.model==='box'){
  ['f','b','r','l','t','d'].forEach(n=>obj.append(h('div',{class:'gf gf-'+n},n==='t'?h('span',{class:'bow'},g.glyph||'🎀'):null)));
 }else{
  const N=9;
  for(let i=0;i<N;i++){
   const l=h('div',{class:'gl'},String(g.glyph||'').startsWith('svg:')?artEl(g.glyph):(g.glyph||'🎁'));
   l.style.transform='translateZ('+((i-(N-1)/2)*size*.028).toFixed(1)+'px)';
   l.style.filter='brightness('+(0.5+0.5*i/(N-1)).toFixed(2)+')';
   obj.append(l);}
 }
 const w=h('div',{class:'g3 a-'+(g.anim||'spin'),style:'--s:'+size+'px;--c:'+(g.color||'#2aabee')},
  h('div',{class:'g3s'},obj),
  [0,1,2,3].map(i=>h('i',{class:'gsp s'+i},'✦')),h('div',{class:'g3sh'}));
 if(inter){
  let rx=-14,ry=-20,x0=null,y0=null;
  w.style.touchAction='none';w.style.cursor='grab';
  const paint=()=>{obj.style.animation='none';obj.style.transform='rotateX('+rx+'deg) rotateY('+ry+'deg)';};
  w.addEventListener('pointerdown',e=>{x0=e.clientX;y0=e.clientY;paint();try{w.setPointerCapture(e.pointerId);}catch(_){}});
  w.addEventListener('pointermove',e=>{if(x0==null)return;
   ry+=(e.clientX-x0)*.7;rx=Math.max(-80,Math.min(80,rx-(e.clientY-y0)*.5));x0=e.clientX;y0=e.clientY;paint();});
  const up=()=>{x0=null;};w.addEventListener('pointerup',up);w.addEventListener('pointercancel',up);
 }
 return w;}

function giftCard(g){
 return h('div',{class:'gcard',style:'--c:'+g.color,onclick:()=>giftPreview(g)},
  gift3d(g,110),h('div',{class:'gt'},'Подарок «'+g.name+'»'),
  g.number?h('div',{class:'gn'},'№'+g.number+(g.supply?' из '+g.supply:'')):null,
  g.note?h('div',{class:'gnote'},g.note):null);}

function giftPreview(g){
 const ov=h('div',{class:'overlay dim'});
 const canRate=g.owner_id===me.id&&g.from&&g.from.id&&g.from.id!==me.id;
 const rateRow=canRate?h('div',{style:'display:flex;gap:8px;margin:10px 0'},
  h('button',{class:'btn',style:'background:#2d6a4f',onclick:async()=>{
   try{const j=await api('/api/gift/rate',{id:g.id,value:1});ov.remove();toast('👍 +'+j.delta+' к рейтингу отправителя');}catch(e){toast(e.message);}}},'👍 Хороший'),
  h('button',{class:'btn',style:'background:#9b2226',onclick:async()=>{
   try{const j=await api('/api/gift/rate',{id:g.id,value:-1});ov.remove();toast('👎 '+j.delta+' к рейтингу отправителя');}catch(e){toast(e.message);}}},'👎 Плохой')):null;
 ov.append(h('div',{class:'modal',style:'text-align:center;max-width:380px'},
  gift3d(g,220,true),h('h3',{style:'margin-top:6px'},g.name),
  h('div',{class:'sub'},(g.number?'№'+g.number+(g.supply?' из '+g.supply:'')+' · ':'')+'от '+(g.from?g.from.name:'—')),
  g.note?h('div',{style:'margin-top:8px'},g.note):null,
  h('div',{class:'sub',style:'margin:8px 0'},'Покрути подарок пальцем 👆'),
  canRate?h('div',{class:'sub'},'Оцени подарок — это изменит рейтинг отправителя'):null,
  rateRow,
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

const GBTN=h('button',{class:'icon',title:'Подарок',onclick:()=>openGiftShop()},'🎁');

async function openGiftShop(){
 const c=chats.find(x=>x.id===cur);if(!c||c.kind!=='private')return;
 let gifts;try{gifts=(await api('/api/gifts')).gifts;await refreshMe();}catch(e){return toast(e.message);}
 const ov=h('div',{class:'overlay dim'});const m=h('div',{class:'modal',style:'max-width:520px'});
 const close=()=>ov.remove();
 function grid(){
  setKids(m,h('h3',{},'🎁 Подарок для '+c.title),h('div',{class:'sub',style:'margin-bottom:10px'},'Твой баланс: '+fmtStars(me.balance)),
   gifts.length?h('div',{class:'ggrid'},gifts.map(g=>{
    const out=g.supply&&g.sold>=g.supply;
    return h('div',{class:'gitem',style:out?'opacity:.45':'',onclick:()=>{if(!out)pick(g);}},
     gift3d(g,68),h('div',{class:'gt'},g.name),h('div',{class:'gp'},fmtStars(g.price)),
     g.supply?h('div',{class:'gs'},out?'закончились':'осталось '+(g.supply-g.sold)+' из '+g.supply):null);})):h('div',{class:'sub'},'Подарков пока нет'),
   h('button',{class:'btn gray',onclick:close},'Закрыть'));}
 function pick(g){
  const note=h('input',{class:'inp',placeholder:'Подпись (необязательно)',maxlength:200}),err=h('div',{class:'err'});
  const poor=me.balance<g.price;
  setKids(m,h('div',{style:'text-align:center'},gift3d(g,200,true),h('h3',{},g.name),
   h('div',{class:'sub'},'Цена: '+fmtStars(g.price)+' · у тебя '+fmtStars(me.balance))),note,err,
   h('button',{class:'btn',style:poor?'opacity:.5':'',onclick:async()=>{
    if(poor){err.textContent='Недостаточно звёзд. Попроси админа пополнить кошелёк.';return;}
    try{const jr=await api('/api/gift/send',{chat_id:c.id,gift_id:g.id,note:note.value});close();toast('Подарок отправлен 🎁'+(jr.rating_delta?' · рейтинг +'+jr.rating_delta:''));await refreshMe();loadMessages(true);loadChats();}
    catch(e){err.textContent=e.message;}}},'Подарить за '+fmtStars(g.price)),
   h('button',{class:'btn gray',onclick:grid},'← Назад'));}
 grid();ov.append(m);ov.onclick=e=>{if(e.target===ov)close();};document.body.append(ov);}

/* ---------- кошелёк ---------- */

/* ---------- чеки на звёзды (Send) ---------- */
async function showChecks(){
 const ov=h('div',{class:'overlay dim'});const m=h('div',{class:'modal',style:'max-width:440px'});
 const close=()=>ov.remove();
 async function draw(){
  let j;try{j=await api('/api/checks');}catch(e){setKids(m,h('div',{class:'err'},e.message));return;}
  const amt=h('input',{class:'inp',type:'number',min:1,placeholder:'Сумма ⭐ на одну активацию',value:'50'});
  const uses=h('input',{class:'inp',type:'number',min:1,max:1000,placeholder:'Число активаций (1 = один человек)',value:'1'});
  const codeIn=h('input',{class:'inp',placeholder:'Код чека (EQ…)',autocapitalize:'characters'});
  const list=j.checks.length?j.checks.map(c=>h('div',{class:'nrow'},
   h('div',{class:'nh'},h('span',{style:'font-family:monospace;font-weight:700'},c.code),
    h('span',{class:'sub'},c.amount+' ⭐ · '+(c.active?(c.left+' из '+c.max_uses+' ост.'):'закрыт'))),
   h('div',{class:'nact'},
    h('button',{class:'sbtn g',onclick:()=>{try{navigator.clipboard.writeText(c.code);toast('Код скопирован');}catch(e){toast(c.code);}}},'📋'),
    c.active?h('button',{class:'sbtn',onclick:async()=>{
     try{const j2=await api('/api/chat/private',{user_id:(await api('/api/users?q=send')).users.find(u=>u.username==='send').id});
      await api('/api/send',{chat_id:j2.chat_id,text:c.code});close();await loadChats();openChat(j2.chat_id);}
     catch(e){toast(e.message);}}},'В чат'):null))):h('div',{class:'sub'},'Чеков пока нет — создай первый');
  setKids(m,h('h3',{},'⭐ Чеки на звёзды'),
   h('div',{class:'sub',style:'margin-bottom:10px'},'Как Send в Telegram: создаёшь чек → делишься кодом → друг активирует и получает звёзды. Сумма списывается с тебя сразу (сумма × активации).'),
   h('div',{class:'psec',style:'font-size:15px;margin:4px 0 6px'},'Создать чек'),
   amt,uses,
   h('button',{class:'btn',onclick:async()=>{
    try{const r=await api('/api/checks/create',{amount:+amt.value,uses:+uses.value||1});
     toast('Чек '+r.check.code+' создан');await refreshMe();draw();
     try{navigator.clipboard.writeText(r.check.code);}catch(e){}}
    catch(e){toast(e.message);}}},'Создать чек'),
   h('div',{class:'psec',style:'font-size:15px;margin:16px 0 6px'},'Активировать чек'),
   codeIn,
   h('button',{class:'btn',style:'background:#2d6a4f',onclick:async()=>{
    try{const r=await api('/api/checks/claim',{code:codeIn.value});toast('+'+r.amount+' ⭐');await refreshMe();draw();}
    catch(e){toast(e.message);}}},'Получить звёзды'),
   h('div',{class:'psec',style:'font-size:15px;margin:16px 0 6px'},'Мои чеки'),
   list,
   h('div',{class:'sub',style:'margin-top:10px'},'Баланс: '+fmtStars(j.balance)),
   h('button',{class:'btn gray',onclick:close},'Закрыть'));}
 ov.append(m);ov.onclick=e=>{if(e.target===ov)close();};document.body.append(ov);draw();
}


async function showWallet(){
 let j;try{j=await api('/api/wallet');}catch(e){return toast(e.message);}
 const ov=h('div',{class:'overlay dim'});const m=h('div',{class:'modal'});
 const fmtD=ts=>{const d=new Date(ts*1000);return pad(d.getDate())+'.'+pad(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes());};
 async function draw(){
  try{j=await api('/api/wallet');}catch(e){}
  setKids(m,h('h3',{},'👛 Кошелёк'),
   h('div',{class:'wcard'},h('div',{class:'l'},'Баланс'),h('div',{class:'bal'},fmtStars(j.balance))),
   h('button',{class:'btn',onclick:()=>sendStars(()=>{draw();refreshMe();})},'Отправить звёзды'),
   h('button',{class:'btn',style:'background:linear-gradient(90deg,#c9a227,#e8c547);color:#1a1200',onclick:()=>{ov.remove();showChecks();}},'⭐ Чеки (как Send)'),
   h('button',{class:'btn gray',onclick:async()=>{
     try{const u=(await api('/api/users?q=send')).users.find(x=>x.username==='send'||x.is_bot);
      if(!u){const all=await api('/api/users?q=@send');}
      let bot=null;
      const r=await api('/api/users?q=send');
      bot=(r.users||[]).find(x=>x.username==='send');
      if(!bot)return toast('Бот @send не найден');
      const j2=await api('/api/chat/private',{user_id:bot.id});ov.remove();await loadChats();openChat(j2.chat_id);
     }catch(e){toast(e.message);}}},'Открыть бота @send'),
   h('div',{class:'psec',style:'font-size:15px;margin:18px 0 6px'},'История'),
   j.tx.length?j.tx.map(t=>h('div',{class:'tx'},h('div',{},h('div',{},t.note||t.kind),h('div',{class:'sub'},fmtD(t.ts))),
     h('div',{class:t.amount>0?'p':'m2'},(t.amount>0?'+':'')+t.amount+' ⭐'))):h('div',{class:'sub'},'Операций пока нет'),
   h('div',{class:'sub',style:'margin-top:10px'},'Звёзды начисляет администратор или присылают друзья. Их можно тратить на подарки 🎁'),
   h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть'));}
 await draw();ov.append(m);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

function sendStars(done){
 const ov=h('div',{class:'overlay dim'});let to=null,t=0;
 const find=h('input',{class:'inp',placeholder:'Кому: имя, @юзернейм или номер'}),list=h('div'),
  amt=h('input',{class:'inp',type:'number',min:1,placeholder:'Сколько ⭐'}),err=h('div',{class:'err'}),chosen=h('div',{class:'sub'});
 find.oninput=()=>{clearTimeout(t);t=setTimeout(async()=>{const v=find.value.trim();if(!v){setKids(list);return;}
  try{const r=await api('/api/users?q='+encodeURIComponent(v));
   setKids(list,r.users.filter(u=>!u.is_bot&&!u.service).slice(0,6).map(u=>h('div',{class:'ur',onclick:()=>{to=u;chosen.textContent='Получатель: '+u.name;setKids(list);}},
    av(u,36),h('div',{class:'mid'},u.name,badge(u)))));}catch(e){}},250);};
 ov.append(h('div',{class:'modal'},h('h3',{},'Отправить звёзды'),find,list,chosen,amt,err,
  h('button',{class:'btn',onclick:async()=>{
   if(!to){err.textContent='Выбери получателя';return;}
   try{await api('/api/wallet/transfer',{user_id:to.id,amount:+amt.value});ov.remove();toast('Отправлено ⭐');done&&done();}
   catch(e){err.textContent=e.message;}}},'Отправить'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

/* ---------- каналы ---------- */
function newChannel(){
 const ov=h('div',{class:'overlay dim'});let cAv,priv=false;
 const title=h('input',{class:'inp',placeholder:'Название канала',maxlength:50}),descr=h('textarea',{class:'inp',rows:2,placeholder:'Описание (необязательно)',maxlength:300}),
  handle=h('input',{class:'inp',placeholder:'Публичная ссылка, например my_channel',autocapitalize:'none',maxlength:32}),err=h('div',{class:'err'});
 ov.append(h('div',{class:'modal'},h('h3',{},'📢 Новый канал'),avatarPicker({title:'К'},d=>cAv=d),title,descr,handle,
  h('div',{class:'srow',style:'padding:8px 2px'},h('div',{class:'mid'},'Приватный',h('div',{class:'sub'},'Не показывается в поиске')),toggle(false,v=>priv=v)),
  h('div',{class:'sub'},'Писать в канале можешь только ты (и добавленные боты). Остальные подписываются и читают. Бусты открывают оформление.'),err,
  h('button',{class:'btn',onclick:async()=>{try{const j=await api('/api/chat/channel',{title:title.value,descr:descr.value,handle:handle.value,private:priv,avatar:cAv});
    ov.remove();await loadChats();openChat(j.chat_id);}catch(e){err.textContent=e.message;}}},'Создать'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}
async function openChannel(c){
 try{if(!c.joined)await api('/api/channel/join',{chat_id:c.id});$('#search').value='';searchRes=[];searchCh=[];await loadChats();openChat(c.id);}
 catch(e){toast(e.message);}}

/* ---------- боты ---------- */
function pairEditor(obj,ph1,ph2){
 const box=h('div'),rows=[];
 const add=(k,v)=>{
  const a=h('input',{class:'inp',placeholder:ph1,value:k||'',style:'margin:0;flex:0 0 34%'}),
   b=h('textarea',{class:'inp',placeholder:ph2,rows:2,style:'margin:0;flex:1;resize:vertical'});b.value=v||'';
  const r=h('div',{class:'nact',style:'align-items:flex-start;margin-bottom:6px'},a,b,
   h('button',{class:'sbtn r',onclick:()=>{r.remove();const i=rows.findIndex(x=>x[2]===r);if(i>=0)rows.splice(i,1);}},'✕'));
  rows.push([a,b,r]);box.append(r);};
 Object.entries(obj||{}).forEach(([k,v])=>add(k,v));
 return {el:h('div',{},box,h('button',{class:'sbtn g',onclick:()=>add('','')},'+ добавить')),
  get:()=>Object.fromEntries(rows.map(([a,b])=>[a.value.trim(),b.value]).filter(([k,v])=>k&&v))};}

async function showBots(){
 const ov=h('div',{class:'overlay dim'});const m=h('div',{class:'modal',style:'max-width:520px'});
 async function render(){
  let bots=[];try{bots=(await api('/api/bots')).bots;}catch(e){toast(e.message);}
  const nm=h('input',{class:'inp',placeholder:'Имя бота',maxlength:40}),
   un=h('input',{class:'inp',placeholder:'юзернейм, заканчивается на bot',autocapitalize:'none'}),err=h('div',{class:'err'});
  setKids(m,h('h3',{},'🤖 Мои боты'),
   bots.length?bots.map(b=>h('div',{class:'ur',onclick:()=>botEditor(b,render)},av({name:b.name,avatar_url:b.avatar_url},40),
    h('div',{class:'mid'},b.name,h('span',{class:'bt'},'БОТ'),b.frozen?h('span',{class:'tag d'},'❄️ заморожен'):null,h('small',{},'@'+b.username)))):
    h('div',{class:'sub',style:'margin-bottom:10px'},'Ботов пока нет'),
   h('div',{class:'frm'},h('b',{},'Создать бота'),nm,un,err,
    h('button',{class:'sbtn',onclick:async()=>{try{const j=await api('/api/bots/create',{name:nm.value,username:un.value});await render();loadChats().catch(()=>{});botEditor(j.bot,render);}catch(e){err.textContent=e.message;}}},'Создать')),
   h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть'));}
 await render();ov.append(m);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

function botEditor(b,onChange){
 const ov=h('div',{class:'overlay dim'});
 const name=h('input',{class:'inp',value:b.name,maxlength:40}),desc=h('textarea',{class:'inp',rows:2,placeholder:'Описание бота',maxlength:300});desc.value=b.desc||'';
 const cmds=pairEditor(b.script.commands,'/команда','Ответ бота'),kws=pairEditor(b.script.keywords,'слово в сообщении','Ответ бота');
 const def=h('textarea',{class:'inp',rows:2,placeholder:'Ответ на любое другое сообщение (необязательно)'});def.value=b.script.default||'';
 const tok=h('div',{class:'tokbox',title:'Нажми, чтобы скопировать',onclick:()=>{try{navigator.clipboard.writeText(b.token);toast('Токен скопирован');}catch(e){}}},b.token);
 const snippet='import json, urllib.request\n\nURL = "'+location.origin+'/bot'+b.token+'/"\n\ndef call(method, **p):\n    req = urllib.request.Request(URL + method, json.dumps(p).encode(), {"Content-Type": "application/json"})\n    return json.load(urllib.request.urlopen(req, timeout=40))\n\noffset = 0\nwhile True:\n    for u in call("getUpdates", offset=offset, timeout=20)["result"]:\n        offset = u["update_id"] + 1\n        m = u["message"]\n        call("sendMessage", chat_id=m["chat"]["id"], text="Ты написал: " + m["text"])\n';
 const err=h('div',{class:'err'});
 ov.append(h('div',{class:'modal',style:'max-width:540px'},
  h('h3',{},'🤖 @'+b.username,b.frozen?h('span',{class:'tag d'},'❄️ заморожен'):null),
  b.frozen?h('div',{class:'sub',style:'margin-bottom:8px'},'Администратор заморозил этого бота: он не отвечает и API не работает.'):null,
  h('div',{class:'lbl'},'Имя'),name,h('div',{class:'lbl'},'Описание'),desc,
  h('div',{class:'lbl'},'Токен (никому не показывай)'),tok,
  h('button',{class:'sbtn g',style:'margin-top:6px',onclick:async()=>{if(!confirm('Старый токен перестанет работать. Продолжить?'))return;
    try{const j=await api('/api/bots/update',{id:b.id,regen_token:1});ov.remove();onChange&&await onChange();botEditor(j.bot,onChange);}catch(e){toast(e.message);}}},'Новый токен'),
  h('div',{class:'psec',style:'font-size:16px;margin:18px 0 6px'},'Команды'),
  h('div',{class:'sub'},'Можно использовать {name} (имя человека), {bot}, {time}.'),cmds.el,
  h('div',{class:'psec',style:'font-size:16px;margin:18px 0 6px'},'Ключевые слова'),kws.el,
  h('div',{class:'psec',style:'font-size:16px;margin:18px 0 6px'},'Ответ по умолчанию'),def,
  h('details',{style:'margin-top:14px'},h('summary',{style:'cursor:pointer;color:#2aabee'},'Свой код: Bot API (Python)'),
   h('div',{class:'sub',style:'margin:6px 0'},'Методы: getMe, getUpdates (offset, timeout), sendMessage (chat_id, text). Запусти скрипт на этом же устройстве или в сети Wi-Fi.'),
   h('pre',{class:'code2'},snippet)),
  err,
  h('button',{class:'btn',onclick:async()=>{try{
    await api('/api/bots/update',{id:b.id,name:name.value,desc:desc.value,script:{commands:cmds.get(),keywords:kws.get(),default:def.value}});
    toast('Бот сохранён');ov.remove();onChange&&onChange();loadChats().catch(()=>{});}catch(e){err.textContent=e.message;}}},'Сохранить'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

/* ---------- каналы: страница, бусты, настройки ---------- */
const LVL_PERKS=[['🎨','Цвет обложки канала'],['🌸','Узор из эмодзи на обложке'],['😎','Эмодзи-статус рядом с названием'],['👑','Максимальный уровень']];
async function showChannel(id){
 let c;try{c=(await api('/api/channel/info?id='+id)).channel;}catch(e){return toast(e.message);}
 const ov=h('div',{class:'overlay pf'});const close=()=>ov.remove();
 const mineC=c.owner===me.id;
 const reload=()=>{close();showChannel(id);};
 const act=(ic,t,fn)=>h('button',{class:'pact',onclick:fn},h('i',{},ic),t);
 const acts=[];
 if(c.discussion_chat_id) acts.push(act('💬','Чат обсуждения',async()=>{try{const j=await api('/api/channel/discussion/join',{chat_id:c.id});await loadChats();close();openChat(j.chat_id);}catch(e){toast(e.message);}}));
 acts.push(act(c.joined?'💬':'➕',c.joined?'Открыть':'Подписаться',async()=>{try{if(!c.joined)await api('/api/channel/join',{chat_id:c.id});await loadChats();close();openChat(c.id);}catch(e){toast(e.message);}}));
 acts.push(act('⚡','Буст',()=>{const el=ov.querySelector('#boostCard');el&&el.scrollIntoView({behavior:'smooth'});}));
 if(c.joined&&!mineC)acts.push(act('🚪','Отписаться',async()=>{try{await api('/api/channel/leave',{chat_id:c.id});await loadChats();if(cur===c.id)$('#backBtn').click();reload();}catch(e){toast(e.message);}}));
 const more=[['🚩 Пожаловаться',()=>reportDialog('chat',c.id,c.title)]];
 if(c.handle)more.push(['📋 Скопировать ссылку',()=>{try{navigator.clipboard.writeText(location.origin+'/#@'+c.handle);toast('Скопировано');}catch(e){}}]);
 if(mineC){more.push(['⚙️ Настройки канала',()=>channelSettings(c,reload)]);
  more.push(['🗑 Удалить канал',async()=>{if(!confirm('Удалить канал «'+c.title+'» вместе со всеми сообщениями? Необратимо.'))return;
   try{await api('/api/channel/delete',{chat_id:c.id});close();if(cur===c.id)$('#backBtn').click();await loadChats();toast('Канал удалён');}catch(e){toast(e.message);}}]);}
 if(me.is_admin){more.push(['🏷 Метки…',()=>{close();adminBadgeDialog('chat',c.id,c.title,c.badges);}]);
  more.push(['🗑 Удалить (админ)',async()=>{if(!confirm('Удалить канал «'+c.title+'»?'))return;try{await api('/api/admin/chat/delete',{id:c.id});close();if(cur===c.id)$('#backBtn').click();await loadChats();toast('Канал удалён');}catch(e){toast(e.message);}}]);}
 acts.push(act('⋯','Ещё',e=>{e.stopPropagation();popMenu(e.currentTarget,more,false);}));
 const bn=c.banner;
 const head=h('div',{class:'pfh',style:'background:'+bannerStyle(bn)},patternEl(bn?bn.pattern:''),
  h('div',{class:'pbar2'},h('button',{class:'icon',style:'color:#fff;font-size:26px',onclick:close},'←'),
   mineC?h('button',{class:'icon',style:'color:#fff',onclick:()=>channelSettings(c,reload)},'⚙️'):h('span')),
  av({avatar_url:c.avatar_url,name:c.title},112),
  h('h1',{},c.title,badge(c)),
  h('div',{class:'st'},c.members+' подписчиков'+(c.level?' · уровень '+c.level:'')+(c.frozen?' · ❄️ заморожен':'')),
  h('div',{class:'pacts'},acts));
 const need=c.next_need;const prog=need?Math.min(100,Math.round(c.boosts/need*100)):100;
 const bCard=h('div',{class:'pcard',id:'boostCard',style:'padding:14px 18px'},
  h('div',{style:'display:flex;justify-content:space-between;align-items:center'},h('b',{style:'font-size:17px'},'⚡ Бусты канала'),h('span',{class:'sub'},'Уровень '+c.level)),
  h('div',{class:'lvl'},h('i',{style:'width:'+prog+'%'})),
  h('div',{class:'sub'},need?(c.boosts_inf?'∞':c.boosts)+' из '+need+' бустов до уровня '+(c.level+1):'Достигнут максимальный уровень · '+(c.boosts_inf?'∞':c.boosts)+' бустов'),
  h('div',{style:'margin-top:10px'},LVL_PERKS.map(([ic,t],i)=>h('div',{style:'padding:4px 0;opacity:'+(c.level>=i+1?1:.45)},ic+' Ур. '+(i+1)+' — '+t+(c.level>=i+1?' ✓':'')))),
  c.boosters.length?h('div',{class:'bst'},c.boosters.map(u=>av(u,30))):null,
  h('button',{class:'btn',style:c.boosted_by_me?'':'background:linear-gradient(90deg,#6c8cff,#c65bff)',onclick:async()=>{
   if(!c.can_boost&&!c.boosted_by_me)return showPremium();
   try{await api('/api/channel/boost',{chat_id:c.id,on:!c.boosted_by_me});toast(c.boosted_by_me?'Буст снят':'Канал забустен ⚡');reload();}catch(e){toast(e.message);}}},
   c.boosted_by_me?'Снять мой буст':(c.can_boost?'Забустить ('+(c.slots_left>=999?'∞ свободно':c.slots_left+' из '+BOOST_SLOTS_UI+' свободно')+')':'Нужен Premium для буста')));
 const rows=[];
 if(c.descr)rows.push(h('div',{class:'prow2'},h('div',{class:'l'},'описание'),h('div',{class:'v',style:'white-space:pre-wrap;font-size:17px'},c.descr)));
 if(c.handle)rows.push(h('div',{class:'prow2'},h('div',{class:'l'},'ссылка'),h('div',{class:'v acc'},'@'+c.handle)));
 if(c.owner_user)rows.push(h('div',{class:'prow2',style:'cursor:pointer',onclick:()=>showProfile(c.owner_user.id)},h('div',{class:'l'},'владелец'),h('div',{class:'v',style:'font-size:17px'},c.owner_user.name,badge(c.owner_user))));
 rows.push(h('div',{class:'prow2'},h('div',{class:'l'},'тип'),h('div',{class:'v',style:'font-size:17px'},(c.pub?'Публичный канал':'Приватный канал')+(c.sign?' · с подписью автора':''))));
 ov.append(head,h('div',{class:'pbody'},warnEl(c),h('div',{class:'pcard'},rows),bCard));
 document.body.append(ov);}
const BOOST_SLOTS_UI=3;

function channelSettings(c,after){
 const ov=h('div',{class:'overlay dim'});let newAv;
 const st={color:c.banner?c.banner.color:-1,pattern:c.banner?c.banner.pattern:'',emoji:c.estatus||''};
 const title=h('input',{class:'inp',value:c.title,maxlength:50}),descr=h('textarea',{class:'inp',rows:3,maxlength:300,placeholder:'Описание'},c.descr||''),
  handle=h('input',{class:'inp',value:c.handle||'',placeholder:'Публичная ссылка (без @)',autocapitalize:'none',maxlength:32});
 let pub=c.pub,sign=c.sign;
 const lock=n=>c.level<n;
 const prev=h('div',{class:'bprev'});
 const paintPrev=()=>{prev.style.background=bannerBg(st.color);setKids(prev,patternEl(st.pattern),h('div',{class:'bn'},title.value+' ',st.emoji?statusEl(st.emoji,18):null));};
 title.oninput=paintPrev;
 const gate=n=>{if(lock(n)){toast('Нужен '+n+' уровень канала — собери бусты ⚡');return true;}return false;};
 const sws=h('div',{class:'sws'});
 const paintSws=()=>setKids(sws,[-1,...BANNERS.map((_,i)=>i)].map(i=>h('div',{class:'swc'+(st.color===i?' on':'')+(lock(1)?' lk':''),style:'background:'+bannerBg(i),onclick:()=>{if(gate(1))return;st.color=i;paintSws();paintPrev();}},i<0?'✕':'')));
 const chips=(list,get,set,n)=>{const box=h('div',{class:'chips'});
  const paint=()=>setKids(box,list.map(p=>h('button',{class:'chip'+(get()===p?' on':''),onclick:()=>{if(gate(n))return;set(p);paint();paintPrev();}},patternChipLabel(p))));paint();return box;};
 const discussion=h('div',{class:'srow',style:'padding:8px 2px'});
 if(c.discussion_chat_id){
  discussion.append(
   h('div',{class:'mid'},'💬 Чат обсуждения',h('div',{class:'sub'},'Групповой чат для комментариев подписчиков')),
   h('button',{class:'btn gray',style:'width:auto;margin:0',onclick:async()=>{try{const j=await api('/api/channel/discussion/join',{chat_id:c.id});await loadChats();ov.remove();openChat(j.chat_id);}catch(e){toast(e.message);}}},'Открыть')
  );
 }else{
  discussion.append(
   h('div',{class:'mid'},'💬 Чат обсуждения',h('div',{class:'sub'},'Создай отдельный групповой чат для общения подписчиков (как в Telegram)')),
   h('button',{class:'btn',style:'width:auto;margin:0',onclick:async()=>{try{const j=await api('/api/channel/discussion',{chat_id:c.id});await loadChats();ov.remove();openChat(j.chat_id);toast('Чат обсуждения создан');}catch(e){toast(e.message);}}},'Создать')
  );
 }
 const err=h('div',{class:'err'});
 ov.append(h('div',{class:'modal'},h('h3',{},'⚙️ Настройки канала'),avatarPicker({avatar_url:c.avatar_url,name:c.title},d=>newAv=d),
  h('div',{class:'lbl'},'Название'),title,h('div',{class:'lbl'},'Описание'),descr,h('div',{class:'lbl'},'Публичная ссылка'),handle,
  h('div',{class:'psec',style:'font-size:15px;margin:14px 0 4px'},'Тип канала'),
  h('div',{class:'srow',style:'padding:8px 2px'},h('div',{class:'mid'},'Публичный канал',h('div',{class:'sub'},'Виден в поиске и по ссылке')),toggle(pub,v=>pub=v)),
  h('div',{class:'srow',style:'padding:8px 2px'},h('div',{class:'mid'},'Подпись автора',h('div',{class:'sub'},'Показывать имя под постами')),toggle(sign,v=>sign=v)),
  h('div',{class:'psec',style:'font-size:15px;margin:14px 0 4px'},'Обсуждение'),
  discussion,
  h('div',{class:'psec',style:'font-size:16px;margin:16px 0 6px'},'⚡ Оформление (уровень канала: '+c.level+')'),
  prev,h('div',{class:'lbl'},'Цвет обложки · 1 ур.'),sws,h('div',{class:'lbl'},'Узор (эмодзи / своя картинка) · 2 ур.'),chips(PATTERNS,()=>isBannerImg(st.pattern)?'':st.pattern,v=>{st.pattern=v;paintPrev();},2),
  (()=>{const bf=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp,image/gif',class:'hide'});
   bf.onchange=async()=>{if(!bf.files[0])return;try{if(gate(2))return;const d=await fileToBannerMedia(bf.files[0]);st.pattern=d;paintPrev();}catch(e){toast(e.message);}};
   return h('div',{style:'margin:4px 0 10px;display:flex;gap:8px;flex-wrap:wrap'},
    h('button',{class:'chip',style:'width:auto;padding:0 12px;font-size:13px',onclick:()=>{if(gate(2))return;bf.click();}},'🖼 Свой узор (фото/GIF)'),
    isBannerImg(st.pattern)?h('button',{class:'chip',style:'width:auto;padding:0 12px;font-size:13px',onclick:()=>{st.pattern='';paintPrev();}},'✕ Убрать'):null,
    bf);})(),
  h('div',{class:'lbl'},'Эмодзи-статус · 3 ур.'),chips(STATUSES,()=>st.emoji,v=>st.emoji=v,3),
  (()=>{const sf=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp,image/gif',class:'hide'});
   sf.onchange=async()=>{if(!sf.files[0])return;try{if(gate(3))return;const d=await fileToStatusMedia(sf.files[0]);st.emoji=d;paintPrev();}catch(e){toast(e.message);}};
   return h('div',{style:'margin:4px 0 10px'},h('button',{class:'chip',style:'width:auto;padding:0 12px;font-size:13px',onclick:()=>{if(gate(3))return;sf.click();}},'🖼 Своя картинка/GIF'),sf);})(),
  err,
  h('button',{class:'btn',onclick:async()=>{try{
   const body={chat_id:c.id,title:title.value,descr:descr.value,handle:handle.value,pub,sign};if(newAv!==undefined)body.avatar=newAv;
   if(st.color!==(c.banner?c.banner.color:-1))body.bcolor=st.color;
   if(st.pattern!==(c.banner?c.banner.pattern:''))body.bpattern=st.pattern;
   if(st.emoji!==(c.estatus||''))body.estatus=st.emoji;
   await api('/api/channel/settings',body);ov.remove();toast('Сохранено');await loadChats();after&&after();}catch(e){err.textContent=e.message;}}},'Сохранить'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена')));
 paintSws();paintPrev();ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

/* ---------- маркет NFT-подарков и подарков ---------- */

/* ---------- GodFragment (как Telegram Fragment) ---------- */
function fmtPhoneFrag(n){
 n=String(n||'').replace(/\D/g,'');
 if(n.startsWith('888'))return '+888 '+n.slice(3).replace(/(\d{3})(?=\d)/g,'$1 ').trim();
 return '+'+n;
}
async function showFragment(startTab){
 const ov=h('div',{class:'overlay frag'});const close=()=>ov.remove();
 const box=h('div',{class:'fm'});
 let tab=startTab||'usernames',q='',tmo=0;
 const head=h('div',{class:'fbar'},
  h('button',{class:'icon',style:'color:#fff;font-size:26px',onclick:close},'←'),
  h('div',{style:'flex:1;text-align:center;font-weight:700;font-size:17px'},'GodFragment'),
  h('span',{style:'width:36px'}));
 const title=h('div',{class:'fhead'},
  h('h1',{},'GodFragment'),
  h('div',{class:'sub'},'Анонимные номера, NFT-юзернеймы и коллекционные подарки'));
 const tabsEl=h('div',{class:'ftabs'});
 const search=h('input',{class:'fsearch',placeholder:'Поиск…'});
 const bal=h('div',{class:'fbal'});
 const body=h('div');
 const TABS=[['usernames','@ Юзернеймы'],['numbers','📞 Номера'],['collectibles','🎁 Коллекции'],['mine','👜 Мои лоты']];
 function paintTabs(){setKids(tabsEl,TABS.map(([k,t])=>h('button',{class:tab===k?'on':'',onclick:()=>{tab=k;draw();}},t)));}
 search.oninput=()=>{clearTimeout(tmo);tmo=setTimeout(()=>{q=search.value.trim();draw();},250);};

 async function buy(kind,id,label,price){
  if(!confirm('Купить '+label+' за '+fmtStars(price)+'?'))return;
  try{await api('/api/fragment/buy',{kind,id});toast('Куплено на GodFragment ✅');await refreshMe();draw();}
  catch(e){toast(e.message);}}

 async function listLot(kind,id,defP){
  const p=prompt('Цена в звёздах ⭐:',String(defP||100));if(!p)return;
  try{await api('/api/fragment/list',{kind,id,price:+p});toast('Выставлено на GodFragment');draw();}
  catch(e){toast(e.message);}}

 async function unlistLot(kind,id){
  try{await api('/api/fragment/unlist',{kind,id});toast('Снято с продажи');draw();}
  catch(e){toast(e.message);}}

 function cardUsername(it){
  return h('div',{class:'fcard',onclick:()=>{
   if(it.owner&&it.owner.id===me.id)return toast('Это твой лот');
   buy('username',it.id,'@'+it.handle,it.price);
  }},
   h('div',{class:'fh'},h('span',{class:'at'},'@'),it.handle),
   h('div',{class:'fp'},fmtStars(it.price)),
   h('div',{class:'fo'},it.pool?'от GodFragment':(it.owner?('продаёт '+it.owner.name):'—')));
 }
 function cardNumber(it){
  return h('div',{class:'fcard',onclick:()=>{
   if(it.owner&&it.owner.id===me.id)return toast('Это твой лот');
   buy('number',it.id,fmtPhoneFrag(it.number),it.price);
  }},
   h('div',{class:'fh'},fmtPhoneFrag(it.number)),
   h('div',{class:'fp'},fmtStars(it.price)),
   h('div',{class:'fo'},it.pool?'от GodFragment':(it.owner?('продаёт '+it.owner.name):'—')));
 }

 async function draw(){
  paintTabs();
  try{
   const j=await api('/api/fragment?tab='+encodeURIComponent(tab)+(q?'&q='+encodeURIComponent(q):''));
   setKids(bal,'Баланс: '+fmtStars(j.balance)+' · покупки за звёзды ⭐');
   if(tab==='usernames'){
    setKids(body,j.items&&j.items.length?h('div',{class:'fgrid'},j.items.map(cardUsername)):
     h('div',{class:'fempty'},'Пока нет юзернеймов в продаже.\nАдмин может выпустить NFT-юзы, владельцы — выставить свои.'));
   }else if(tab==='numbers'){
    setKids(body,j.items&&j.items.length?h('div',{class:'fgrid'},j.items.map(cardNumber)):
     h('div',{class:'fempty'},'Пока нет анонимных номеров в продаже.'));
   }else if(tab==='collectibles'){
    setKids(body,j.items&&j.items.length?h('div',{class:'nftgrid'},j.items.map(it=>nftCard(it,72,{ctx:{market:true,after:draw}}))):
     h('div',{class:'fempty'},'Коллекционных подарков на продаже нет.'));
   }else{
    const uns=j.usernames||[],nums=j.numbers||[],nfts=j.nfts||[];
    const blocks=[];
    blocks.push(h('div',{class:'psec',style:'font-size:15px;margin:8px 0'},'Юзернеймы'));
    if(!uns.length)blocks.push(h('div',{class:'sub'},'Нет NFT-юзернеймов'));
    uns.forEach(x=>blocks.push(h('div',{class:'sit'},
     h('div',{class:'sit-main'},h('span',{class:'nft'},'💎 @'+x.handle),h('div',{class:'sub'},x.listed?('на GodFragment · '+fmtStars(x.price)):(x.active?'в профиле':'выкл.'))),
     h('div',{class:'sit-acts'},
      x.listed?h('button',{class:'sbtn sm g',onclick:()=>unlistLot('username',x.id)},'Снять'):
               h('button',{class:'sbtn sm',onclick:()=>listLot('username',x.id,x.value||100)},'Продать')))));
    blocks.push(h('div',{class:'psec',style:'font-size:15px;margin:14px 0 8px'},'Номера'));
    if(!nums.length)blocks.push(h('div',{class:'sub'},'Нет NFT-номеров'));
    nums.forEach(x=>blocks.push(h('div',{class:'sit'},
     h('div',{class:'sit-main'},h('span',{class:'nft'},'💎 '+fmtPhoneFrag(x.number)),h('div',{class:'sub'},x.listed?('на GodFragment · '+fmtStars(x.price)):'не в продаже')),
     h('div',{class:'sit-acts'},
      x.listed?h('button',{class:'sbtn sm g',onclick:()=>unlistLot('number',x.id)},'Снять'):
               h('button',{class:'sbtn sm',onclick:()=>listLot('number',x.id,100)},'Продать')))));
    blocks.push(h('div',{class:'psec',style:'font-size:15px;margin:14px 0 8px'},'NFT-подарки'));
    if(!nfts.length)blocks.push(h('div',{class:'sub'},'Нет NFT-подарков'));
    else blocks.push(h('div',{class:'nftgrid'},nfts.map(it=>nftCard(it,72,{ctx:{market:false,after:draw}}))));
    setKids(body,blocks);
   }
  }catch(e){setKids(body,h('div',{class:'err'},e.message));}
 }
 setKids(box,head,title,tabsEl,search,bal,body);
 ov.append(box);document.body.append(ov);draw();
}


async function showMarket(){
 const ov=h('div',{class:'overlay dim'});const m=h('div',{class:'modal',style:'max-width:620px'});
 let tab='nft',coll='',sort='price_asc';
 const close=()=>ov.remove();
 async function draw(){
  let d;
  try{
   if(tab==='mine'){const j=await api('/api/nft/mine');d={mine:j};await refreshMe();}
   else d=await api('/api/market?sort='+sort+(coll?'&coll='+coll:''));
  }catch(e){setKids(m,h('div',{class:'err'},e.message));return;}
  await refreshMe().catch(()=>{});
  const tabs=h('div',{class:'tabs2'},[['nft','💎 NFT'],['gift','🎁 Подарки'],['mine','👜 Мои']].map(([k,t])=>h('button',{class:tab===k?'on':'',onclick:()=>{tab=k;draw();}},t)));
  let view;
  const ctx={market:true,after:draw};
  if(tab==='nft'){
   const chips=h('div',{class:'chips2'},h('button',{class:coll===''?'on':'',onclick:()=>{coll='';draw();}},'Все'),
    d.colls.map(c=>h('button',{class:String(c.id)===String(coll)?'on':'',onclick:()=>{coll=c.id;draw();}},c.glyph+' '+c.name+(c.floor?' · от '+c.floor+'⭐':''))));
   const sel=h('select',{class:'inp',onchange:e=>{sort=e.target.value;draw();}},[['price_asc','Сначала дешёвые'],['price_desc','Сначала дорогие'],['new','Новые'],['num','По номеру']].map(([v,t])=>h('option',{value:v,selected:v===sort},t)));
   view=[chips,sel,d.items.length?h('div',{class:'nftgrid'},d.items.map(it=>nftCard(it,72,{ctx}))):h('div',{class:'sub',style:'padding:20px;text-align:center'},'Лотов пока нет')];
  }else if(tab==='gift'){
   view=d.gifts.length?h('div',{class:'ggrid'},d.gifts.map(g=>h('div',{class:'gitem'},gift3d(g,68),h('div',{class:'gt'},g.name),h('div',{class:'gs'},(g.number?'№'+g.number+' · ':'')+'от '+g.owner.name),
     h('div',{class:'gp',style:'margin:4px 0'},fmtStars(g.listed)),
     h('button',{class:'sbtn',style:g.owner.id===me.id?'opacity:.4':'',onclick:async()=>{if(g.owner.id===me.id)return toast('Это твой лот');
      try{await api('/api/market/buy',{kind:'gift',id:g.id});toast('Куплено 🎉');draw();}catch(e){toast(e.message);}}},'Купить')))):
    h('div',{class:'sub',style:'padding:20px;text-align:center'},'Обычные подарки на продаже появляются, когда владельцы выставляют их из «Мои».');
  }else{
   const j=d.mine;
   view=[h('div',{class:'psec',style:'font-size:15px;margin:4px 0 8px'},'Мои NFT-подарки'),
    j.items.length?h('div',{class:'nftgrid'},j.items.map(it=>nftCard(it,72,{ctx:{market:false,after:draw}}))):h('div',{class:'sub'},'Пока нет. Купи на маркете 💎'),
    h('div',{class:'psec',style:'font-size:15px;margin:16px 0 8px'},'Мои подарки'),
    j.gifts.length?h('div',{class:'ggrid'},j.gifts.map(g=>{const lp=j.listed[String(g.id)]||0;
     return h('div',{class:'gitem'},gift3d(g,68),h('div',{class:'gt'},g.name),h('div',{class:'gs'},lp?'на продаже · '+lp+'⭐':(g.number?'№'+g.number:'')),
      lp?h('button',{class:'sbtn g',onclick:async()=>{try{await api('/api/market/unlist',{kind:'gift',id:g.id});draw();}catch(e){toast(e.message);}}},'Снять')
        :h('button',{class:'sbtn',onclick:async()=>{const p=prompt('Цена в звёздах ⭐:',String(g.price||50));if(!p)return;try{await api('/api/market/list',{kind:'gift',id:g.id,price:+p});draw();}catch(e){toast(e.message);}}},'Продать'));})):h('div',{class:'sub'},'Подарков пока нет')];
  }
  setKids(m,h('h3',{},'🛍 Маркет'),h('div',{class:'sub',style:'margin-bottom:8px'},'Баланс: '+fmtStars(me.balance)+' · покупай и продавай за звёзды ⭐'),tabs,view,h('button',{class:'btn gray',onclick:close},'Закрыть'));}
 ov.append(m);ov.onclick=e=>{if(e.target===ov)close();};document.body.append(ov);draw();}

