/* ---------- админ-панель ---------- */
const ulabel=u=>u.name+(u.username?' @'+u.username:'');
function userSelect(users,selected){
 const s=h('select',{class:'inp',style:'margin:0;flex:1;min-width:0'},
  h('option',{value:''},'— никому (в пул) —'),
  ...users.filter(u=>!u.deleted).map(u=>h('option',{value:u.id},ulabel(u))));
 if(selected)s.value=String(selected);return s;}

async function adminPanel(){
 const ov=h('div',{class:'overlay dim'});
 const box=h('div',{class:'modal',style:'max-width:560px'});
 const tabs=h('div',{class:'tabs2'});const body=h('div');
 let tab='users';
 const act=async(path,data,msg)=>{try{await api(path,data);if(msg)toast(msg);await render();refresh();}catch(e){toast(e.message);}};

 function usersTab(users){
  const alive=users.filter(u=>!u.deleted).length;
  return h('div',{},h('div',{class:'sub',style:'margin-bottom:10px'},'Пользователей: '+alive+' · удалённых: '+(users.length-alive)),
   users.map(u=>h('div',{class:'ur',onclick:()=>{ov.remove();showProfile(u.id);}},av(u,40),
    h('div',{class:'mid'},u.name,badge(u),u.is_admin?h('span',{class:'tag'},'админ'):null,u.deleted?h('span',{class:'tag d'},'удалён'):null,
     h('small',{},u.deleted?'ID '+u.id:[(u.real_phone?fmtPhone(u.real_phone):'—'),u.username?' · @'+u.username:''])),
    (!u.deleted&&!u.is_admin&&u.id!==me.id)?h('button',{class:'dbtn',onclick:e=>{e.stopPropagation();
      if(!confirm('Удалить аккаунт «'+u.name+'»? Необратимо.'))return;act('/api/admin/delete',{user_id:u.id},'Аккаунт удалён');}},'Удалить'):null)));}

 function nftTab(kind,items,users){
  const isU=kind==='username';
  const inp=h('input',{class:'inp',placeholder:isU?'юзернейм без @ (от 2 символов)':'777 или 888 0123 4567',autocapitalize:'none'});
  const owner=userSelect(users,null);
  const rnd=n=>{let d='';for(let i=0;i<n;i++)d+=Math.floor(Math.random()*10);return d;};
  const dice=!isU?[
   h('button',{class:'sbtn g',title:'Случайный полный номер',onclick:()=>{inp.value=fmtPhone('888'+rnd(8));}},'🎲 11'),
   h('button',{class:'sbtn g',title:'Случайный 3-значный номер',onclick:()=>{inp.value=rnd(3);}},'🎲 3')]:null;
  const toLocal=ts=>{const d=new Date(ts*1000);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};
  const toTs=v=>v?new Date(v).getTime()/1000:0;
  const price0=h('input',{class:'inp',type:'number',min:0,placeholder:'Цена ⭐ на GodFragment (0 = не в продаже)',style:'margin:0;flex:1'});
  const date0=isU?h('input',{class:'inp',type:'datetime-local',title:'Когда выдан (пусто - сейчас)',style:'margin:0;flex:1;min-width:170px'}):null;
  const form=h('div',{class:'frm'},h('b',{},isU?'Создать NFT-юзернейм':'Создать NFT-номер'),
   !isU?h('div',{class:'sub'},'Можно ввести просто 3 цифры (например 777) — получится +888 777. Цена > 0 — лот появится на GodFragment.'):null,
   h('div',{class:'nact'},inp,dice),h('div',{class:'nact'},price0,isU?date0:null),isU?h('div',{class:'sub'},'Цена в ⭐: на GodFragment (если без владельца) и в профиле. Дату можно не указывать.'):h('div',{class:'sub'},'Если указать цену и не выбирать владельца — номер попадёт в продажу на GodFragment.'),h('div',{class:'nact'},owner,
    h('button',{class:'sbtn',onclick:()=>act(isU?'/api/admin/nft/username':'/api/admin/nft/number',
      isU?{handle:inp.value,user_id:owner.value||null,price:+price0.value||0,issued:toTs(date0.value)||undefined}:{number:inp.value,user_id:owner.value||null,price:+price0.value||0},'Создано 💎').then(()=>{inp.value='';})},'Создать 💎')));
  const rows=items.map(x=>{
   const sel=userSelect(users,x.owner&&x.owner.id);
   const pr=isU?h('input',{class:'inp',type:'number',min:0,placeholder:'Цена ⭐',value:x.price||'',style:'margin:0;width:110px'}):null;
   const dt=isU?h('input',{class:'inp',type:'datetime-local',value:x.issued?toLocal(x.issued):'',style:'margin:0;flex:1;min-width:170px'}):null;
   return h('div',{class:'nrow'},
    h('div',{class:'nh'},h('span',{class:'nft'},isU?'💎 @'+x.handle:'💎 '+fmtPhone(x.number)),h('span',{class:'sub'},x.owner?('→ '+x.owner.name):'свободен')),
    isU?h('div',{class:'sub'},(x.price>0?x.price+' ⭐':'цена не указана')+' · '+(x.issued>0?'выдан '+fmtDT(x.issued):'не выдан')):null,
    isU?h('div',{class:'nact'},pr,dt,h('button',{class:'sbtn',title:'Сохранить цену и дату',onclick:()=>act('/api/admin/nft/info',{id:x.id,price:+pr.value||0,issued:toTs(dt.value)},'Сохранено')},'💾')):null,
    h('div',{class:'nact'},sel,
     h('button',{class:'sbtn',onclick:()=>act('/api/admin/nft/assign',{kind,id:x.id,user_id:sel.value||null},sel.value?'Выдано':'Забрано')},'Выдать'),
     x.owner?h('button',{class:'sbtn g',onclick:()=>act('/api/admin/nft/assign',{kind,id:x.id,user_id:null},'Забрано')},'Забрать'):null,
     h('button',{class:'sbtn r',onclick:()=>{if(confirm('Удалить насовсем?'))act('/api/admin/nft/delete',{kind,id:x.id},'Удалено');}},'✕')));});
  return h('div',{},form,rows.length?rows:h('div',{class:'sub'},'Пока ничего нет. Создай первый выше.'));}

 function premiumTab(users){
  return h('div',{},h('div',{class:'sub',style:'margin-bottom:8px'},'Premium даёт значок ⭐, обложку профиля и эмодзи-статус.'),
   users.filter(u=>!u.deleted).map(u=>{
    const sel=h('select',{class:'inp',style:'margin:0;width:auto'},...[[1,'1 мес.'],[3,'3 мес.'],[6,'6 мес.'],[12,'12 мес.'],[-1,'навсегда']].map(([v,t])=>h('option',{value:v},t)));
    return h('div',{class:'nrow'},
     h('div',{class:'nh'},h('span',{},u.name,badge(u)),h('span',{class:'sub'},u.premium?('до '+premDate(u.premium_until)):'нет Premium')),
     h('div',{class:'nact'},sel,
      h('button',{class:'sbtn',onclick:()=>act('/api/admin/premium',{user_id:u.id,months:+sel.value},'⭐ Premium выдан')},u.premium?'Продлить':'Выдать'),
      u.premium?h('button',{class:'sbtn g',onclick:()=>act('/api/admin/premium',{user_id:u.id,months:0},'Premium отозван')},'Забрать'):null,
      h('button',{class:'sbtn'+(u.boost_inf?' r':''),style:u.boost_inf?'':'background:linear-gradient(90deg,#6c8cff,#c65bff)',onclick:()=>act('/api/admin/boost_user',{user_id:u.id,inf:!u.boost_inf},u.boost_inf?'Бусты ∞ сняты':'⚡ Бесконечные бусты выданы')},u.boost_inf?'⚡∞ снять':'⚡∞ выдать')));}));}

 function botsTab(bots){
  return h('div',{},h('div',{class:'sub',style:'margin-bottom:8px'},'Бота можно заморозить (молчит, API закрыт) или удалить насовсем.'),
   bots.length?bots.map(b=>h('div',{class:'nrow'},
    h('div',{class:'nh'},h('span',{},b.name,h('span',{class:'bt'},'БОТ'),b.frozen?h('span',{class:'frz'},' ❄️'):null),h('span',{class:'sub'},'@'+b.username+(b.owner?' · '+b.owner.name:''))),
    h('div',{class:'nact'},h('button',{class:'sbtn'+(b.frozen?'':' r'),onclick:()=>act('/api/admin/freeze',{kind:'bot',id:b.id,on:!b.frozen},b.frozen?'Бот разморожен':'Бот заморожен ❄️')},b.frozen?'Разморозить':'Заморозить ❄️'),
     h('button',{class:'sbtn r',onclick:()=>{if(confirm('Удалить бота @'+b.username+' насовсем?'))act('/api/admin/delete',{user_id:b.id},'Бот удалён');}},'🗑 Удалить')))):
    h('div',{class:'sub'},'Ботов пока нет'));}

 function channelsTab(chs){
  return h('div',{},h('div',{class:'sub',style:'margin-bottom:8px'},'Каналы и группы можно заморозить или удалить насовсем (вместе с сообщениями).'),
   chs.length?chs.map(c=>h('div',{class:'nrow'},
    h('div',{class:'nh'},h('span',{},(c.kind==='channel'?'📢 ':'👥 ')+c.title,badge(c),c.frozen?h('span',{class:'frz'},' ❄️'):null),h('span',{class:'sub'},c.members+' · '+(c.owner?c.owner.name:'—')+(c.kind==='channel'?' · ⚡ '+(c.boosts>=1000000?'∞':c.boosts):''))),
    h('div',{class:'nact'},h('button',{class:'sbtn'+(c.frozen?'':' r'),onclick:()=>act('/api/admin/freeze',{kind:'chat',id:c.id,on:!c.frozen},c.frozen?'Разморожено':'Заморожено ❄️')},c.frozen?'Разморозить':'Заморозить ❄️'),
     c.kind==='channel'?h('button',{class:'sbtn',style:'background:linear-gradient(90deg,#6c8cff,#c65bff)',onclick:()=>act('/api/admin/boost_chat',{id:c.id,amount:-1},'⚡ Бесконечные бусты выданы')},'⚡ ∞'):null,
     c.kind==='channel'?h('button',{class:'sbtn g',onclick:()=>{const n=prompt('Сколько бустов добавить?','10');if(n)act('/api/admin/boost_chat',{id:c.id,amount:+n},'Бусты добавлены');}},'⚡ +N'):null,
     c.kind==='channel'?h('button',{class:'sbtn g',onclick:()=>act('/api/admin/boost_chat',{id:c.id,amount:0,set:true},'Админские бусты сброшены')},'⚡ 0'):null,
     h('button',{class:'sbtn r',onclick:()=>{if(confirm('Удалить «'+c.title+'» насовсем?'))act('/api/admin/chat/delete',{id:c.id},'Удалено');}},'🗑 Удалить')))):
    h('div',{class:'sub'},'Каналов пока нет'));}

 function walletTab(users){
  return h('div',{},h('div',{class:'sub',style:'margin-bottom:8px'},'Начисляй или списывай звёзды ⭐. Рейтинг — во вкладке «📊 Рейтинг».'),
   users.filter(u=>!u.deleted).map(u=>{
    const a=h('input',{class:'inp',type:'number',placeholder:'±сумма',style:'width:110px;margin:0'});
    return h('div',{class:'nrow'},h('div',{class:'nh'},h('span',{},u.name,badge(u)),h('span',{class:'sub'},fmtStars(u.balance))),
     h('div',{class:'nact'},a,h('button',{class:'sbtn',onclick:()=>{const v=+a.value;if(!v)return toast('Введи сумму');act('/api/admin/wallet',{user_id:u.id,amount:v},'Готово ⭐');}},'Применить')));}));}

 function ratingTab(users){
  return h('div',{},h('div',{class:'sub',style:'margin-bottom:10px'},'Выдай или забери рейтинг. «±» — изменить на число, «=» — выставить точное значение (можно отрицательное).'),
   users.filter(u=>!u.deleted&&!u.is_bot).map(u=>{
    const cur=u.rating||0;
    const dlt=h('input',{class:'inp',type:'number',placeholder:'± дельта',style:'width:100px;margin:0'});
    const abs=h('input',{class:'inp',type:'number',placeholder:'= значение',value:String(cur),style:'width:100px;margin:0'});
    const quick=(v)=>h('button',{class:'sbtn'+(v<0?' r':' g'),style:'padding:6px 8px',onclick:()=>act('/api/admin/rating',{user_id:u.id,amount:v},'Рейтинг '+(v>0?'+':'')+v)},(v>0?'+':'')+v);
    return h('div',{class:'nrow'},
     h('div',{class:'nh'},h('span',{},u.name,badge(u),ratingBadge(cur)),h('span',{class:'sub'},'сейчас: '+(cur>0?'+':'')+cur)),
     h('div',{class:'nact',style:'flex-wrap:wrap;gap:4px'},
      quick(10),quick(50),quick(100),quick(-10),quick(-50),
      dlt,h('button',{class:'sbtn',onclick:()=>{const v=+dlt.value;if(!v)return toast('Введи дельту');act('/api/admin/rating',{user_id:u.id,amount:v},'Рейтинг обновлён');}},'± Выдать'),
      abs,h('button',{class:'sbtn g',onclick:()=>{if(abs.value===''||isNaN(+abs.value))return toast('Введи значение');act('/api/admin/rating',{user_id:u.id,amount:+abs.value,set:true},'Рейтинг установлен');}},'= Поставить')));}));}

 function giftsTab(gifts,users){
  const name=h('input',{class:'inp',placeholder:'Название',maxlength:30}),price=h('input',{class:'inp',type:'number',placeholder:'Цена ⭐',value:100}),
   supply=h('input',{class:'inp',type:'number',placeholder:'Тираж (0 = без лимита)',value:0}),
   glyph=h('input',{class:'inp',placeholder:'Эмодзи',value:'🎁',maxlength:8,style:'width:90px'}),
   color=h('input',{type:'color',value:'#ff7a45',style:'width:46px;height:42px;border:0;background:none'}),
   model=h('select',{class:'inp'},h('option',{value:'extrude'},'Объёмный эмодзи'),h('option',{value:'box'},'Коробка (куб)')),
   anim=h('select',{class:'inp'},h('option',{value:'spin'},'Вращение'),h('option',{value:'float'},'Парение'),h('option',{value:'bounce'},'Прыжки'),h('option',{value:'pulse'},'Пульс')),
   prev=h('div',{style:'padding:8px 0'});
  const cur=()=>({name:name.value,glyph:glyph.value||'🎁',color:color.value,model:model.value,anim:anim.value});
  const paint=()=>setKids(prev,gift3d(cur(),110,true));
  [glyph,color,model,anim].forEach(e=>{e.oninput=paint;e.onchange=paint;});paint();
  const form=h('div',{class:'frm'},h('b',{},'Новый подарок'),prev,name,
   h('div',{class:'nact'},glyph,color,model),h('div',{class:'nact'},anim),h('div',{class:'nact'},price,supply),
   h('button',{class:'sbtn',onclick:()=>act('/api/admin/gift/create',{...cur(),price:+price.value,supply:+supply.value||0},'Подарок создан 🎁').then(()=>{name.value='';})},'Создать подарок'));
  const rows=gifts.map(g=>{
   const sel=userSelect(users,null);
   return h('div',{class:'nrow',style:g.active?'':'opacity:.55'},
    h('div',{class:'nh'},h('div',{style:'display:flex;align-items:center;gap:8px'},gift3d(g,46),h('span',{},g.name)),
     h('span',{class:'sub'},fmtStars(g.price)+' · продано '+g.sold+(g.supply?'/'+g.supply:''))),
    h('div',{class:'nact'},sel,h('button',{class:'sbtn',onclick:()=>{if(!sel.value)return toast('Выбери человека');act('/api/admin/gift/give',{gift_id:g.id,user_id:+sel.value},'Подарок выдан 🎁');}},'Выдать'),
     h('button',{class:'sbtn g',onclick:()=>act('/api/admin/gift/active',{id:g.id,active:!g.active},g.active?'Скрыт из магазина':'Показан')},g.active?'Скрыть':'Показать')));});
  return h('div',{},form,rows);}


 function badgesTab(users,bots,chs){
  return h('div',{},h('div',{class:'sub',style:'margin-bottom:8px'},'Верификации и метки СКАМ/ФЕЙК можно вешать на людей, ботов и каналы.'),
   [['Люди',users.filter(u=>!u.deleted).map(u=>['user',u])],['Боты',bots.map(u=>['user',u])],['Каналы и группы',chs.map(c=>['chat',c])]].map(([t,list])=>[
    h('div',{class:'psec',style:'font-size:15px;margin:14px 0 4px'},t),
    list.length?list.map(([k,e])=>h('div',{class:'nrow'},h('div',{class:'nh'},h('span',{},(k==='chat'?(e.kind==='channel'?'📢 ':'👥 ')+e.title:e.name),badge(e)),
      h('button',{class:'sbtn g',onclick:()=>adminBadgeDialog(k,e.id,k==='chat'?e.title:e.name,e.badges)},'🏷 Метки')))):h('div',{class:'sub'},'—')]));}

 const REASON={spam:'Спам',scam:'Мошенничество',fake:'Фейк / выдаёт себя за другого',violence:'Насилие',porn:'Порнография',copyright:'Авторские права',other:'Другое'};
 function reportsTab(reps){
  if(!reps.length)return h('div',{class:'sub',style:'padding:14px'},'Новых жалоб нет 🎉');
  return h('div',{},reps.map(r=>{
   const t=r.target;const nm=t?(r.kind==='message'?'Сообщение от '+t.name+': «'+(t.text||'')+'»':t.name+(t.username?' @'+t.username:'')):'(уже удалено)';
   const bk=r.kind==='user'?'user':'chat';
   return h('div',{class:'nrow'},
    h('div',{class:'nh'},h('span',{},({user:'👤 ',chat:'📢 ',message:'💬 '})[r.kind]+nm,t&&t.badges?badge(t):null),h('span',{class:'sub'},r.count>1?r.count+' жалоб':'1 жалоба')),
    h('div',{class:'sub'},REASON[r.reason]+(r.text?' — '+r.text:'')+' · от '+(r.reporter?r.reporter.name:'?')),
    h('div',{class:'nact',style:'flex-wrap:wrap;margin-top:6px'},
     (t&&r.kind!=='message')?[
      h('button',{class:'sbtn r',onclick:()=>act('/api/admin/badge',{kind:bk,id:r.tid,key:'scam',on:true},'Метка СКАМ')},'СКАМ'),
      h('button',{class:'sbtn',style:'background:#f08a24',onclick:()=>act('/api/admin/badge',{kind:bk,id:r.tid,key:'fake',on:true},'Метка ФЕЙК')},'ФЕЙК'),
      h('button',{class:'sbtn r',onclick:()=>{if(!confirm('Удалить цель жалобы?'))return;act(bk==='user'?'/api/admin/delete':'/api/admin/chat/delete',bk==='user'?{user_id:r.tid}:{id:r.tid},'Удалено');}},'🗑')]:null,
     h('button',{class:'sbtn',onclick:()=>act('/api/admin/report/resolve',{id:r.id,all:true,status:'resolved'},'Закрыто')},'✓ Решено'),
     h('button',{class:'sbtn g',onclick:()=>act('/api/admin/report/resolve',{id:r.id,all:true,status:'dismissed'},'Отклонено')},'Отклонить')));}));}

 function marketTab(colls,users){
  const name=h('input',{class:'inp',placeholder:'Название коллекции',maxlength:40}),glyphs=h('input',{class:'inp',placeholder:'Эмодзи-модели через пробел: 🐙 🦑 🐡'}),
   supply=h('input',{class:'inp',type:'number',placeholder:'Тираж (0 = без лимита)',value:1000}),price=h('input',{class:'inp',type:'number',placeholder:'Цена ⭐',value:100}),
   rel=h('input',{class:'inp',type:'number',placeholder:'Сразу выпустить на маркет, шт.',value:10});
  const form=h('div',{class:'frm'},h('b',{},'Новая NFT-коллекция'),h('div',{class:'sub'},'Модель, фон и узор у каждого подарка выпадают случайно, у каждого своя редкость.'),name,glyphs,h('div',{class:'nact'},supply,price),rel,
   h('button',{class:'sbtn',onclick:()=>act('/api/admin/nft_coll/create',{name:name.value,glyphs:glyphs.value,supply:+supply.value||0,price:+price.value||0,release:+rel.value||0},'Коллекция создана 💎').then(()=>{name.value='';})},'Создать'));
  const rows=colls.map(c=>{
   const cnt=h('input',{class:'inp',type:'number',value:5,style:'width:70px;margin:0'}),pr=h('input',{class:'inp',type:'number',value:c.price,style:'width:90px;margin:0'}),to=userSelect(users,null);
   to.firstChild.textContent='— на маркет —';
   return h('div',{class:'nrow',style:c.active?'':'opacity:.55'},
    h('div',{class:'nh'},h('span',{},c.glyph+' '+c.name),h('span',{class:'sub'},'выпущено '+c.minted+(c.supply?'/'+c.supply:'')+' · на маркете '+c.listed+(c.floor?' · от '+c.floor+'⭐':''))),
    h('div',{class:'nact',style:'flex-wrap:wrap'},cnt,pr,to,h('button',{class:'sbtn',onclick:()=>act('/api/admin/nft_coll/release',{id:c.id,count:+cnt.value,price:+pr.value,user_id:to.value||null},'Выпущено 💎')},'Выпустить'),
     h('button',{class:'sbtn g',onclick:()=>act('/api/admin/nft_coll/active',{id:c.id,active:!c.active},c.active?'Скрыта':'Показана')},c.active?'Скрыть':'Показать')));});
  return h('div',{},form,rows);}

 function paintTabs(){
  setKids(tabs,[['users','👥 Люди'],['nu','💎 Юзы'],['nn','💎 Номера'],['pr','⭐ Premium'],['bots','🤖 Боты'],['ch','📢 Каналы'],['gf','🎁 Подарки'],['mk','🛍 Маркет'],['bd','🏷 Метки'],['rp','🚩 Жалобы'],['wl','👛 Кошельки'],['rt','📊 Рейтинг']].map(([k,t])=>
   h('button',{class:tab===k?'on':'',onclick:()=>{tab=k;render();}},t)));}

 async function render(){
  paintTabs();
  try{
   const users=(await api('/api/admin/users')).users;
   let view;
   if(tab==='users')view=usersTab(users);
   else if(tab==='pr')view=premiumTab(users);
   else if(tab==='bots')view=botsTab((await api('/api/admin/bots')).bots);
   else if(tab==='ch')view=channelsTab((await api('/api/admin/channels')).channels);
   else if(tab==='gf')view=giftsTab((await api('/api/admin/gifts')).gifts,users);
   else if(tab==='wl')view=walletTab(users);
   else if(tab==='rt')view=ratingTab(users);
   else if(tab==='mk')view=marketTab((await api('/api/admin/nft_colls')).colls,users);
   else if(tab==='bd')view=badgesTab(users,(await api('/api/admin/bots')).bots,(await api('/api/admin/channels')).channels);
   else if(tab==='rp')view=reportsTab((await api('/api/admin/reports')).reports);
   else{const n=await api('/api/admin/nft');view=tab==='nu'?nftTab('username',n.usernames,users):nftTab('number',n.numbers,users);}
   setKids(body,view);
  }catch(e){setKids(body,h('div',{class:'err'},'Ошибка загрузки: '+e.message));}}

 box.append(h('h3',{},'🛡 Админ-панель'),tabs,body,h('button',{class:'btn gray',onclick:()=>ov.remove()},'Закрыть'));
 ov.append(box);ov.onclick=e=>{if(e.target===ov)ov.remove();};document.body.append(ov);
 render();}

