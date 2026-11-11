/* ---------- админ: метки на людей, ботов и каналы ---------- */
async function adminBadgeDialog(kind,id,name,cur){
 let defs;try{defs=(await api('/api/badges')).badges;}catch(e){return toast(e.message);}
 const ov=h('div',{class:'overlay dim'});const on=new Set((cur||[]).map(b=>b.key));
 const box=h('div');
 const draw=()=>setKids(box,defs.map(b=>h('div',{class:'srow',style:'cursor:default'},
  h('span',{class:b.kind==='label'?'vlabel':'vb',style:'background:'+b.color},b.icon),
  h('div',{class:'mid'},h('div',{},b.title),h('div',{class:'sub',style:'font-size:12px'},b.descr)),
  toggle(on.has(b.key),async v=>{try{await api('/api/admin/badge',{kind,id,key:b.key,on:v});if(v)on.add(b.key);else on.delete(b.key);refresh();}catch(e){toast(e.message);draw();}}))));
 draw();
 ov.append(h('div',{class:'modal'},h('h3',{},'🏷 Метки: '+name),box,h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

/* ---------- настройки как в Telegram ---------- */
function applyPrefs(){
 document.documentElement.style.setProperty('--fs',(localStorage.getItem('fs')||'15')+'px');
 document.documentElement.style.setProperty('--ac',localStorage.getItem('ac')||'#6b5cff');
 document.body.classList.toggle('nomo',localStorage.getItem('nomo')==='1');}
const ACCENTS=['#6b5cff','#2aabee','#34c759','#ff9f0a','#ff453a','#ff5fa2','#bf5af2'];
function cloudPwDialog(after){
 const ov=h('div',{class:'overlay dim'});
 const has=!!me.has_cloud_pw;
 const cur=has?h('input',{class:'inp',type:'password',placeholder:'Текущий пароль',autocomplete:'current-password'}):null;
 const p1=h('input',{class:'inp',type:'password',placeholder:'Новый пароль (от 4 символов)',autocomplete:'new-password'});
 const p2=h('input',{class:'inp',type:'password',placeholder:'Повторите пароль',autocomplete:'new-password'});
 const hint=h('input',{class:'inp',placeholder:'Подсказка (необязательно)',maxlength:60});
 const err=h('div',{class:'err'});
 const send=async(nw)=>{try{await api('/api/cloud_password',{current:cur?cur.value:'',new:nw,hint:hint.value});await refreshMe();ov.remove();toast(nw?'🔒 Облачный пароль установлен':'Облачный пароль отключён');after&&after();}catch(e){err.textContent=e.message;}};
 ov.append(h('div',{class:'modal'},h('h3',{},'🔒 Облачный пароль'),
  h('div',{class:'sub',style:'margin-bottom:8px;line-height:1.4'},has?'Пароль запрашивается при входе с нового устройства, после кода из чата.':'Дополнительная защита: при входе, кроме кода, нужно будет ввести пароль.'),
  cur,p1,p2,hint,err,
  h('button',{class:'btn',onclick:()=>{if(p1.value!==p2.value){err.textContent='Пароли не совпадают';return;}if(p1.value.length<4){err.textContent='Минимум 4 символа';return;}send(p1.value);}},has?'Сменить пароль':'Установить пароль'),
  has?h('button',{class:'btn red',onclick:()=>send('')},'Отключить пароль'):null,
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}
function aboutDialog(){
 const ov=h('div',{class:'overlay dim'});
 ov.append(h('div',{class:'modal',style:'text-align:center'},h('h3',{},'ℹ️ О приложении'),
  h('div',{class:'sub',style:'line-height:1.5'},'GodGram — свой мессенджер одним файлом.',h('br'),'Без внешних библиотек. База: SQLite.'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}
function showSettings(){
 const ov=h('div',{class:'overlay'});const close=()=>ov.remove();
 const b=me.banner;
 const srow=(ic,t,sub,fn,right)=>h('div',{class:'srow',onclick:fn},h('span',{class:'si'},ic),h('div',{class:'mid'},h('div',{},t),sub?h('div',{class:'sub'},sub):null),right||null);
 const fs=h('input',{type:'range',min:13,max:20,value:localStorage.getItem('fs')||'15',style:'width:130px',
  oninput:e=>{localStorage.setItem('fs',e.target.value);applyPrefs();}});
 const curAc=localStorage.getItem('ac')||'#6b5cff';
 const accs=h('div',{class:'accs'},ACCENTS.map(c=>h('div',{class:'acc1'+(c===curAc?' on':''),style:'background:'+c,onclick:e=>{
  localStorage.setItem('ac',c);applyPrefs();accs.querySelectorAll('.acc1').forEach(x=>x.classList.remove('on'));e.target.classList.add('on');}})));
 const head=h('div',{class:'pbn',style:'background:'+bannerBg(b?b.color:-1)},patternEl(b?b.pattern:''),
  h('div',{class:'pbar2'},h('button',{class:'icon',onclick:close},'←'),h('button',{class:'icon',onclick:()=>showEdit(close)},'✎')),
  av(me,96),h('h1',{},me.name,badge(me)),h('div',{class:'st'},(me.phone?fmtPhone(me.phone):'')+(me.username?' · @'+me.username:'')));
 ov.append(head,h('div',{class:'pw st'},
  h('div',{class:'sgrp'},'Аккаунт'),
  srow('👤','Мой профиль',null,()=>{close();showProfile(me.id);}),
  srow('✏️','Изменить профиль','Имя, фото или GIF, юзернейм, о себе',()=>showEdit(close)),
  srow('👛','Кошелёк',fmtStars(me.balance),showWallet),
  srow('⭐','Чеки на звёзды','Как Send — коды EQ…',()=>{close();showChecks();}),
  srow('🔷','GodFragment','Юзернеймы, номера, коллекции',()=>{close();showFragment();}),
  srow('🛍','Маркет NFT-подарков','Подарки за звёзды',showMarket),
  srow('🤖','Мои боты','Создавай и программируй',showBots),
  srow('💎','Мои NFT',null,()=>{close();myNft();}),
  srow('⭐','GodGram Premium',me.premium?'активен':null,showPremium),
  h('div',{class:'sgrp'},'Конфиденциальность и безопасность'),
  srow('🔒','Облачный пароль',me.has_cloud_pw?'включён':'выключен',()=>cloudPwDialog(()=>{close();showSettings();})),
  srow('📵','Завершить другие сеансы','Выйти на всех других устройствах',async()=>{
   if(!confirm('Завершить все сеансы, кроме этого?'))return;
   try{await api('/api/sessions/terminate_others',{});toast('Другие сеансы завершены');}catch(e){toast(e.message);}}),
  h('div',{class:'sgrp'},'Настройки чатов'),
  srow('🔤','Размер текста',null,()=>{},fs),
  srow('🎨','Цвет интерфейса',null,()=>{}),accs,
  srow('✨','Анимация подарков',null,()=>{},toggle(localStorage.getItem('nomo')!=='1',on=>{localStorage.setItem('nomo',on?'0':'1');applyPrefs();})),
  srow('⏎','Enter отправляет сообщение','Выключено: Enter — новая строка',()=>{},toggle(localStorage.getItem('entsend')!=='0',on=>localStorage.setItem('entsend',on?'1':'0'))),
  h('div',{class:'sgrp'},'Уведомления'),
  srow('🔔','Всплывающие уведомления',null,()=>{},toggle(localStorage.getItem('gmute')!=='1',on=>localStorage.setItem('gmute',on?'0':'1'))),
  srow('👁','Показывать текст в уведомлениях',null,()=>{},toggle(localStorage.getItem('npv')!=='0',on=>localStorage.setItem('npv',on?'1':'0'))),
  h('div',{class:'sgrp'},'Прочее'),
  srow('♻️','Сбросить настройки вида','Размер текста, цвет, анимации',()=>{['fs','ac','nomo','entsend','npv','gmute'].forEach(k=>localStorage.removeItem(k));applyPrefs();close();showSettings();toast('Настройки сброшены');}),
  window.GG_MOBILE?srow('🌐','Сервер',window.GG_BASE||'не задан',()=>{if(confirm('Сменить сервер? Вы выйдете из аккаунта на этом устройстве.')){try{localStorage.removeItem('tok');sessionStorage.removeItem('tok');}catch(e){}ggChangeServer();}}):null,
  srow('ℹ️','О приложении',null,aboutDialog),
  me.is_admin?h('div',{class:'sgrp'},'Администратор'):null,
  me.is_admin?srow('🛡','Админ-панель',null,()=>{close();adminPanel();}):null,
  h('div',{class:'sgrp'},' '),
  srow('🚪','Выйти',null,()=>{close();logout(false);})));
 document.body.append(ov);}
applyPrefs();

initAuth();
boot();
