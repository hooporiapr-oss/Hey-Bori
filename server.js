// Hey Bori — self-contained PWA + personalized greeting + continuity + mobile layout.
// No external files. Spanish first → English. — Bori Labs LLC — Let’s Go Pa’lante 🏀

process.on('uncaughtException', e => console.error('[uncaughtException]', e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS_RAW =
process.env.CSP_ANCESTORS ||
'https://heybori.co https://www.heybori.co https://chat.heybori.co';

// ---------- basic utils ----------
function text(res, code, s){res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(String(s));}
function html(res, s){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(s);}
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));}
function send(res,code,type,buf){res.writeHead(code,{'Content-Type':type,'Cache-Control':'public, max-age=31536000, immutable'});res.end(buf);}

// ---------- CSP + redirect ----------
function buildFrameAncestors(raw){
const c=String(raw||'').replace(/[\r\n'"]/g,' ').replace(/\s+/g,' ').trim();
const list=c.split(/[,\s]+/).filter(Boolean);
return 'frame-ancestors '+(list.length?list:['https://heybori.co','https://chat.heybori.co']).join(' ');
}
const CSP_VALUE=buildFrameAncestors(FRAME_ANCESTORS_RAW);
function setCommonHeaders(res,u){
res.setHeader('Cache-Control','no-store');
res.setHeader('Content-Security-Policy',CSP_VALUE);
const host=(u.host||'').toLowerCase();
if(host.endsWith('.onrender.com')){
res.statusCode=301;
res.setHeader('Location','https://'+FORCE_DOMAIN+(u.pathname||'/')+(u.search||''));
return true;
}
return false;
}

// ---------- OpenAI ----------
function openAIChat(messages){
return new Promise(resolve=>{
if(!process.env.OPENAI_API_KEY)
return resolve('Missing API key.\n— Bori Labs LLC — Let’s Go Pa’lante 🏀');
const body=JSON.stringify({model:'gpt-4o-mini',temperature:0.3,messages});
const req=https.request(
{method:'POST',hostname:'api.openai.com',path:'/v1/chat/completions',
headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:30000},
r=>{
let d='';r.setEncoding('utf8');r.on('data',c=>d+=c);
r.on('end',()=>{try{const j=JSON.parse(d);resolve(j?.choices?.[0]?.message?.content||'Temporary error — try again.');}
catch(e){resolve('Temporary error — '+e.message);}});
});
req.on('error',e=>resolve('Network error — '+e.message));
req.on('timeout',()=>{req.destroy();resolve('Request timed out');});
req.write(body);req.end();
});
}

// ---------- tiny icons + manifest + SW (inline) ----------
const ICON192=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAQAAAB3mCQtAAAAAklEQVR4AewaftIAAAGLSURBVO3BQY4AAAwEwST9x1w2mQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwH1yBAAFr0mBvAAAAAElFTkSuQmCC','base64');
const ICON512=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAgCAQAAAB3bN0sAAAAAklEQVR4AWNgYGBgYGBg+P8fAAGmAQm2+0j+AAAAAElFTkSuQmCC','base64');
const MANIFEST=JSON.stringify({
name:"Hey Bori",short_name:"Hey Bori",
description:"Bilingual chat — Spanish first, then English.",
start_url:"/",scope:"/",display:"standalone",
background_color:"#ffffff",theme_color:"#0a3a78",
icons:[{src:"/icon-192.png",sizes:"192x192",type:"image/png"},
{src:"/icon-512.png",sizes:"512x512",type:"image/png"}]
});
const SW_JS=`const CACHE_NAME='bori-shell-v1';
const SHELL=['/','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL)).then(self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
const url=new URL(e.request.url);
if(url.pathname.startsWith('/api/'))return;
if(e.request.mode==='navigate'||SHELL.includes(url.pathname)){
e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).catch(()=>caches.match('/'))));
}
});`;

// ---------- page (inline JS; no external reads) ----------
const PAGE = `<!doctype html><html lang="en"><head>
<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a3a78"><link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/icon-192.png">
<title>Hey Bori</title>
<style>
html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111}
.app{min-height:100svh;display:flex;flex-direction:column;background:#fff}
header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #eee}
.title{margin:0;font:800 20px/1.2 system-ui}
.sub{margin:0;color:#666;font:500 12px/1.4 system-ui}
.toolbar{display:flex;gap:8px}
button{padding:10px 14px;border-radius:12px;border:1px solid #0c2a55;background:#0a3a78;color:#fff;font-weight:700;cursor:pointer}
#btnClear{background:#ff4d4d;border-color:#ff4d4d}#btnNew{background:#444;border-color:#444}
#messages{flex:1 1 auto;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}
.row{display:flex;gap:10px;align-items:flex-start}
.avatar{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;border:1px solid #e6e6e6}
.right{justify-content:flex-end}.right .avatar{background:#0a3a78;color:#fff;border-color:#b2c8ff}
.bubble{max-width:85%;border:1px solid #e6e6e6;border-radius:12px;padding:10px 12px;background:#fff;white-space:pre-wrap;line-height:1.55}
.user .bubble{background:#eef4ff;border-color:#d8e7ff}.assistant .bubble{background:#f7f7f7}
form{position:sticky;bottom:0;left:0;right:0;display:flex;align-items:center;gap:10px;border-top:1px solid #eee;
padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:#fff;box-shadow:0 -3px 8px rgba(0,0,0,.04)}
textarea{flex:1 1 auto;min-height:48px;max-height:160px;resize:none;padding:10px 12px;border:1px solid #ddd;border-radius:12px;font-size:16px}
#send{flex:0 0 auto;display:grid;place-items:center;width:46px;height:46px;padding:0;border-radius:12px;border:1px solid #0c2a55;background:#0a3a78;color:#fff;font-weight:700;cursor:pointer}
#send:disabled{opacity:.6;cursor:default}
#typing{padding:0 14px 8px;color:#666;font:500 12px/1.4 system-ui;display:none}
</style></head><body>
<section class="app">
<header>
<div><h1 class="title">Hey Bori</h1><p class="sub">Spanish first, then English · Continuity ON</p></div>
<div class="toolbar"><button id="btnClear">Clear</button><button id="btnNew">New</button></div>
</header>
<div id="messages"></div>
<div id="typing">Hey Bori is typing…</div>
<form id="ask" autocomplete="off">
<textarea id="q" placeholder="Ask your question in ES or EN…" required></textarea>
<button id="send" type="submit" aria-label="Send">
<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
</button>
</form>
</section>

<script>
// ===== Error overlay (non-blocking) =====
window.addEventListener("error",function(e){
console.log("[JS]", e.message||"error");
});

// ===== Flags & storage keys =====
var CONT = true; // continuity ON by default
var HIST_KEY="bori_chat_hist_v1";
var NAME_KEY="bori_user_name";
var ASK_KEY ="bori_ask_name"; // "1" while asking for name

// ===== Storage helpers =====
function loadHist(){ try{ return JSON.parse(localStorage.getItem(HIST_KEY))||[] }catch(e){ return [] } }
function saveHist(t){ try{ localStorage.setItem(HIST_KEY, JSON.stringify(t)) }catch(e){} }
function clearHist(){ try{ localStorage.removeItem(HIST_KEY) }catch(e){} }

function getName(){ try{ return localStorage.getItem(NAME_KEY)||"" }catch(e){ return "" } }
function setName(n){ try{ localStorage.setItem(NAME_KEY, n) }catch(e){} }
function isAskingName(){ return localStorage.getItem(ASK_KEY)==="1" }
function setAskingName(on){ try{ localStorage.setItem(ASK_KEY, on?"1":"0") }catch(e){} }

// ===== UI elements =====
var els={list:document.getElementById("messages"),form:document.getElementById("ask"),q:document.getElementById("q"),
send:document.getElementById("send"),btnClear:document.getElementById("btnClear"),btnNew:document.getElementById("btnNew"),
typing:document.getElementById("typing")};

// ===== Utils =====
function when(t){ return new Date(t||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) }
function esc(s){ return String(s).replace(/[&<>\"\\']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[m] }) }
function bubble(role,content,ts){
var u=role==="user"; var who=u?"Coach":"Hey Bori"; var i=u?"C":"B";
return '<div class="row '+(u?'right user':'assistant')+'"><div class=avatar>'+i+
'</div><div><div class=meta>'+who+' · '+when(ts)+'</div><div class=bubble>'+esc(content)+'</div></div></div>';
}
function scrollToEnd(){ els.list.scrollTop = els.list.scrollHeight }
function render(){
var h = CONT ? loadHist() : [];
els.list.innerHTML = h.map(function(m){ return bubble(m.role,m.content,m.ts) }).join("");
scrollToEnd();
}
function push(role,content){
var h = loadHist(); h.push({role,content,ts:Date.now()}); saveHist(h); render();
}

// ===== Typing indicator =====
var _tyInt=null,_tyDot=0;
function showTyping(on){
if(!els.typing) return;
els.typing.style.display = on ? "block" : "none";
if(on){
if(_tyInt) clearInterval(_tyInt);
_tyDot=0;
_tyInt=setInterval(function(){_tyDot=(_tyDot+1)%4;els.typing.textContent="Hey Bori is typing"+(".".repeat(_tyDot));},450);
}else{
if(_tyInt){ clearInterval(_tyInt); _tyInt=null; }
els.typing.textContent = "Hey Bori is typing…";
}
}

// ===== Input QoL =====
(function(){ // auto-resize
var ta=els.q; function fit(){ ta.style.height="auto"; ta.style.height=Math.min(180, ta.scrollHeight)+"px"; }
ta.addEventListener("input",fit); ta.addEventListener("focus",fit); setTimeout(fit,0);
})();
els.q.addEventListener("keydown",function(e){ // Enter=send, Shift+Enter=newline
if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); els.send.click(); }
});

// ===== Name capture helpers =====
function likelyName(s){
var t = String(s||"").trim(); if(!t) return false; if(t.length>40) return false;
t = t.replace(/^((me\\s+llamo|mi\\s+nombre\\s+es|soy|yo\\s+soy|i\\s*am|i'm|my\\s+name\\s+is)\\s+)/i,'').trim();
if(!/^[A-Za-zÀ-ÿ'’-]+(\\s+[A-Za-zÀ-ÿ'’-]+){0,2}$/.test(t)) return false;
return t;
}
function greetFor(name){
if(name){
return "¡Hola otra vez, "+name+"! ¿Listo para continuar? / Welcome back, "+name+" — ready to continue?\\n— Bori Labs LLC — Let’s Go Pa’lante 🏀";
}
return "¡Hola! Soy Hey Bori. Pregúntame lo que quieras en Español o Inglés. ¿Cómo te llamas? / Hi! I’m Hey Bori. Ask me anything in Spanish or English. What’s your name?\\n— Bori Labs LLC — Let’s Go Pa’lante 🏀";
}

// ===== Server call =====
async function askServer(q){
var history = CONT ? loadHist().map(function(m){ return {role:m.role, content:String(m.content||"").slice(0,2000)} }) : [];
var r = await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:q, lang:"es", history:history, cont:CONT})});
var j = await r.json().catch(function(){ return {answer:"Error"} });
return j.answer || "No answer.";
}

// ===== Submit handler =====
els.form.addEventListener("submit", async function(e){
e.preventDefault();
var q = els.q.value.trim(); if(!q) return;
els.q.value = "";
if(CONT){ push("user", q); } else { els.list.insertAdjacentHTML("beforeend", bubble("user", q, Date.now())); scrollToEnd(); }

// If we were asking their name and this looks like a name: store & greet — no OpenAI call this turn
if(isAskingName() && !getName()){
var nm = likelyName(q);
if(nm){
setName(nm); setAskingName(false);
push("assistant","Encantado, "+nm+" 🤝.\\nDesde ahora te saludaré por tu nombre.\\n/ Great to meet you, "+nm+"! I’ll greet you by name from now on.\\n— Bori Labs LLC — Let’s Go Pa’lante 🏀");
return;
}
}

// normal flow → OpenAI
els.send.disabled = true; showTyping(true);
try{
var a = await askServer(q);
push("assistant", a);
}catch(err){
push("assistant","(network) "+(err&&err.message||err));
}finally{
showTyping(false); els.send.disabled=false; els.q.focus();
}
});

// ===== Header buttons =====
document.getElementById("btnClear").addEventListener("click", function(){ clearHist(); render(); });
document.getElementById("btnNew").addEventListener("click", function(){ clearHist(); location.replace(location.pathname + location.search); });

// ===== First paint + Greeting logic =====
(function firstPaint(){
var h = loadHist();
if(h.length===0){
var nm = getName();
if(nm){ push("assistant", greetFor(nm)); setAskingName(false); }
else { push("assistant", greetFor("")); setAskingName(true); }
return;
}
render();
})();
</script>
</body></html>`;

// ---------- server ----------
const server=http.createServer((req,res)=>{
try{
const u=new URL(req.url,'http://'+(req.headers.host||'localhost'));
if(setCommonHeaders(res,u)){res.end();return;}

// PWA assets
if(req.method==='GET'&&u.pathname==='/manifest.webmanifest') return send(res,200,'application/manifest+json',Buffer.from(MANIFEST));
if(req.method==='GET'&&u.pathname==='/sw.js') return send(res,200,'application/javascript',Buffer.from(SW_JS));
if(req.method==='GET'&&u.pathname==='/icon-192.png') return send(res,200,'image/png',ICON192);
if(req.method==='GET'&&u.pathname==='/icon-512.png') return send(res,200,'image/png',ICON512);

// App page
if(req.method==='GET'&&u.pathname==='/') return html(res,PAGE);

// Chat API
if(req.method==='POST'&&u.pathname==='/api/ask'){
let body='';req.on('data',c=>body+=c);req.on('end',async()=>{
try{
const j=JSON.parse(body||'{}');
const q=(j.question||'').toString().slice(0,4000);
const lang=(j.lang||'es').toLowerCase();
const cont=!!j.cont;
const hist=Array.isArray(j.history)?j.history:[];

const systemPrompt=(lang==='en')
? 'Respond ONLY in English. Use conversation context if provided. Be concise and avoid repeating earlier answers unless asked. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'
: 'Responde primero en Español (PR) y luego repite en Inglés. Usa TODO el contexto previo si se provee. Sé conciso y evita repetir salvo que te lo pidan. Termina con “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.';

const msgs = cont
? [{role:'system',content:systemPrompt}, ...hist, {role:'user',content:q}]
: [{role:'system',content:systemPrompt}, {role:'user',content:q}];

const answer = await openAIChat(msgs);
return json(res,200,{answer});
}catch(e){ return json(res,200,{answer:'Error — '+e.message}); }
}); return;
}

text(res,404,'Not Found');
}catch(e){ text(res,500,'Internal Server Error: '+e.message); }
});

server.listen(Number(PORT),()=>console.log('✅ Hey Bori — self-contained, personalized, PWA — listening on '+PORT));
