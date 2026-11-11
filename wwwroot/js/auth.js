/* ---------- слайды-приветствие ---------- */
const SLIDES=[
 {ic:'logo',bg:'linear-gradient(135deg,#8b5cf6,#2aabee)',t:'GodGram',d:'Самый <b>быстрый</b> мессенджер в мире.<br>Он <b>бесплатный</b> и <b>безопасный</b>.'},
 {ic:'🚀',bg:'linear-gradient(135deg,#ff9a5c,#ff4d6d)',t:'Быстрый',d:'<b>GodGram</b> доставляет сообщения <b>быстрее</b>, чем любое другое приложение.'},
 {ic:'🎁',bg:'linear-gradient(135deg,#6fd67a,#2ba2b5)',t:'Бесплатный',d:'<b>GodGram</b> бесплатен навсегда. Никакой рекламы. Никакой платы за подписку.'},
 {ic:'💪',bg:'linear-gradient(135deg,#ffd86b,#ff8a3d)',t:'Мощный',d:'<b>GodGram</b> не накладывает ограничений на размер ваших чатов и медиафайлов.'},
 {ic:'🔒',bg:'linear-gradient(135deg,#b98cff,#6c5ce7)',t:'Безопасный',d:'<b>GodGram</b> надёжно защищает ваши сообщения от атак хакеров.'},
 {ic:'☁️',bg:'linear-gradient(135deg,#6ab7ff,#3b82e6)',t:'В облаке',d:'<b>GodGram</b> даёт доступ к вашим сообщениям с нескольких устройств.'}];
let introIdx=0,introGo=null;
function initIntro(){
 const tr=h('div',{class:'track'});
 SLIDES.forEach(s=>tr.append(h('div',{class:'slide'},
  h('div',{class:'iic',style:'background:'+s.bg,html:s.ic==='logo'?LOGO:s.ic}),h('h1',{},s.t),h('p',{html:s.d}))));
 $('#islides').append(tr);
 const dots=SLIDES.map((_,i)=>h('i',{onclick:()=>introGo(i)}));
 setKids($('#idots'),dots);
 introGo=n=>{introIdx=Math.max(0,Math.min(SLIDES.length-1,n));
  tr.style.transform='translateX('+(-introIdx*100)+'%)';dots.forEach((d,i)=>d.classList.toggle('on',i===introIdx));};
 introGo(0);
 let sx=null;
 $('#islides').addEventListener('pointerdown',e=>{sx=e.clientX;});
 const end=e=>{if(sx==null)return;const dx=e.clientX-sx;sx=null;if(Math.abs(dx)>40)introGo(introIdx+(dx<0?1:-1));};
 window.addEventListener('pointerup',end);window.addEventListener('pointercancel',()=>{sx=null;});
 window.addEventListener('keydown',e=>{if($('#intro').classList.contains('hide'))return;
  if(e.key==='ArrowRight')introGo(introIdx+1);if(e.key==='ArrowLeft')introGo(introIdx-1);});
 $('#iGo').onclick=()=>{$('#intro').classList.add('hide');$('#auth').classList.remove('hide');showStep(1);};}
function showIntro(){introGo&&introGo(0);$('#auth').classList.add('hide');$('#intro').classList.remove('hide');}

/* ---------- страны и телефон ---------- */
const COUNTRIES=[["🇷🇺","Россия","7"],["🇰🇿","Казахстан","7"],["🇺🇦","Украина","380"],["🇧🇾","Беларусь","375"],["🇺🇿","Узбекистан","998"],
["🇰🇬","Кыргызстан","996"],["🇹🇯","Таджикистан","992"],["🇦🇿","Азербайджан","994"],["🇦🇲","Армения","374"],["🇬🇪","Грузия","995"],
["🇲🇩","Молдова","373"],["🇱🇻","Латвия","371"],["🇱🇹","Литва","370"],["🇪🇪","Эстония","372"],["🇵🇱","Польша","48"],["🇨🇿","Чехия","420"],
["🇩🇪","Германия","49"],["🇫🇷","Франция","33"],["🇮🇹","Италия","39"],["🇪🇸","Испания","34"],["🇬🇧","Великобритания","44"],["🇺🇸","США","1"],
["🇨🇦","Канада","1"],["🇲🇽","Мексика","52"],["🇧🇷","Бразилия","55"],["🇹🇷","Турция","90"],["🇦🇪","ОАЭ","971"],["🇮🇱","Израиль","972"],
["🇪🇬","Египет","20"],["🇮🇳","Индия","91"],["🇨🇳","Китай","86"],["🇯🇵","Япония","81"],["🇰🇷","Южная Корея","82"],["🇹🇭","Таиланд","66"],
["🇻🇳","Вьетнам","84"],["🇮🇩","Индонезия","62"],["💎","Анонимные номера","888"]];
const DIALS=[...new Set(COUNTRIES.map(c=>c[2]))].sort((a,b)=>b.length-a.length);
function fmtPhone(d){
 if(!d)return 'Неизвестен';d=String(d);
 const cc=DIALS.find(c=>d.startsWith(c))||'';const rest=d.slice(cc.length);
 const g=(cc==='888'?rest.match(/.{1,4}/g):rest.match(/.{1,3}/g))||[];
 return '+'+cc+' '+g.join(' ');}
function fillCountries(){
 const s=$('#country');
 COUNTRIES.forEach((c,i)=>s.append(h('option',{value:i},c[0]+'  '+c[1])));
 s.onchange=()=>{$('#cc').value='+'+COUNTRIES[s.value][2];};
 $('#cc').oninput=()=>{
  const d=$('#cc').value.replace(/\D/g,'');$('#cc').value='+'+d;
  const i=COUNTRIES.findIndex(c=>d.startsWith(c[2]));if(i>=0)s.value=i;};
 $('#pn').oninput=()=>{$('#pn').value=$('#pn').value.replace(/[^\d\s\-()]/g,'');};}

/* ---------- вход как в Telegram ---------- */
let authPhone='',regToken='',regAvatar='';
let pwToken='';
function showStep(n){[1,2,3,4].forEach(i=>$('#s'+i).classList.toggle('hide',i!==n));
 ['#e1','#e2','#e3','#e4'].forEach(s=>$(s).textContent='');}
async function checkPw(){
 try{const j=await post('/api/auth/check_password',{pw_token:pwToken,password:$('#cpw').value});finishLogin(j.token);}
 catch(e){$('#e4').textContent=e.message;$('#cpw').select();}}
async function sendCode(resend){
 const phone=($('#cc').value+$('#pn').value).replace(/\D/g,'');
 $('#e1').textContent='';
 if(phone.length<(phone.startsWith('888')?6:7)){$('#e1').textContent='Введи номер телефона';return;}
 try{
  const j=await post('/api/auth/send_code',{phone});
  authPhone=phone;showStep(2);
  $('#phTitle').textContent=fmtPhone(phone);
  $('#codeHint').textContent=j.via==='telegram'?'Код отправлен в Telegram-бота @'+j.bot+'. Откройте чат с ботом и введите код отсюда.':j.registered
   ?'Мы отправили код в чат «GodGram» на другом вашем устройстве, где вы уже вошли. Он также выведен в консоли сервера (Termux).'
   :'SMS не отправляются: это демо-сервер. Код показан ниже и в консоли Termux.';
  const dm=$('#demo');
  if(j.code){dm.classList.remove('hide');setKids(dm,'Ваш код: ',h('b',{},j.code));}else dm.classList.add('hide');
  $('#code').value='';$('#code').focus();
  if(resend)toast('Код отправлен ещё раз');
 }catch(e){(resend?$('#e2'):$('#e1')).textContent=e.message;}}
async function checkCode(){
 const code=$('#code').value.replace(/\D/g,'');if(code.length!==5)return;
 try{
  const j=await post('/api/auth/sign_in',{phone:authPhone,code});
  if(j.need_password){pwToken=j.pw_token;showStep(4);$('#cpw').value='';
   $('#pwHint').textContent='Ваш аккаунт защищён облачным паролем.'+(j.hint?' Подсказка: '+j.hint:'');$('#cpw').focus();}
  else if(j.registered)finishLogin(j.token);
  else{regToken=j.reg_token;showStep(3);$('#fn').focus();}
 }catch(e){$('#e2').textContent=e.message;$('#code').select();}}
function finishLogin(t){
 token=t;
 if($('#keep').checked){localStorage.setItem('tok',t);sessionStorage.removeItem('tok');}
 else{sessionStorage.setItem('tok',t);localStorage.removeItem('tok');}
 boot();}
async function signUp(){
 try{
  const j=await post('/api/auth/sign_up',{reg_token:regToken,first_name:$('#fn').value,last_name:$('#ln').value,avatar:regAvatar});
  finishLogin(j.token);
 }catch(e){$('#e3').textContent=e.message;}}
function initAuth(){
 fillCountries();initIntro();
 $('#b1').onclick=()=>sendCode(false);
 $('#pn').onkeydown=e=>{if(e.key==='Enter')sendCode(false);};
 $('#phEdit').onclick=()=>showStep(1);
 $('#resend').onclick=()=>sendCode(true);
 $('#code').oninput=()=>{$('#code').value=$('#code').value.replace(/\D/g,'');$('#e2').textContent='';if($('#code').value.length===5)checkCode();};
 $('#b3').onclick=signUp;
 $('#b4').onclick=checkPw;
 $('#cpw').onkeydown=e=>{if(e.key==='Enter')checkPw();};
 setKids($('#sAv'),avatarPicker({name:'＋'},d=>regAvatar=d));}

function logout(forced){
 if(!forced&&token)fetch('/api/logout',{method:'POST',headers:{'Authorization':'Bearer '+token}}).catch(()=>{});
 token='';localStorage.removeItem('tok');sessionStorage.removeItem('tok');pollId++;me=null;cur=null;chats=[];firstLoad=true;
 $('#app').classList.add('hide');
 document.querySelectorAll('.overlay,.menu').forEach(x=>x.remove());
 showStep(1);
 if(forced){$('#intro').classList.add('hide');$('#auth').classList.remove('hide');$('#e1').textContent='Сессия закончилась или аккаунт удалён';}
 else showIntro();}

async function boot(){
 if(!token){showIntro();return;}
 try{const j=await api('/api/me');me=j.me;ver=j.v;}catch(e){return;}
 $('#intro').classList.add('hide');$('#auth').classList.add('hide');$('#app').classList.remove('hide');
 await loadChats();startPoll();}

