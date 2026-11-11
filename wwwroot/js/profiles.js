/* ---------- меню ---------- */
function popMenu(anchor,items,right){
 document.querySelectorAll('.menu').forEach(x=>x.remove());
 const m=h('div',{class:'menu'},items.map(([t,fn])=>h('div',{onclick:()=>{m.remove();fn();}},t)));
 document.body.append(m);
 const r=anchor.getBoundingClientRect();
 const mh=m.offsetHeight,mw=m.offsetWidth,vh=window.innerHeight,vw=window.innerWidth;
 // не уезжать за низ экрана — открываем вверх при необходимости
 let top=r.bottom+4;
 if(top+mh>vh-8) top=r.top-mh-4;
 if(top<8) top=8;
 if(top+mh>vh-8){top=Math.max(8,vh-mh-8);m.style.maxHeight=(vh-16)+'px';m.style.overflowY='auto';}
 let left;
 if(right){
  left=Math.min(r.right,vw-8)-mw;
  if(left<8) left=8;
 }else{
  left=Math.max(8,Math.min(r.left,vw-mw-8));
 }
 m.style.top=top+'px';m.style.left=left+'px';m.style.right='auto';
 setTimeout(()=>document.addEventListener('click',function f(){m.remove();document.removeEventListener('click',f);}),0);}
$('#menuBtn').onclick=e=>{e.stopPropagation();
 popMenu($('#menuBtn'),[['👤 Мой профиль',()=>showProfile(me.id)],['⭐ Избранное',openSaved],['👛 Кошелёк',showWallet],['⭐ Чеки Send',showChecks],['🔷 GodFragment',()=>showFragment()],['🛍 Маркет NFT',showMarket],['👥 Новая группа',newGroup],['📢 Новый канал',newChannel],['🤖 Мои боты',showBots],['⭐ GodGram Premium',showPremium],['💎 Мои NFT',myNft],['⚙️ Настройки',showSettings],
  ...(me.is_admin?[['🛡 Админ-панель',adminPanel]]:[]),['🚪 Выйти',()=>logout(false)]]);};
$('#fab').onclick=newGroup;

/* ---------- баннеры профиля ---------- */
const BANNERS=[['#ff8a8a','#d94841'],['#ffbe6b','#e5792a'],['#c3a0ff','#7254e0'],['#7be08a','#2f9e48'],['#6fe0ea','#25a0b4'],['#7cc0ff','#3a7be0'],
 ['#ff9ccb','#d8478f'],['#aab3c0','#586577'],['#ffe07a','#ff7a45'],['#ff72a0','#7a5cff'],['#46f08a','#0f9a85'],['#56b4ff','#00d8f5'],
 ['#3b5a7a','#14202c']];
const GOD_PATTERN='data:image/png;base64,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';
const PATTERNS=['','⭐','❤️','🌸','🍀','🔥','❄️','🎮','🐱','🌙','💎','⚡','🎉','🔺',GOD_PATTERN];
const STATUSES=['','😎','🔥','🚀','👑','💎','🎮','🌈','❤️','🦄','🍀','⚡'];
const PAT=[[8,12,22],[22,6,16],[38,10,20],[62,8,18],[78,5,24],[92,14,18],[5,34,16],[15,52,24],[30,38,14],[70,36,14],[85,48,24],[95,32,16],
 [10,75,18],[26,84,22],[44,90,14],[58,86,18],[76,82,22],[90,72,16],[50,4,12],[3,60,14],[97,58,14],[20,24,12],[80,22,12],[35,72,12],[65,70,12]];
const bannerBg=i=>i>=0&&BANNERS[i]?'linear-gradient(160deg,'+BANNERS[i][0]+','+BANNERS[i][1]+')':'linear-gradient(160deg,#233140,#0f1720)';
function isBannerImg(p){return !!(p&&String(p).startsWith('data:image/'));}
function patternChipLabel(p){
 if(!p)return '✕';
 if(isBannerImg(p))return h('img',{src:p,alt:'logo',style:'width:22px;height:22px;object-fit:contain;display:block;border-radius:4px;background:#000'});
 return p;
}
function patternEl(p){
 const d=h('div',{class:'pat'});
 if(!p)return d;
 if(isBannerImg(p)){
  // своё фото/GIF как УЗОР — раскидываем миниатюры по точкам, как эмодзи
  d.classList.add('pat-custom');
  PAT.forEach(([x,y,s])=>{
   const e=h('img',{src:p,alt:'',draggable:'false',class:'pat-tile'});
   e.style.cssText='left:'+x+'%;top:'+y+'%;width:'+Math.max(18,s)+'px;height:'+Math.max(18,s)+'px';
   d.append(e);
  });
  return d;
 }
 PAT.forEach(([x,y,s])=>{const e=h('span',{},p);e.style.cssText='left:'+x+'%;top:'+y+'%;font-size:'+s+'px';d.append(e);});
 return d;}
function bannerStyle(b){
 if(!b)return DEFBAN;
 if(b.color>=0)return bannerBg(b.color);
 return DEFBAN;
}

/* ---------- профиль ---------- */
function toggle(on,fn){const t=h('div',{class:'tg'+(on?' on':'')});t.onclick=()=>{const v=!t.classList.contains('on');t.classList.toggle('on',v);fn(v);};return t;}
const pinfo=(v,l)=>h('div',{class:'pi'},h('div',{},h('div',{class:'v'},v),h('div',{class:'l'},l)));

/* ---------- собственные векторные модели NFT-подарков ---------- */
const SVGART={
 lollipop:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="a" cx=".4" cy=".35"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ff5fa2"/></radialGradient></defs><rect x="46" y="56" width="9" height="42" rx="4.5" fill="#f1dcc8" transform="rotate(-32 50 60)"/><circle cx="42" cy="40" r="31" fill="url(#a)"/><path d="M42 40c3 0 5 3 3 6s-8 4-12-1-3-14 5-18 20-1 23 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/></svg>',
 star:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd6ff"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs><circle cx="50" cy="9" r="5" fill="none" stroke="#9fb4ff" stroke-width="3"/><path d="M50 14l9 21 23 2-17 15 5 23-20-12-20 12 5-23-17-15 23-2z" fill="url(#a)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><circle cx="42" cy="50" r="3.2" fill="#1b1b3a"/><circle cx="58" cy="50" r="3.2" fill="#1b1b3a"/><path d="M44 58q6 6 12 0" fill="none" stroke="#1b1b3a" stroke-width="2.6" stroke-linecap="round"/></svg>',
 wizard:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a7bff"/><stop offset="1" stop-color="#4b3bd0"/></linearGradient></defs><path d="M20 76C34 66 38 40 52 14c4 20 20 46 30 62z" fill="url(#a)"/><path d="M26 66h56v8H26z" fill="#ffd54a"/><ellipse cx="50" cy="78" rx="42" ry="9" fill="#5a46e0"/><path d="M52 34l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" fill="#fff" opacity=".9"/></svg>',
 bells:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#f0a21f"/></linearGradient></defs><g transform="rotate(-14 30 40)"><path d="M12 62c3-4 3-10 4-18 1-12 8-20 15-20s14 8 15 20c1 8 1 14 4 18z" fill="url(#a)" stroke="#b9741a" stroke-width="2"/><circle cx="31" cy="68" r="5" fill="#d9531e"/></g><g transform="rotate(14 70 40)"><path d="M52 62c3-4 3-10 4-18 1-12 8-20 15-20s14 8 15 20c1 8 1 14 4 18z" fill="url(#a)" stroke="#b9741a" stroke-width="2"/><circle cx="71" cy="68" r="5" fill="#d9531e"/></g><path d="M50 22l-10-9 10 4 10-4z" fill="#ff4d6d"/><circle cx="50" cy="20" r="4" fill="#ff4d6d"/></svg>',
 wand:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8fd0"/><stop offset="1" stop-color="#d63fa0"/></linearGradient></defs><rect x="44" y="30" width="12" height="64" rx="6" fill="url(#a)" transform="rotate(38 50 62)"/><path d="M30 30l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" fill="#ffe27a" stroke="#fff" stroke-width="2" stroke-linejoin="round" transform="translate(6 -8)"/><circle cx="80" cy="24" r="3" fill="#fff"/><circle cx="18" cy="70" r="2.5" fill="#fff"/></svg>',
 crystal:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6f3ff"/><stop offset="1" stop-color="#3b8cff"/></linearGradient></defs><path d="M50 8L84 36 50 94 16 36z" fill="url(#a)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 36h68M36 36L50 8l14 28M36 36l14 58 14-58" fill="none" stroke="#fff" stroke-width="2" opacity=".75"/><path d="M50 8L36 36h28z" fill="#fff" opacity=".35"/></svg>',
 jester:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a7a"/><stop offset="1" stop-color="#b3205c"/></linearGradient></defs><path d="M14 74C8 50 10 30 14 18c8 8 14 22 18 38 4-18 10-30 18-40 8 10 14 22 18 40 4-16 10-30 18-38 4 12 6 32 0 56z" fill="url(#a)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><rect x="12" y="68" width="76" height="14" rx="7" fill="#ffd54a" stroke="#fff" stroke-width="2"/><circle cx="14" cy="16" r="6" fill="#ffd54a"/><circle cx="50" cy="12" r="6" fill="#ffd54a"/><circle cx="86" cy="16" r="6" fill="#ffd54a"/></svg>',
 cupcake:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd0e6"/><stop offset="1" stop-color="#ff7fb6"/></linearGradient></defs><path d="M20 52h60L72 90H28z" fill="#f2b36b" stroke="#c9822f" stroke-width="2.5" stroke-linejoin="round"/><path d="M28 56v30M40 56v32M52 56v32M64 56v32" stroke="#c9822f" stroke-width="2" opacity=".5"/><path d="M16 54c-4-14 8-18 14-18 0-14 22-20 34-8 12-2 22 8 18 20 4 4 0 8-6 8z" fill="url(#a)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><circle cx="52" cy="18" r="7" fill="#e0243c"/><path d="M52 11q4-6 9-5" fill="none" stroke="#3a8f3a" stroke-width="2.5" stroke-linecap="round"/></svg>',
 balloon:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ab8"/><stop offset="1" stop-color="#e0245e"/></linearGradient></defs><path d="M50 74C14 50 14 14 36 14c8 0 12 4 14 10 2-6 6-10 14-10 22 0 22 36-14 60z" fill="url(#a)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 74q-8 8 0 14t0 10" fill="none" stroke="#cfd6de" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="34" cy="28" rx="6" ry="4" fill="#fff" opacity=".55" transform="rotate(-30 34 28)"/></svg>',
 giftbox:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fe0b0"/><stop offset="1" stop-color="#1f9a8a"/></linearGradient></defs><rect x="14" y="40" width="72" height="50" rx="5" fill="url(#a)" stroke="#fff" stroke-width="2.5"/><rect x="8" y="28" width="84" height="18" rx="5" fill="#3cc4a4" stroke="#fff" stroke-width="2.5"/><rect x="44" y="28" width="12" height="62" fill="#ffd54a"/><path d="M50 28C34 6 18 14 28 24c6 6 22 4 22 4zM50 28C66 6 82 14 72 24c-6 6-22 4-22 4z" fill="#ffd54a" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>'};
function artEl(glyph){ // 'svg:имя[:угол]' -> <img> с оттенком
 const p=String(glyph).split(':'),src=SVGART[p[1]]||SVGART.star;
 const i=h('img',{src:'data:image/svg+xml;utf8,'+encodeURIComponent(src),draggable:'false'});
 if(p[2]&&+p[2])i.style.filter='hue-rotate('+(+p[2])+'deg)';
 return i;}
const fmtK=n=>n>=1000?(n/1000).toFixed(1).replace('.',',').replace(',0','')+'K':String(n);

/* ---------- NFT-подарки: карточка и просмотр ---------- */
const rarTxt=r=>(r/10).toFixed(r%10?1:0).replace('.0','')+'%';
/* Telegram-style rarity tiers (по промилле редкости атрибута) */
/* Уровни рейтинга подарков как в Telegram (пороги очков) */
const RATING_LEVELS=[0,10,25,50,100,200,350,550,800,1200,1800,2500,4000,6000,9000,15000,25000,50000,100000];
function ratingInfo(n){
 n=Math.floor(+n||0);
 if(n<0){
  // отрицательный: «уровень» 0, полоска показывает глубину минуса до -100
  const depth=Math.min(100,Math.abs(n));
  return {n,level:0,next:0,need:0,pct:depth,neg:true,label:String(n)};
 }
 let lv=0;
 for(let i=0;i<RATING_LEVELS.length;i++){if(n>=RATING_LEVELS[i])lv=i;else break;}
 const cur=RATING_LEVELS[lv],nxt=RATING_LEVELS[lv+1];
 let pct=100,need=0;
 if(nxt!=null){need=nxt-n;pct=Math.max(0,Math.min(100,Math.round((n-cur)/(nxt-cur)*100)));}
 return {n,level:lv,next:nxt,need,pct,neg:false,label:String(n)};
}
function ratingBadge(n,opt){
 opt=opt||{};
 const info=ratingInfo(n);
 const cls='stdot'+(info.neg?' neg':(info.n===0?' zero':''));
 return h('span',{class:cls,title:'Рейтинг '+(info.n>0?'+':'')+info.n+(info.neg?'':(' · ур. '+info.level)),
  onclick:opt.onclick||null,style:opt.onclick?'cursor:pointer':''},info.label);
}
function ratingBar(n){
 const info=ratingInfo(n);
 if(info.neg){
  return h('div',{class:'rbar-wrap'},
   h('div',{class:'rbar-meta'},h('span',{},'Рейтинг '+info.n),h('span',{},'восстанови подарками')),
   h('div',{class:'rbar neg'},h('i',{style:'width:'+info.pct+'%'})));
 }
 if(info.next==null){
  return h('div',{class:'rbar-wrap'},
   h('div',{class:'rbar-meta'},h('span',{},'Уровень '+info.level),h('span',{},'макс.')),
   h('div',{class:'rbar full'},h('i',{style:'width:100%'})));
 }
 return h('div',{class:'rbar-wrap'},
  h('div',{class:'rbar-meta'},h('span',{},'Уровень '+info.level),h('span',{},info.need+' до '+(info.level+1))),
  h('div',{class:'rbar'},h('i',{style:'width:'+info.pct+'%'})));
}
function fmtRating(n){return ratingBadge(n);} // совместимость для админки
function showRating(uid){
 const ov=h('div',{class:'overlay dim'});const box=h('div',{class:'modal'});
 (async()=>{try{const j=await api('/api/rating?id='+uid);const info=ratingInfo(j.rating);
  setKids(box,h('h3',{},'Рейтинг'),
  h('div',{style:'display:flex;justify-content:center;margin:8px 0 6px'},ratingBadge(j.rating)),
  ratingBar(j.rating),
  h('div',{class:'sub',style:'margin:12px 0 10px;text-align:center'},'Отправка подарков повышает рейтинг. Получатель может поставить 👍 или 👎. Метки СКАМ/ФЕЙК снижают.'),
  j.log.length?j.log.map(r=>h('div',{class:'rlog'},h('div',{},h('div',{},r.note||r.kind),h('div',{class:'sub'},(r.from?r.from+' · ':'')+fmtDT(r.ts))),h('div',{class:'d '+(r.delta>0?'pos':'neg')},(r.delta>0?'+':'')+r.delta))):
  h('div',{class:'sub'},'Пока нет изменений'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть'));
 }catch(e){setKids(box,h('div',{class:'err'},e.message),h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть'));}})();
 ov.append(box);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}
function rarTier(r){
 r=+r||0;
 if(r<=20)return {key:'legend',title:'Легендарный',color:'#ffd86b'};
 if(r<=50)return {key:'epic',title:'Эпический',color:'#d4a8ff'};
 if(r<=100)return {key:'rare',title:'Редкий',color:'#7ec8ff'};
 return {key:'common',title:'Обычный',color:'#c5d0dc'};
}
function rarPill(r){const t=rarTier(r);return h('span',{class:'rar-pill rar-'+t.key},t.title+' · '+rarTxt(r));}
function itemRank(it){
 /* рейтинг уникальности как в TG Collectibles: чем меньше product rarity, тем выше ранг */
 const a=(+it.model.rar||1000)/1000,b=(+it.backdrop.rar||1000)/1000,c=(+it.symbol.rar||1000)/1000;
 const score=Math.max(0.0001,a*b*c);
 const pct=Math.min(99.9,Math.max(0.1,score*100));
 const est=it.supply?Math.max(1,Math.round(it.supply*score)):null;
 return {score,pct,est,tier:rarTier(Math.min(+it.model.rar||999,+it.backdrop.rar||999,+it.symbol.rar||999))};
}
function nftCard(it,size,opt){opt=opt||{};
 const rk=itemRank(it);
 const d=h('div',{class:'nftc',style:'background:radial-gradient(circle at 50% 38%,'+it.backdrop.c1+','+it.backdrop.c2+')',onclick:opt.onclick||(()=>nftPreview(it,opt.ctx))});
 d.append(patternEl(it.symbol.glyph),gift3d({glyph:it.glyph,model:'extrude',anim:it.anim,color:it.backdrop.c1},size||80),
  h('div',{class:'nn'},it.coll),h('div',{class:'nu'},'№'+it.number+(it.supply?' из '+fmtK(it.supply):'')),
  h('div',{class:'nu',style:'color:'+rk.tier.color+';font-weight:700'},rk.tier.title+' · '+rk.pct.toFixed(rk.pct<1?2:1).replace('.',',')+'%'),
  it.supply?h('div',{class:'rib'},h('span',{},'1 из '+fmtK(it.supply))):null);
 if(it.listed&&it.price)d.append(h('div',{class:'np'},fmtStars(it.price)));
 return d;}
function nftPreview(it,ctx){
 const ov=h('div',{class:'overlay dim'});const close=()=>ov.remove();
 const mine=it.owner&&it.owner.id===me.id;
 const panel=h('div',{style:'position:relative;border-radius:18px;overflow:hidden;padding:14px 0 10px;background:radial-gradient(circle at 50% 40%,'+it.backdrop.c1+','+it.backdrop.c2+')'},
  patternEl(it.symbol.glyph),h('div',{style:'position:relative'},gift3d({glyph:it.glyph,model:'extrude',anim:it.anim,color:it.backdrop.c1},200,true)));
 const attr=(l,v,r)=>h('div',{class:'attr'},h('span',{},l),h('b',{},v,rarPill(r)));
 const rk=itemRank(it);
 const acts=[];
 if(ctx&&ctx.market&&!mine)acts.push(h('button',{class:'btn',onclick:async()=>{
  try{const j=await api('/api/market/buy',{kind:'nft',id:it.id});close();toast('Куплено 🎉');await refreshMe();ctx.after&&ctx.after();}catch(e){toast(e.message);}}},'Купить за '+fmtStars(it.price)));
 if(mine){
  if(it.listed)acts.push(h('button',{class:'btn gray',onclick:async()=>{try{await api('/api/market/unlist',{kind:'nft',id:it.id});close();ctx&&ctx.after&&ctx.after();toast('Снято с продажи');}catch(e){toast(e.message);}}},'Снять с продажи'));
  else acts.push(h('button',{class:'btn',onclick:async()=>{const p=prompt('Цена в звёздах ⭐:','100');if(!p)return;
   try{await api('/api/market/list',{kind:'nft',id:it.id,price:+p});close();ctx&&ctx.after&&ctx.after();toast('Выставлено на маркет');}catch(e){toast(e.message);}}},'Продать на маркете'));
  const wearing=me.status_nft&&me.status_nft.id===it.id;
  acts.push(h('button',{class:'btn',style:'background:linear-gradient(90deg,#6c8cff,#c65bff)',onclick:async()=>{try{await api('/api/nft/wear',{id:wearing?0:it.id});close();await refreshMe();await refresh();toast(wearing?'Статус снят':'Теперь это твой эмодзи-статус ✨');ctx&&ctx.after&&ctx.after();}catch(e){toast(e.message);}}},wearing?'Снять эмодзи-статус':'✨ Носить как эмодзи-статус'));
  acts.push(h('button',{class:'btn gray',onclick:()=>{close();pickUser(async u=>{try{await api('/api/nft/send',{id:it.id,user_id:u.id});toast('Подарено 🎁');ctx&&ctx.after&&ctx.after();}catch(e){toast(e.message);}});}},'Подарить другу'));}
 ov.append(h('div',{class:'modal',style:'max-width:400px'},panel,h('h3',{style:'text-align:center;margin:10px 0 2px'},it.name),
  h('div',{class:'sub c',style:'margin-bottom:8px'},'Коллекция «'+it.coll+'»'+(it.owner?' · владелец '+it.owner.name:' · на маркете')),
  h('div',{style:'text-align:center;margin:6px 0 10px'},
   h('span',{class:'rar-pill rar-'+rk.tier.key,style:'font-size:13px;padding:4px 12px'},rk.tier.title),
   h('div',{class:'sub',style:'margin-top:6px'},'Рейтинг уникальности · топ '+rk.pct.toFixed(rk.pct<1?2:1).replace('.',',')+'%'+(rk.est?' · ~'+rk.est+' из '+(it.supply||'?')+' таких':''))),
  attr('Модель',it.model.name,it.model.rar),attr('Фон',it.backdrop.name,it.backdrop.rar),attr('Узор',it.symbol.name,it.symbol.rar),
  h('div',{class:'sub c',style:'margin:8px 0'},'Покрути подарок пальцем 👆'),acts,
  h('button',{class:'btn gray',onclick:close},'Закрыть')));
 ov.onclick=e=>{if(e.target===ov)close();};document.body.append(ov);}
function pickUser(cb){
 const ov=h('div',{class:'overlay dim'});let t=0;
 const find=h('input',{class:'inp',placeholder:'Кому: имя, @юзернейм или номер'}),list=h('div');
 find.oninput=()=>{clearTimeout(t);t=setTimeout(async()=>{const v=find.value.trim();if(!v){setKids(list);return;}
  try{const r=await api('/api/users?q='+encodeURIComponent(v));
   setKids(list,r.users.filter(u=>!u.is_bot&&!u.service).slice(0,8).map(u=>h('div',{class:'ur',onclick:()=>{ov.remove();cb(u);}},av(u,36),h('div',{class:'mid'},u.name,badge(u)))));}catch(e){}},250);};
 ov.append(h('div',{class:'modal'},h('h3',{},'Выбери получателя'),find,list,h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена')));
 ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

/* ---------- профиль в стиле Telegram ---------- */
const MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
function fmtBirth(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');if(!m)return '';
 const n=new Date();let age=n.getFullYear()-+m[1];if(n.getMonth()+1<+m[2]||(n.getMonth()+1===+m[2]&&n.getDate()<+m[3]))age--;
 return +m[3]+' '+MON[+m[2]-1]+' '+m[1]+' ('+age+')';}
function isOpenNow(f,t){if(!f||!t)return null;const n=new Date(),c=n.getHours()*60+n.getMinutes();
 const p=x=>{const a=x.split(':');return +a[0]*60+ +a[1];};const a=p(f),b=p(t);return a<=b?(c>=a&&c<b):(c>=a||c<b);}
const DEFBAN='linear-gradient(180deg,#5d7186,#2f3b48)';
async function showProfile(uid){
 let u;try{u=(await api('/api/user?id='+uid)).user;}catch(e){return toast(e.message);}
 const ov=h('div',{class:'overlay pf'});const close=()=>ov.remove();
 const self=u.id===me.id;
 const canDel=me.is_admin&&!self&&!u.deleted&&!u.is_admin&&!u.service;
 const key='u'+u.id;
 const back=h('button',{class:'icon',style:'color:#fff;font-size:26px',onclick:close},'←');
 const right=h('button',{class:'icon',style:'color:#fff',onclick:()=>{if(self)showEdit(close);}},self?'✎':'');
 const b=u.banner;
 const names=u.usernames||[];
 const act=(ic,t,fn)=>h('button',{class:'pact',onclick:fn},h('i',{},ic),t);
 const acts=[];
 if(!self&&!u.service&&!u.deleted)acts.push(act('💬','Написать',async()=>{try{const j=await api('/api/chat/private',{user_id:u.id});await loadChats();close();openChat(j.chat_id);}catch(e){toast(e.message);}}));
 if(!self&&!u.service&&!u.deleted)acts.push(act(muted[key]?'🔕':'🔔','Звук',e=>{if(muted[key])delete muted[key];else muted[key]=1;localStorage.setItem('muted',JSON.stringify(muted));e.currentTarget.firstChild.textContent=muted[key]?'🔕':'🔔';}));
 if(!self&&!u.service&&!u.deleted&&!u.is_bot)acts.push(act('🎁','Подарок',async()=>{try{const j=await api('/api/chat/private',{user_id:u.id});await loadChats();close();openChat(j.chat_id);setTimeout(openGiftShop,150);}catch(e){toast(e.message);}}));
 if(self){acts.push(act('✎','Изменить',()=>showEdit(close)),act('👛','Кошелёк',()=>{close();showWallet();}),act('🔷','Fragment',()=>{close();showFragment();}),act('🛍','Маркет',()=>{close();showMarket();}));}
 const more=[];
 if(!self&&!u.service&&!u.deleted)more.push(['🚩 Пожаловаться',()=>reportDialog('user',u.id,u.name)]);
 if(names.length)more.push(['📋 Скопировать @'+names[0].handle,()=>{try{navigator.clipboard.writeText('@'+names[0].handle);toast('Скопировано');}catch(e){}}]);
 if(canDel)more.push(['🗑 Удалить '+(u.is_bot?'бота':'аккаунт'),()=>deleteUser(u,close)]);
 if(me.is_admin&&!self&&!u.service&&!u.deleted)more.push(['🏷 Метки…',()=>{close();adminBadgeDialog('user',u.id,u.name,u.badges);}]);
 if(more.length)acts.push(act('⋯','Ещё',e=>{e.stopPropagation();popMenu(e.currentTarget,more,false);}));
 const sn=u.status_nft;
 const head=h('div',{class:'pfh',style:'background:'+(u.deleted?'#1a1a1c':(sn?'radial-gradient(circle at 50% 30%,'+sn.c1+','+sn.c2+')':bannerStyle(b)))},
  u.deleted?null:patternEl(sn?sn.symbol:(b?b.pattern:'')),h('div',{class:'pbar2'},back,right),
  av(u,112),h('h1',{},ownerEl(u),u.name,badge(u,true)),
  h('div',{class:'st'},
   u.deleted||u.is_bot?null:ratingBadge(u.rating,{onclick:()=>showRating(u.id)}),
   self?'в сети':status(u)),
  (!u.deleted&&u.status_text)?h('div',{class:'pmusic'},'♫ '+u.status_text):null,
  h('div',{class:'pacts'},acts));
 const rows=[];
 const row=(l,v,cls)=>h('div',{class:'prow2'},h('div',{class:'l'},l),h('div',{class:'v'+(cls?' '+cls:'')},v));
 if(!u.deleted){
  const ob=(u.badges||[]).find(x=>x.key==='owner');
  if(ob)rows.push(h('div',{class:'prow2'},h('div',{class:'l'},'верификация'),h('div',{class:'v',style:'display:flex;align-items:center'},ownerEl(u),ob.descr)));
  if(names.length){const mains=names.filter(x=>x.main),rest=names.filter(x=>!x.main);
   const lst=a=>a.map((x,i)=>[nftNameEl(x,u),i<a.length-1?', ':null]);
   rows.push(h('div',{class:'prow2'},h('div',{class:'l'},'имя пользователя'),
    h('div',{class:'v acc',style:'font-size:24px;font-weight:600;line-height:1.3'},lst(mains)),
    rest.length?h('div',{class:'also acc',style:'font-size:17px;margin-top:4px'},lst(rest)):null));}
  if(!u.is_bot&&u.phone)rows.push(row('телефон',fmtPhone(u.phone),u.nft_number?'nft':''));
  if(self&&u.nft_number&&u.real_phone)rows.push(row('реальный номер (виден только тебе)',fmtPhone(u.real_phone)));
  if(u.birthday)rows.push(row('день рождения',fmtBirth(u.birthday)));
  if(u.work_from&&u.work_to){const o=isOpenNow(u.work_from,u.work_to);
   rows.push(h('div',{class:'prow2'},h('div',{class:'l'},'часы работы'),h('div',{style:'display:flex;justify-content:space-between;margin-top:3px'},
    h('span',{class:o?'open':'closed',style:'font-size:19px'},o?'Открыто':'Закрыто'),h('span',{class:'sub',style:'font-size:17px'},u.work_from+' - '+u.work_to))));}
  if(u.address)rows.push(row('адрес',u.address));
  if(u.is_bot&&u.bot_desc)rows.push(row('о боте',u.bot_desc));
  if(u.bio)rows.push(h('div',{class:'prow2'},h('div',{class:'l'},'о себе'),h('div',{class:'v',style:'white-space:pre-wrap;font-size:17px'},u.bio)));}
 const body=h('div',{class:'pbody'},warnEl(u),
  (u.pchannel)?[h('div',{class:'pcap'},'канал'),h('div',{class:'pch',onclick:()=>{showChannel(u.pchannel.id);}},av({avatar_url:u.pchannel.avatar_url,name:u.pchannel.title},48),
    h('div',{class:'mid'},h('div',{class:'nm'},u.pchannel.title,badge(u.pchannel)),h('div',{class:'sub'},u.pchannel.members+' подписчиков')))]:null,
  rows.length?h('div',{class:'pcard'},rows):null,
  (!u.deleted&&u.nft_gifts&&u.nft_gifts.length)?[h('div',{class:'pcap'},'NFT-подарки · '+u.nft_gifts.length),h('div',{class:'nftgrid'},u.nft_gifts.map(g=>nftCard(g,70,{ctx:{market:g.listed,after:()=>{close();showProfile(uid);}}})))]:null,
  (!u.deleted&&u.gifts&&u.gifts.length)?[h('div',{class:'pcap'},'Подарки · '+u.gifts.length),h('div',{class:'ggrid'},u.gifts.map(g=>h('div',{class:'gitem',style:'background:#1c1c1e;border-color:#2c2c2e',onclick:()=>giftPreview(g)},gift3d(g,68),h('div',{class:'gt'},g.name),h('div',{class:'gs'},g.number?'№'+g.number:''))))]:null,
  (self&&((u.gifts&&u.gifts.length)||(u.nft_gifts&&u.nft_gifts.length)))?h('button',{class:'btn red',style:'margin-top:16px',onclick:async()=>{
    if(!confirm('Удалить ВСЕ подарки с профиля ('+((u.gifts||[]).length+(u.nft_gifts||[]).length)+' шт.)? Это необратимо.'))return;
    try{const j=await api('/api/gifts/clear',{kind:'all'});toast('Удалено подарков: '+j.removed);close();await refreshMe();showProfile(uid);}catch(e){toast(e.message);}}},'🗑 Удалить все подарки'):null,
  self?h('button',{class:'btn gray',style:'margin-top:16px',onclick:()=>{close();myNft();}},'💎 Мои NFT-имена и номера'):null,
  self?h('button',{class:'btn gray',onclick:showPremium},'⭐ GodGram Premium'):null);
 ov.append(head,body);document.body.append(ov);}

async function deleteUser(u,close){
 if(!confirm('Удалить аккаунт «'+u.name+'»?\nОн станет «Удалённым аккаунтом» для всех. Это необратимо.'))return;
 try{await api('/api/admin/delete',{user_id:u.id});toast('Аккаунт удалён');close&&close();await refresh();}
 catch(e){toast(e.message);}}

async function isAnimated(file){
 if(file.type==='image/gif')return true;
 try{const b=new Uint8Array(await file.slice(0,65536).arrayBuffer());const t=new TextDecoder('latin1').decode(b);
  if(file.type==='image/webp')return t.includes('ANIM');
  if(file.type==='image/png')return t.includes('acTL');}catch(e){}
 return false;}
function fileToAvatar(file,size=320){return new Promise(async(res,rej)=>{
 try{
  if(!file){rej(new Error('Файл не выбран'));return;}
  const t=(file.type||'').toLowerCase();
  if(/heic|heif/.test(t)||/\.heic$/i.test(file.name||'')){rej(new Error('HEIC не поддерживается — экспортни в JPG'));return;}
  if(file.size>12_000_000){rej(new Error('Файл слишком большой (макс. 12 МБ)'));return;}
  if(await isAnimated(file)){
   if(file.size>2_500_000){rej(new Error('Анимация слишком большая'));return;}
   const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Не удалось прочитать файл'));r.readAsDataURL(file);return;
  }
  async function fromBitmap(bmp){
   const c=document.createElement('canvas');c.width=c.height=size;
   const s=Math.min(bmp.width,bmp.height)||size;
   const ctx=c.getContext('2d',{alpha:false});
   ctx.fillStyle='#1a1a1c';ctx.fillRect(0,0,size,size);
   ctx.drawImage(bmp,(bmp.width-s)/2,(bmp.height-s)/2,s,s,0,0,size,size);
   if(bmp.close)try{bmp.close();}catch(e){}
   // сжимаем пока не влезет (~1.2 МБ data URL)
   let q=0.9,out;
   for(let i=0;i<8;i++){
    out=c.toDataURL('image/jpeg',q);
    if(out.length<1_200_000)break;
    q-=0.1;
   }
   return out;
  }
  // createImageBitmap
  if(typeof createImageBitmap==='function'){
   try{return res(await fromBitmap(await createImageBitmap(file)));}catch(e){}
  }
  // FileReader -> Image (самый надёжный на телефонах)
  const data=await new Promise((r,j)=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>j(new Error('Не удалось прочитать файл'));fr.readAsDataURL(file);});
  const img=await new Promise((r,j)=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>j(new Error('Формат не поддерживается — JPG/PNG/WebP'));im.src=data;});
  const c=document.createElement('canvas');c.width=c.height=size;
  const s=Math.min(img.width,img.height)||size;
  const ctx=c.getContext('2d',{alpha:false});
  ctx.fillStyle='#1a1a1c';ctx.fillRect(0,0,size,size);
  ctx.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);
  let q=0.9,out;
  for(let i=0;i<8;i++){out=c.toDataURL('image/jpeg',q);if(out.length<1_200_000)break;q-=0.1;}
  res(out);
 }catch(e){rej(new Error((e&&e.message)||'Не удалось прочитать фото'));}
});}

function fileToStatusMedia(file){return new Promise((res,rej)=>{
 if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){rej(new Error('Нужна картинка или GIF'));return;}
 if(file.size>2_000_000){rej(new Error('Файл слишком большой (макс. 2 МБ)'));return;}
 if(file.type==='image/gif'){
  const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Не удалось прочитать файл'));r.readAsDataURL(file);return;}
 const img=new Image(),url=URL.createObjectURL(file);
 img.onload=()=>{const size=64,c=document.createElement('canvas');c.width=c.height=size;const s=Math.min(img.width,img.height);
  c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);URL.revokeObjectURL(url);res(c.toDataURL('image/png'));};
 img.onerror=()=>rej(new Error('Не удалось прочитать картинку'));img.src=url;});}

/* Свой узор для баннера — квадратная миниатюра (как стикер), повторяется по баннеру */
function fileToBannerMedia(file){return new Promise((res,rej)=>{
 if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){rej(new Error('Нужна картинка или GIF'));return;}
 if(file.size>2_000_000){rej(new Error('Файл слишком большой (макс. 2 МБ)'));return;}
 if(file.type==='image/gif'){
  if(file.size>700_000){rej(new Error('GIF для узора макс. ~500 КБ'));return;}
  const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Не удалось прочитать файл'));r.readAsDataURL(file);return;}
 const img=new Image(),url=URL.createObjectURL(file);
 img.onload=()=>{
  const size=96; // компактный тайл узора
  const c=document.createElement('canvas');c.width=c.height=size;
  const s=Math.min(img.width,img.height);
  c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,size,size);
  URL.revokeObjectURL(url);
  res(c.toDataURL('image/png'));
 };
 img.onerror=()=>rej(new Error('Не удалось прочитать картинку'));img.src=url;});}

function avatarPicker(init,onChange){
 const holder=h('div',{style:'display:flex;justify-content:center;margin:6px 0 10px;cursor:pointer'});
 const file=h('input',{type:'file',accept:'image/*',class:'hide'});
 const paint=o=>setKids(holder,av(o,96));paint(init);
 holder.onclick=()=>file.click();
 file.onchange=async()=>{if(!file.files[0])return;try{const d=await fileToAvatar(file.files[0]);onChange(d);paint({avatar_url:d,name:init.name||init.title});}catch(e){toast(e.message);}};
 return h('div',{},holder,file,h('div',{class:'sub',style:'text-align:center;margin-bottom:8px'},'Нажми на круг, чтобы выбрать фото или GIF-анимацию'));}

/* ---------- редактирование профиля + оформление (Premium) ---------- */
function showEdit(closeProfile){
 const ov=h('div',{class:'overlay dim'});let newAv;
 const st={color:me.banner?me.banner.color:-1,pattern:me.banner?me.banner.pattern:'',emoji:me.emoji_status||''};
 const first=h('input',{class:'inp',value:me.first_name||'',placeholder:'Имя',maxlength:40});
 const last=h('input',{class:'inp',value:me.last_name||'',placeholder:'Фамилия',maxlength:40});
 const bio=h('textarea',{class:'inp',rows:3,placeholder:'О себе',maxlength:200},me.bio||'');
 const un=h('input',{class:'inp',value:me.own_username||'',placeholder:'Имя пользователя (без @)',maxlength:32,autocapitalize:'none'});
 const hint=h('div',{class:'sub'},'a-z, 0-9 и _, минимум 5 символов');
 const bd=h('input',{class:'inp',type:'date',value:me.birthday||''}),ad=h('input',{class:'inp',placeholder:'Адрес',maxlength:120,value:me.address||''}),
  stx=h('input',{class:'inp',placeholder:'Статус под именем (например: трек или цитата)',maxlength:120,value:me.status_text||''}),
  wf=h('input',{class:'inp',type:'time',value:me.work_from||'',style:'flex:1;margin:0'}),wt=h('input',{class:'inp',type:'time',value:me.work_to||'',style:'flex:1;margin:0'}),
  pch=h('select',{class:'inp'},h('option',{value:0},'— не показывать канал —'));
 api('/api/channels').then(j=>{j.channels.filter(c=>c.owner===me.id).forEach(c=>pch.append(h('option',{value:c.id},c.title)));pch.value=String(me.pchannel?me.pchannel.id:0);}).catch(()=>{});
 let t;un.oninput=()=>{clearTimeout(t);const v=un.value.trim().replace(/^@/,'').toLowerCase();
  if(!v){hint.textContent='Имя пользователя не задано';hint.style.color='';return;}
  t=setTimeout(async()=>{try{const j=await api('/api/username/check',{username:v});
   hint.textContent=j.ok?'✓ @'+v+' свободно':j.error;hint.style.color=j.ok?'#4fd27a':'#ff7b72';}catch(e){}},300);};
 // превью обложки
 const prev=h('div',{class:'bprev'});
 const paintPrev=()=>{
  prev.style.background=bannerBg(st.color);
  setKids(prev,patternEl(st.pattern),h('div',{class:'bn'},(first.value||me.first_name)+' ',st.emoji?statusEl(st.emoji,18):null));};
 first.oninput=paintPrev;
 const needPrem=()=>{if(!me.premium){showPremium();return true;}return false;};
 const sws=h('div',{class:'sws'});
 const paintSws=()=>setKids(sws,[-1,...BANNERS.map((_,i)=>i)].map(i=>{
  const e=h('div',{class:'swc'+(st.color===i?' on':'')+(me.premium?'':' lk'),style:'background:'+bannerBg(i),onclick:()=>{if(needPrem())return;st.color=i;paintSws();paintPrev();}},i<0?'✕':'');return e;}));
 const chips=(list,get,set)=>{const box=h('div',{class:'chips'});
  const paint=()=>setKids(box,list.map(p=>h('button',{class:'chip'+(get()===p?' on':''),onclick:()=>{if(needPrem())return;set(p);paint();paintPrev();}},patternChipLabel(p))));
  paint();return box;};
 const err=h('div',{class:'err'});
 const done=async()=>{await refreshMe();ov.remove();closeProfile&&closeProfile();await refresh();};
 const m=h('div',{class:'modal'},h('h3',{},'Мой профиль'),
  avatarPicker(me,d=>newAv=d),first,last,bio,un,hint,stx,h('div',{class:'lbl'},'День рождения'),bd,h('div',{class:'lbl'},'Часы работы (от и до)'),h('div',{style:'display:flex;gap:8px'},wf,wt),ad,h('div',{class:'lbl'},'Канал в профиле'),pch,
  h('div',{class:'sub',style:'margin-top:8px'},'Номер: '+fmtPhone(me.real_phone||me.phone)+' · виден только тебе и админу'),
  h('div',{class:'psec',style:'font-size:16px;margin:18px 0 8px'},'⭐ Оформление профиля'+(me.premium?'':' · нужен Premium')),
  prev,h('div',{class:'lbl'},'Цвет обложки'),sws,
  h('div',{class:'lbl'},'Узор: эмодзи или своя картинка'),chips(PATTERNS,()=>isBannerImg(st.pattern)?'':st.pattern,v=>{st.pattern=v;paintPrev();}),
  (()=>{const bf=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp,image/gif',class:'hide'});
   bf.onchange=async()=>{if(!bf.files[0])return;try{if(needPrem())return;const d=await fileToBannerMedia(bf.files[0]);st.pattern=d;paintPrev();toast('Узор установлен');}catch(e){toast(e.message);}};
   return h('div',{style:'margin:4px 0 10px;display:flex;gap:8px;flex-wrap:wrap'},
    h('button',{class:'chip',style:'width:auto;padding:0 12px;font-size:13px',onclick:()=>{if(needPrem())return;bf.click();}},'🖼 Свой узор (фото/GIF)'),
    isBannerImg(st.pattern)?h('button',{class:'chip',style:'width:auto;padding:0 12px;font-size:13px',onclick:()=>{st.pattern='';paintPrev();}},'✕ Убрать узор'):null,
    bf);})(),
  h('div',{class:'lbl'},'Эмодзи-статус рядом с именем'),chips(STATUSES,()=>st.emoji,v=>st.emoji=v),
  (()=>{const sf=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp,image/gif',class:'hide'});
   sf.onchange=async()=>{if(!sf.files[0])return;try{if(needPrem())return;const d=await fileToStatusMedia(sf.files[0]);st.emoji=d;paintPrev();}catch(e){toast(e.message);}};
   return h('div',{style:'margin:4px 0 10px'},h('button',{class:'chip',style:'width:auto;padding:0 12px;font-size:13px',onclick:()=>{if(needPrem())return;sf.click();}},'🖼 Своя картинка/GIF в статус'),sf);})(),
  err,
  h('button',{class:'btn',onclick:async()=>{try{
    const body={first_name:first.value,last_name:last.value,bio:bio.value,username:un.value,birthday:bd.value,address:ad.value,status_text:stx.value,work_from:wf.value,work_to:wt.value,pchannel:+pch.value};if(newAv!==undefined)body.avatar=newAv;
    await api('/api/profile',body);
    if(me.premium)await api('/api/profile/style',{banner_color:st.color,banner_pattern:st.pattern,emoji_status:st.emoji});
    await done();toast('Профиль сохранён');
   }catch(e){err.textContent=e.message;}}},'Сохранить'),
  me.avatar_url?h('button',{class:'btn gray',onclick:async()=>{try{await api('/api/profile',{first_name:me.first_name,last_name:me.last_name,bio:me.bio,avatar:''});await done();}catch(e){err.textContent=e.message;}}},'Убрать аватарку'):null,
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена'));
 paintSws();paintPrev();
 ov.append(m);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

/* ---------- Telegram Premium ---------- */
const FEATS=[
 ['🚀','linear-gradient(135deg,#ff9a5c,#ff4d6d)','Удвоенные лимиты','До 1000 каналов, 20 папок с чатами, 10 закреплённых чатов и многое другое.',0],
 ['📁','linear-gradient(135deg,#6ab7ff,#3b82e6)','Файлы до 4 ГБ','Загружайте файлы размером до 4 ГБ каждый.',0],
 ['⚡','linear-gradient(135deg,#ff6b6b,#ff9a5c)','Максимальная скорость','Скачивайте медиа и файлы без ограничения скорости.',0],
 ['🎙','linear-gradient(135deg,#6fd67a,#2ba2b5)','Голос в текст','Читайте расшифровку голосовых и видеосообщений.',0],
 ['🚫','linear-gradient(135deg,#b98cff,#6c5ce7)','Без рекламы','Больше никаких рекламных сообщений в каналах.',0],
 ['😍','linear-gradient(135deg,#ffd86b,#ff8a3d)','Эксклюзивные реакции','Тысячи дополнительных реакций на сообщения.',0],
 ['🎭','linear-gradient(135deg,#6ab7ff,#7254e0)','Премиум-стикеры','Эксклюзивные анимированные стикеры с эффектами.',0],
 ['⭐','linear-gradient(135deg,#6c8cff,#c65bff)','Значок Premium','Звезда рядом с именем в списке чатов, сообщениях и профиле.',1],
 ['🎨','linear-gradient(135deg,#ff72a0,#7a5cff)','Обложка профиля','Свой цвет и узор из эмодзи на странице профиля.',1],
 ['😎','linear-gradient(135deg,#46f08a,#0f9a85)','Эмодзи-статус','Свой эмодзи рядом с именем вместо звезды.',1]];
function showPremium(){
 const ov=h('div',{class:'overlay prem'});
 const list=FEATS.map(([ic,bg,t,d,ok])=>h('div',{class:'fr'},h('div',{class:'fi',style:'background:'+bg},ic),
  h('div',{style:'flex:1;min-width:0'},h('b',{},t,h('span',{class:'ftag'+(ok?' ok':'')},ok?'работает':'скоро')),h('div',{class:'sub'},d))));
 ov.append(h('div',{class:'pw'},
  h('div',{class:'pbar',style:'background:transparent'},h('button',{class:'icon',style:'color:#fff;font-size:26px',onclick:()=>ov.remove()},'←')),
  h('div',{class:'pstar',html:BIGSTAR}),h('h1',{class:'c'},'GodGram Premium'),h('p',{class:'sub c'},'Откройте дополнительные возможности'),
  list,
  h('div',{class:'pcta'},me.premium
   ?h('div',{class:'cta on c'},'⭐ Premium активен · '+(me.premium_until>3e10?'навсегда':'до '+premDate(me.premium_until)))
   :h('button',{class:'cta',onclick:()=>toast('Premium выдаёт администратор сервера')},'Получить Premium'))));
 document.body.append(ov);}

/* ---------- перетаскивание (мышь и палец) ---------- */
function sortable(box,onDone){
 box.addEventListener('pointerdown',e=>{
  const hd=e.target.closest('.hnd');if(!hd)return;
  const it=hd.closest('.sit');if(!it)return;
  e.preventDefault();
  try{hd.setPointerCapture(e.pointerId);}catch(_){}
  const before=[...box.children].map(x=>x.dataset.h).join('|');
  let base=e.clientY;it.classList.add('drag');
  const mv=ev=>{
   it.style.transform='translateY('+(ev.clientY-base)+'px)';
   for(let g=0;g<8;g++){
    const r=it.getBoundingClientRect(),cy=r.top+r.height/2;
    const nx=it.nextElementSibling,pv=it.previousElementSibling;let moved=false;
    if(nx){const nr=nx.getBoundingClientRect();
     if(cy>nr.top+nr.height/2){const o=it.offsetTop;box.insertBefore(it,nx.nextElementSibling);base+=it.offsetTop-o;moved=true;}}
    if(!moved&&pv){const pr=pv.getBoundingClientRect();
     if(cy<pr.top+pr.height/2){const o=it.offsetTop;box.insertBefore(it,pv);base+=it.offsetTop-o;moved=true;}}
    if(!moved)break;
    it.style.transform='translateY('+(ev.clientY-base)+'px)';}
  };
  const up=()=>{hd.removeEventListener('pointermove',mv);hd.removeEventListener('pointerup',up);hd.removeEventListener('pointercancel',up);
   it.classList.remove('drag');it.style.transform='';
   const after=[...box.children].map(x=>x.dataset.h);
   if(after.join('|')!==before)onDone(after);};
  hd.addEventListener('pointermove',mv);hd.addEventListener('pointerup',up);hd.addEventListener('pointercancel',up);});}

/* ---------- мои NFT и юзернеймы ---------- */
async function myNft(){
 const ov=h('div',{class:'overlay dim'});const box=h('div',{class:'modal'});
 async function load(){
  let j;try{j=await api('/api/my_nft');}catch(e){setKids(box,h('div',{class:'err'},e.message));return;}
  const act=h('div',{class:'slist'});
  j.active.forEach((x,i)=>act.append(h('div',{class:'sit','data-h':x.handle},
   h('span',{class:'hnd',title:'Перетащи'},'☰'),
   h('div',{class:'sit-main'},
    h('span',{class:x.nft?'nft':'',style:'word-break:break-all'},(x.nft?'💎 ':'')+'@'+x.handle),
    x.main?h('span',{class:'tag'},'основной'):null,
    h('div',{class:'sub'},x.nft?'NFT-юзернейм':'Обычный юзернейм'+(x.price?' · '+x.price+' ⭐':'')+(x.issued?' · выдан '+fmtDT(x.issued):''))),
   h('div',{class:'sit-acts'},
    h('button',{class:'sbtn sm'+(x.main?' g':''),onclick:async()=>{try{await api('/api/usernames/main',{handle:x.handle,main:!x.main});await refreshMe();await load();}catch(e){toast(e.message);}}},x.main?'Не основной':'В основные'),
    x.nft?toggle(true,async()=>{try{await api('/api/nft/activate',{kind:'username',value:x.handle,active:false});await refreshMe();await load();}catch(e){toast(e.message);}}):null)
   )));
  sortable(act,async order=>{try{await api('/api/usernames/order',{order});await refreshMe();await load();}catch(e){toast(e.message);await load();}});
  const off=j.inactive.map(hd=>h('div',{class:'sit','data-h':hd},
   h('div',{class:'sit-main'},h('span',{class:'nft',style:'word-break:break-all'},'💎 @'+hd),h('div',{class:'sub'},'отключён · никто его не видит')),
   h('div',{class:'sit-acts'},toggle(false,async()=>{try{await api('/api/nft/activate',{kind:'username',value:hd,active:true});await refreshMe();await load();}catch(e){toast(e.message);}}))));
  const nums=j.numbers.map(x=>h('div',{class:'sit'},
   h('div',{class:'sit-main'},h('span',{class:'nft'},'💎 '+fmtPhone(x.number)),h('div',{class:'sub'},x.active?'показывается в профиле':'не используется')),
   h('div',{class:'sit-acts'},h('button',{class:'sbtn sm'+(x.active?' g':''),onclick:async()=>{try{await api('/api/nft/activate',{kind:'number',value:x.active?null:x.number});await refreshMe();await load();}catch(e){toast(e.message);}}},x.active?'Снять':'Выбрать'))));
  setKids(box,h('h3',{},'💎 Мои NFT и юзернеймы'),
   h('div',{class:'sub',style:'margin-bottom:6px'},'NFT выдаёт админ. Включённые юзернеймы показываются в профиле рядом с основным. Основные юзернеймы показываются в профиле крупно, остальные — под ними. Тяни за ☰, чтобы поменять порядок.'),
   h('div',{class:'psec',style:'font-size:15px;margin:12px 0 2px'},'Имена пользователя'),
   j.active.length?act:h('div',{class:'sub'},'Пока нет. Задай @username в профиле.'),
   off.length?[h('div',{class:'psec',style:'font-size:15px;margin:14px 0 2px'},'Отключённые NFT'),off]:null,
   h('div',{class:'psec',style:'font-size:15px;margin:14px 0 2px'},'Номера'),
   nums.length?nums:h('div',{class:'sub'},'Пока нет'),
   h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть'));}
 ov.append(box);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);load();}

/* ---------- группы ---------- */
async function newGroup(){
 const ov=h('div',{class:'overlay dim'});let gAv='';const sel=new Set();
 const title=h('input',{class:'inp',placeholder:'Название группы',maxlength:50});
 const list=h('div',{style:'max-height:260px;overflow-y:auto;margin-top:8px'});
 const find=h('input',{class:'inp',placeholder:'Найти участников'});
 const err=h('div',{class:'err'});
 async function load(){const j=await api('/api/users?q='+encodeURIComponent(find.value));
  setKids(list,j.users.map(u=>{const ck=h('input',{type:'checkbox',class:'ck'});ck.checked=sel.has(u.id);
   ck.onchange=()=>ck.checked?sel.add(u.id):sel.delete(u.id);
   return h('label',{class:'ur'},av(u,40),h('div',{class:'mid'},u.name,badge(u),h('small',{},u.username?'@'+u.username:status(u))),ck);}));}
 find.oninput=load;
 const m=h('div',{class:'modal'},h('h3',{},'Новая группа'),avatarPicker({title:'Г'},d=>gAv=d),title,find,list,err,
  h('button',{class:'btn',onclick:async()=>{try{
    const j=await api('/api/chat/group',{title:title.value,avatar:gAv,members:[...sel]});
    ov.remove();await loadChats();openChat(j.chat_id);}catch(e){err.textContent=e.message;}}},'Создать'),
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Отмена'));
 ov.append(m);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);load();}

async function showGroup(id){
 const g=await api('/api/chat?id='+id);const ov=h('div',{class:'overlay dim'});
 const m=h('div',{class:'modal'},h('div',{style:'display:flex;justify-content:center;margin-bottom:8px'},av({avatar_url:g.avatar_url,title:g.title},96)),
  h('h3',{style:'text-align:center;margin-bottom:2px'},g.title),h('div',{class:'sub',style:'text-align:center;margin-bottom:12px'},g.members.length+(g.kind==='channel'?' подписч.':' участн.')),
  g.members.map(u=>h('div',{class:'ur',onclick:()=>{ov.remove();showProfile(u.id);}},av(u,40),
   h('div',{class:'mid'},u.name,badge(u),u.id===g.owner?h('span',{class:'tag'},'создатель'):null,h('small',{},u.deleted?'был(а) давно':status(u))))),
  g.frozen?h('div',{class:'sub',style:'text-align:center;margin:8px 0'},'❄️ Заморожено администратором'):null,
  g.owner===me.id?h('button',{class:'btn gray',onclick:async()=>{const u=prompt('Юзернейм бота (например my_bot):');if(!u)return;
   try{await api('/api/chat/add_bot',{chat_id:id,username:u});toast('Бот добавлен');ov.remove();showGroup(id);}catch(e){toast(e.message);}}},'🤖 Добавить бота'):null,
  (g.kind==='channel'&&g.owner!==me.id)?h('button',{class:'btn red',onclick:async()=>{try{await api('/api/channel/leave',{chat_id:id});ov.remove();$('#backBtn').click();await loadChats();}catch(e){toast(e.message);}}},'Отписаться'):null,
  h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть'));
 ov.append(m);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);}

