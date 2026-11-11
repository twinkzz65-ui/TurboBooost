/* ---------- обновления в реальном времени (long-poll) ---------- */
async function startPoll(){
 const id=++pollId;
 while(id===pollId&&token){
  try{
   const r=await fetch('/api/poll?v='+ver,{headers:{'Authorization':'Bearer '+token}});
   if(r.status===401){logout(true);return;}
   const j=await r.json();
   if(id!==pollId)return;
   if(j.v!==ver){ver=j.v;await refresh();}
  }catch(e){await sleep(2000);}
 }}
async function refresh(){
 try{await refreshMe();}catch(e){}
 await loadChats();if(cur)await loadMessages();}
setInterval(()=>{if(token&&me)loadChats().catch(()=>{});},30000);

/* ---------- список чатов ---------- */
const muteKey=c=>c.kind==='private'?'u'+(c.peer&&c.peer.id):'c'+c.id;
async function loadChats(){setTimeout(function(){try{loadStoryBar();}catch(e){}},0);
 const j=await api('/api/chats');chats=j.chats;
 for(const c of chats){
  const lid=c.last?c.last.id:0;
  if(!firstLoad&&c.last&&!c.last.mine&&seenLast[c.id]!==lid&&(c.id!==cur||document.hidden)&&!muted[muteKey(c)]&&localStorage.getItem('gmute')!=='1')
   toast((c.kind==='group'?c.last.from+' · '+c.title:c.title)+(localStorage.getItem('npv')==='0'?': новое сообщение':': '+c.last.text.slice(0,60)),()=>openChat(c.id));
  seenLast[c.id]=lid;}
 firstLoad=false;
 const un=chats.reduce((s,c)=>s+(muted[muteKey(c)]?0:c.unread),0);
 document.title=(un?'('+un+') ':'')+'GodGram';
 const tb=$('#tabBadge');tb.textContent=un>99?'99+':un;tb.classList.toggle('hide',!un);
 if(me){setKids($('#meAv'),av(me,26));setKids($('#tabProfAv'),av(me,24));}
 paintFilt();renderList();if(cur)renderHeader();}

let filt='all';
const FILTS=[['all','Все'],['private','Личные'],['group','Группы'],['channel','Каналы'],['bot','Боты']];
const filtFn=c=>filt==='all'||(filt==='bot'?(c.kind==='private'&&c.peer&&c.peer.is_bot):(filt==='private'?(c.kind==='private'&&!(c.peer&&c.peer.is_bot)):c.kind===filt));
function paintFilt(){setKids($('#filt'),FILTS.map(([k,t])=>h('button',{class:filt===k?'on':'',onclick:()=>{filt=k;paintFilt();renderList();}},t)));}
function showContacts(){
 const ov=h('div',{class:'overlay dim'});let t=0;
 const find=h('input',{class:'inp',placeholder:'Поиск контактов'}),list=h('div',{style:'max-height:60vh;overflow-y:auto'});
 const load=async()=>{try{const j=await api('/api/users?q='+encodeURIComponent(find.value));
  setKids(list,j.users.map(u=>h('div',{class:'ur',onclick:()=>{ov.remove();startPrivate(u.id);}},av(u,44),h('div',{class:'mid'},h('b',{},u.name),badge(u),h('small',{},(u.username?'@'+u.username+' · ':'')+status(u))))));}catch(e){}};
 find.oninput=()=>{clearTimeout(t);t=setTimeout(load,200);};
 ov.append(h('div',{class:'modal'},h('h3',{},'👤 Контакты'),find,list,h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);load();}
$('#tabContacts').onclick=showContacts;
$('#tabSettings').onclick=()=>showSettings();
$('#tabProfile').onclick=()=>{if(me)showProfile(me.id);};
$('#tabChats').onclick=()=>{$('#list').scrollTo({top:0,behavior:'smooth'});};
$('#sbtn').onclick=()=>{const b=$('#sbox');b.classList.toggle('hide');if(b.classList.contains('hide')){$('#search').value='';searchRes=[];searchCh=[];renderList();}else $('#search').focus();};
$('#newBtn').onclick=e=>{e.stopPropagation();popMenu($('#newBtn'),[['👥 Новая группа',newGroup],['📢 Новый канал',newChannel],['🤖 Мои боты',showBots]],true);};
let searchRes=[],searchCh=[],searchT=0;
$('#search').oninput=()=>{clearTimeout(searchT);const v=$('#search').value.trim();
 if(!v){searchRes=[];searchCh=[];renderList();return;}
 renderList();searchT=setTimeout(async()=>{
  try{const j=await api('/api/users?q='+encodeURIComponent(v));searchRes=j.users;
   try{searchCh=(await api('/api/channels?q='+encodeURIComponent(v))).channels;}catch(e){searchCh=[];}
   renderList();}catch(e){}},250);};

function handleEl(u){return u.username?h('span',{class:u.nft_username?'nft':''},(u.nft_username?'💎 ':'')+'@'+u.username):null;}

function renderList(){
 const L=$('#list');L.innerHTML='';
 const v=$('#search').value.trim().toLowerCase();
 const arr=(v?chats.filter(c=>(c.title||'').toLowerCase().includes(v)):chats).filter(v?(()=>true):filtFn);
 arr.forEach(c=>{
  const last=c.last?((c.kind==='group'&&!c.last.mine?c.last.from+': ':c.last.mine?'Вы: ':'')+c.last.text):(c.deleted?'Аккаунт удалён':'Нет сообщений');
  L.append(h('div',{class:'row'+(c.id===cur?' on':''),onclick:()=>openChat(c.id),oncontextmenu:e=>{e.preventDefault();
    popMenu({getBoundingClientRect:()=>({bottom:e.clientY,left:e.clientX,right:e.clientX})},[[c.pinned?'📌 Открепить':'📌 Закрепить',()=>togglePin(c)]]);}},
   c.kind==='saved'?(()=>{const d=h('div',{class:'av saved-av'});d.style.width=d.style.height='52px';d.style.fontSize='22px';d.textContent='⭐';return d;})():av({deleted:c.deleted,service:c.peer&&c.peer.service,avatar_url:c.avatar_url,name:c.title},52),
   h('div',{class:'mid'},
    h('div',{class:'t'},h('span',{class:'n'},c.pinned?h('span',{class:'pin'},'📌 '):null,(c.kind==='channel'?'📢 ':'')+(c.title||'Без названия'),c.frozen?' ❄️':'',badge(c.kind==='private'?c.peer:c)),h('span',{class:'sub'},(c.last&&c.last.mine?h('span',{class:'ck2'},'✓'):null),c.last?fmtTime(c.last.ts):'')),
    h('div',{class:'p'},h('span',{},last),c.unread?h('span',{class:'badge'+(muted[muteKey(c)]?' m':'')},c.unread):(c.pinned?h('span',{class:'pinic'},'📌'):null)))));});
 if(v&&searchRes.length){
  L.append(h('div',{class:'sec'},'Люди'));
  searchRes.forEach(u=>L.append(h('div',{class:'row',onclick:()=>startPrivate(u.id)},
   av(u,48),h('div',{class:'mid'},h('div',{class:'n'},u.name,badge(u)),h('div',{class:'sub'},handleEl(u),(u.username?' · ':'')+status(u))))));}
 if(v&&searchCh.length){
  L.append(h('div',{class:'sec'},'Каналы'));
  searchCh.forEach(c=>L.append(h('div',{class:'row',onclick:()=>openChannel(c)},
   av({avatar_url:c.avatar_url,name:c.title},48),h('div',{class:'mid'},h('div',{class:'n'},'📢 '+c.title,c.frozen?' ❄️':''),h('div',{class:'sub'},c.members+' подписч.'+(c.joined?' · вы подписаны':'')))))); }
 if(!arr.length&&!(v&&(searchRes.length||searchCh.length)))L.append(h('div',{class:'sub',style:'padding:24px;text-align:center'},v?'Ничего не найдено':'Здесь пока пусто. Нажми 🔍, чтобы найти человека, или ✎, чтобы создать группу'));}

async function startPrivate(uid){
 try{const j=await api('/api/chat/private',{user_id:uid});
  $('#search').value='';searchRes=[];await loadChats();openChat(j.chat_id);
 }catch(e){toast(e.message);}}

/* ---------- чат ---------- */
function openChat(id){cur=id;$('#app').classList.add('open');$('#empty').classList.add('hide');$('#chat').classList.remove('hide');
 $('#msgs').innerHTML='';renderHeader();renderList();loadMessages(true);}
$('#backBtn').onclick=()=>{cur=null;$('#app').classList.remove('open');$('#chat').classList.add('hide');$('#empty').classList.remove('hide');renderList();};

const TXT=$('#txt'),SND=$('#sendBtn');
function renderHeader(){
 const c=chats.find(x=>x.id===cur);if(!c)return;
 if(c.kind==='saved'){const d=h('div',{class:'av saved-av'});d.style.width=d.style.height='42px';d.style.fontSize='18px';d.textContent='⭐';setKids($('#hAv'),d);setKids($('#hName'),'Избранное');}else{setKids($('#hAv'),av({deleted:c.deleted,service:c.peer&&c.peer.service,avatar_url:c.avatar_url,name:c.title},42));setKids($('#hName'),c.title||'Без названия',badge(c.kind==='private'?c.peer:c));}
 const wb=(c.kind==='private'?c.peer:c);const wl=((wb&&wb.badges)||[]).filter(b=>b.kind==='label');
 $('#warn').classList.toggle('hide',!wl.length);setKids($('#warn'),wl.length?h('div',{class:'warnbar'+(wl[0].key==='fake'?' f':'')},'⚠ '+wl.map(b=>b.title).join(' · ')+': '+wl[0].descr):null);
 $('#hSub').textContent=c.kind==='private'?status(c.peer):c.members+(c.kind==='channel'?' подписч.':' участн.');
 $('#hWho').onclick=()=>c.kind==='private'?showProfile(c.peer.id):(c.kind==='channel'?showChannel(c.id):showGroup(c.id));
 $('#hMenu').onclick=e=>{e.stopPropagation();const it=[[c.pinned?'📌 Открепить':'📌 Закрепить',()=>togglePin(c)],
  [muted[muteKey(c)]?'🔔 Включить звук':'🔕 Выключить звук',()=>{if(muted[muteKey(c)])delete muted[muteKey(c)];else muted[muteKey(c)]=1;localStorage.setItem('muted',JSON.stringify(muted));renderList();}]];
  if(c.kind==='channel')it.push(['ℹ️ О канале',()=>showChannel(c.id)]);
  if(c.kind==='private'&&c.peer&&!c.peer.service&&!c.deleted)it.push(['🚩 Пожаловаться',()=>reportDialog('user',c.peer.id,c.title)]);
  if(c.kind!=='private')it.push(['🚩 Пожаловаться',()=>reportDialog('chat',c.id,c.title)]);
  popMenu($('#hMenu'),it,true);};
 const svc=c.kind==='private'&&c.peer&&c.peer.service;
 const gift=c.kind==='private'&&c.peer&&!c.deleted&&!svc&&!c.peer.is_bot;
 let lock=null;
 if(c.kind==='private'&&(c.deleted||svc))lock=svc?'Служебные уведомления. Отвечать нельзя.':'Аккаунт удалён. Отправка сообщений недоступна.';
 else if(c.frozen)lock=c.kind==='private'?'❄️ Бот заморожен администратором.':(c.kind==='channel'?'❄️ Канал заморожен администратором.':'❄️ Группа заморожена администратором.');
 else if(c.kind==='channel'&&!c.can_post)lock='В канале пишет только владелец';
 const focused=document.activeElement===TXT;
 const comp=$('#comp');
 // Не пересоздаём composer, если textarea уже на месте — иначе на телефоне слетает клавиатура
 const needLock=!!lock;
 const hasLock=!!comp.querySelector('.locked');
 const hasTxt=comp.contains(TXT);
 if(needLock){
  if(!hasLock)setKids(comp,h('div',{class:'locked'},lock));
 }else if(!hasTxt||hasLock){
  setKids(comp,[gift?GBTN:null,h('button',{class:'icon',title:'Вложить',onmousedown:e=>e.preventDefault(),onclick:e=>{e.stopPropagation();attachMenu(e.currentTarget);}},'📎'),TXT,SND]);
  if(focused)try{TXT.focus({preventScroll:true});}catch(_){TXT.focus();}
 }else{
  // только обновить кнопку подарка при необходимости
  const hasGift=!!comp.querySelector('button[title="Подарок"]');
  if(gift&&!hasGift)comp.insertBefore(GBTN,TXT);
  if(!gift&&hasGift)comp.querySelector('button[title="Подарок"]').remove();
 }
}

async function loadMessages(scroll){
 const id=cur;if(!id)return;
 const keepFocus=document.activeElement===TXT;
 const j=await api('/api/messages?chat_id='+id+'&read=1');
 if(id!==cur)return;
 const box=$('#msgs');const near=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 const c=chats.find(x=>x.id===id);const group=c&&c.kind==='group';
 const peerRead=j.peer_last_read||0;
 setKids(box,j.messages.map(m=>{
  const mine=m.uid===me.id;
  const ticks=mine?(m.id<=peerRead?h('span',{class:'ticks rd'},'✓✓'):h('span',{class:'ticks'},'✓')):null;
  const media=mediaEl(m);
  const bub=h('div',{class:'bub'},
   group&&!mine?h('div',{class:'who'+(m.sender.deleted?' d':''),onclick:()=>showProfile(m.sender.id)},m.sender.name,badge(m.sender)):null,
   m.gift?giftCard(m.gift):(media||m.text),
   h('span',{class:'tm'},fmtTime(m.ts),ticks));
  return h('div',{class:'m'+(mine?' me':'')},group&&!mine?av(m.sender,32):null,bub);}));
 if(scroll||near)box.scrollTop=box.scrollHeight;
 if(keepFocus)try{TXT.focus({preventScroll:true});}catch(_){TXT.focus();}
 const cc=chats.find(x=>x.id===id);
 if(cc&&cc.unread){cc.unread=0;renderList();loadChats().catch(()=>{});}}



function compressImageForUpload(file,maxSide,quality){
 return new Promise(async(res,rej)=>{
  try{
   if(await isAnimated(file)){const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('read'));r.readAsDataURL(file);return;}
   let bmp;
   if(typeof createImageBitmap==='function'){try{bmp=await createImageBitmap(file);}catch(e){}}
   if(!bmp){
    const data=await fileToDataURL(file);
    bmp=await new Promise((r,j)=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>j(new Error('bad image'));im.src=data;});
   }
   let w=bmp.width,h=bmp.height;
   const sc=Math.min(1,(maxSide||1280)/Math.max(w,h));w=Math.round(w*sc);h=Math.round(h*sc);
   const c=document.createElement('canvas');c.width=w;c.height=h;
   c.getContext('2d').drawImage(bmp,0,0,w,h);
   if(bmp.close)try{bmp.close();}catch(e){}
   let q=quality||0.85,out;
   for(let i=0;i<6;i++){out=c.toDataURL('image/jpeg',q);if(out.length<2_500_000)break;q-=0.1;}
   res(out);
  }catch(e){rej(e);}
 });
}

function mediaEl(m){
 if(!m.media_url)return null;
 const k=m.media_kind||'';
 if(k==='photo')return h('img',{class:'media-img',src:m.media_url,loading:'lazy',onclick:()=>window.open(m.media_url,'_blank')});
 if(k==='voice')return h('div',{class:'media-voice'},'🎤',h('audio',{controls:true,src:m.media_url,preload:'metadata'}));
 if(k==='video_note')return h('video',{class:'vnote',src:m.media_url,controls:true,playsinline:true});
 if(k==='video')return h('video',{src:m.media_url,controls:true,playsinline:true,style:'max-width:min(260px,70vw);border-radius:12px;margin:4px 0'});
 if(k==='file')return h('a',{class:'media-file',href:m.media_url,download:true,target:'_blank'},'📎',h('span',{},(m.text||'Файл').replace(/^📎 /,'')));
 return null;
}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Не удалось прочитать файл'));r.readAsDataURL(file);});}
async function sendMedia(kind,file,extra){
 if(!cur||!file)return;
 try{toast('Отправка…');const data=await fileToDataURL(file);
  const body=Object.assign({chat_id:cur,kind,data},extra||{});
  if(kind==='file')body.name=file.name||'file';
  await api('/api/send_media',body);await loadMessages(true);loadChats();
 }catch(e){toast(e.message);}
}
function attachMenu(btn){
 const photo=h('input',{type:'file',accept:'image/*',class:'hide'});
 const file=h('input',{type:'file',class:'hide'});
 const video=h('input',{type:'file',accept:'video/*',class:'hide'});
 photo.onchange=async()=>{if(!photo.files[0])return;try{const data=await compressImageForUpload(photo.files[0],1600,0.85);await api('/api/send_media',{chat_id:cur,kind:'photo',data});await loadMessages(true);loadChats();}catch(e){toast(e.message);}};
 file.onchange=()=>{if(file.files[0])sendMedia('file',file.files[0]);};
 video.onchange=()=>{if(video.files[0])sendMedia('video',video.files[0]);};
 popMenu(btn,[['📷 Фото',()=>photo.click()],['📎 Файл',()=>file.click()],['🎬 Видео',()=>video.click()],['🎤 Голосовое',()=>recordVoice()],['⭕ Кружок',()=>recordCircle()]],false);
 document.body.append(photo,file,video);
}
async function recordVoice(){
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const rec=new MediaRecorder(stream);const chunks=[];
  rec.ondataavailable=e=>chunks.push(e.data);const start=Date.now();
  rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());
   const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});
   await sendMedia('voice',new File([blob],'voice.webm',{type:blob.type}),{dur:Math.max(1,Math.round((Date.now()-start)/1000))});};
  rec.start();toast('Запись голоса… тапни чтобы остановить');
  const stop=()=>{if(rec.state==='recording')rec.stop();document.removeEventListener('click',stop);};
  setTimeout(()=>document.addEventListener('click',stop),400);
 }catch(e){toast('Нет доступа к микрофону');}
}
async function recordCircle(){
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode:'user',width:480,height:480}});
  const mt=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm';
  const rec=new MediaRecorder(stream,{mimeType:mt});const chunks=[];
  rec.ondataavailable=e=>chunks.push(e.data);const start=Date.now();
  const ov=h('div',{class:'overlay dim',style:'z-index:90;display:flex;flex-direction:column;align-items:center;justify-content:center'});
  const v=h('video',{autoplay:true,muted:true,playsinline:true,style:'width:min(280px,80vw);height:min(280px,80vw);border-radius:50%;object-fit:cover;background:#000'});
  v.srcObject=stream;
  rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());ov.remove();
   const blob=new Blob(chunks,{type:rec.mimeType||'video/webm'});
   await sendMedia('video_note',new File([blob],'circle.webm',{type:blob.type}),{dur:Math.max(1,Math.min(60,Math.round((Date.now()-start)/1000)))});
  };
  rec.start();
  ov.append(v,h('div',{class:'sub',style:'color:#fff;margin-top:10px'},'Кружок · до 60 сек'),
   h('button',{class:'btn',style:'width:auto;margin-top:12px',onclick:()=>rec.stop()},'Стоп · отправить'));
  document.body.append(ov);setTimeout(()=>{if(rec.state==='recording')rec.stop();},60000);
 }catch(e){toast('Нет доступа к камере');}
}
async function openSaved(){
 try{const j=await api('/api/saved',{});await loadChats();openChat(j.chat_id);}catch(e){toast(e.message);}
}
async function loadStoryBar(){
 const host=document.getElementById('storyBar');if(!host||!me)return;
 try{
  const j=await api('/api/stories');
  const items=[];
  const mine=(j.stories||[]).find(s=>s.mine);
  // кнопка «добавить» / свои истории
  items.push(h('div',{class:'story-item',onclick:()=>mine&&mine.count?openStoryViewer(me.id):openStoryEditor()},
   h('div',{class:'ring'+(mine&&mine.count?'':' seen')},h('div',{style:'position:relative'},av(me,48),h('span',{class:'story-add'},'+'))),
   h('div',{class:'lab'},'Моя')));
  (j.stories||[]).forEach(s=>{
   if(s.mine)return;
   items.push(h('div',{class:'story-item',onclick:()=>openStoryViewer(s.user.id)},
    h('div',{class:'ring'+(s.unseen?'':' seen')},h('div',{},av(s.user,48))),
    h('div',{class:'lab'},((s.user.name||'?').split(' ')[0]))));
  });
  // кнопка создать всегда отдельно если уже есть свои
  if(mine&&mine.count){
   items.splice(1,0,h('div',{class:'story-item',onclick:()=>openStoryEditor()},
    h('div',{class:'ring seen'},h('div',{style:'display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;color:#2aabee'},'+')),
    h('div',{class:'lab'},'Добавить')));
  }
  setKids(host,items);
  host.style.display='flex';
 }catch(e){console.warn('stories',e);host.style.display='flex';
  setKids(host,[h('div',{class:'story-item',onclick:()=>openStoryEditor()},
   h('div',{class:'ring seen'},h('div',{},av(me,48))),h('div',{class:'lab'},'Моя'))]);
}}
function openStoryEditor(){
 const ov=h('div',{class:'overlay dim'});const close=()=>ov.remove();
 const file=h('input',{type:'file',accept:'image/*',class:'hide'});
 const txt=h('textarea',{class:'inp',rows:3,placeholder:'Текст истории',maxlength:300});
 const bg=h('div',{class:'sws'});let bgI=0;
 const paint=()=>setKids(bg,BANNERS.map(function(_,i){return h('div',{class:'swc'+(bgI===i?' on':''),style:'background:'+bannerBg(i),onclick:function(){bgI=i;paint();}})}));
 paint();
 file.onchange=async function(){if(!file.files[0])return;try{toast('Загрузка…');const data=await compressImageForUpload(file.files[0],1080,0.82);await api('/api/story/create',{kind:'photo',data:data,text:txt.value});toast('История опубликована');close();loadStoryBar();}catch(e){toast(e.message);}};
 ov.append(h('div',{class:'modal'},h('h3',{},'История'),
  h('div',{class:'sub'},'24 часа (Premium — 48)'),txt,h('div',{class:'lbl'},'Фон текста'),bg,
  h('button',{class:'btn',onclick:async function(){if(!txt.value.trim())return toast('Введи текст');try{await api('/api/story/create',{kind:'text',text:txt.value,bg:bgI});toast('История опубликована');close();loadStoryBar();}catch(e){toast(e.message);}}},'Опубликовать текст'),
  h('button',{class:'btn',onclick:function(){file.click();}},'Фото-история'),file,
  h('button',{class:'btn gray',onclick:close},'Отмена')));
 document.body.append(ov);
}
async function openStoryViewer(uid){
 let j;try{j=await api('/api/stories/user?id='+uid);}catch(e){return toast(e.message);}
 const list=j.stories||[];if(!list.length)return toast('Историй нет');
 let idx=0,tm;
 const ov=h('div',{class:'story-view'});
 const prog=h('div',{class:'prog'}),top=h('div',{class:'sv-top'}),body=h('div',{class:'sv-body'});
 const close=function(){clearTimeout(tm);ov.remove();loadStoryBar();};
 function paint(){
  const s=list[idx];if(!s){close();return;}
  setKids(prog,list.map(function(_,k){return h('i',{},h('b',{style:'width:'+(k<idx?'100%':'0%')}))}));
  setKids(top,av(j.user,32),h('b',{},j.user.name),h('span',{style:'flex:1'}),h('button',{class:'icon',style:'color:#fff',onclick:close},'✕'));
  if(s.kind==='photo'&&s.media_url)setKids(body,h('img',{src:s.media_url,style:'max-width:100%;max-height:100%'}));
  else setKids(body,h('div',{style:'background:'+bannerBg(s.bg||0)+';width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;padding:24px;text-align:center'},s.text||''));
  api('/api/story/view',{id:s.id}).catch(function(){});
  const bar=prog.children[idx]&&prog.children[idx].firstChild;
  if(bar){bar.style.transition='none';bar.style.width='0%';requestAnimationFrame(function(){bar.style.transition='width 5s linear';bar.style.width='100%';});}
  clearTimeout(tm);tm=setTimeout(function(){idx++;if(idx>=list.length)close();else paint();},5000);
 }
 ov.onclick=function(e){if(e.target===ov||e.target===body){idx++;if(idx>=list.length)close();else paint();}};
 ov.append(prog,top,body);document.body.append(ov);paint();
}


async function send(){
 const t=TXT.value.trim();if(!t||!cur)return;
 TXT.value='';TXT.style.height='auto';
 // Сразу возвращаем фокус — на мобильных иначе клавиатура закрывается
 try{TXT.focus({preventScroll:true});}catch(_){TXT.focus();}
 try{await api('/api/send',{chat_id:cur,text:t});await loadMessages(true);
  try{TXT.focus({preventScroll:true});}catch(_){TXT.focus();}}
 catch(e){toast(e.message);TXT.value=t;try{TXT.focus({preventScroll:true});}catch(_){TXT.focus();}}}
// mousedown preventDefault — кнопка не забирает фокус у textarea (клавиатура не слетает)
SND.onmousedown=e=>{e.preventDefault();};
SND.onclick=send;
TXT.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&window.innerWidth>720&&localStorage.getItem('entsend')!=='0'){e.preventDefault();send();}};
TXT.oninput=e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px';};

