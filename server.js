// Hey Bori — PWA + personalized greeting (self-contained) + continuity default + mobile layout.
// Asks name once, remembers locally, greets personally next time. Spanish first → English.

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

// ---------- icons + manifest + service worker ----------
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

// ---------- page ----------
const PAGE=`<!doctype html><html lang="en"><head>
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
<header><div><h1 class="title">Hey Bori</h1><p class="sub">Spanish first, then English · Continuity ON</p></div>
<div class="toolbar"><button id="btnClear">Clear</button><button id="btnNew">New</button></div></header>
<div id="messages"></div><div id="typing">Hey Bori is typing…</div>
<form id="ask"><textarea id="q" placeholder="Ask your question in ES or EN…" required></textarea>
<button id="send" type="submit"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></form>
</section>
<script>
${require('fs').readFileSync(__dirname + '/greet-inline.js', 'utf8')}
</script></body></html>`;

// Inline greeting logic directly here (no file read)
const INLINE_SCRIPT = `
window.addEventListener("error",e=>{alert("JS Error: "+e.message)});
var CONT=true, HIST="bori_chat_hist", NAME="bori_name";
function load(){try{return JSON.parse(localStorage.getItem(HIST))||[]}catch(e){return[]}}
function save(t){localStorage.setItem(HIST,JSON.stringify(t))}
function push(r,c){var h=load();h.push({role:r,content:c,ts:Date.now()});save(h);render()}
function when(t){return new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function esc(s){return s.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
function bubble(r,c){var u=r==='user';return '<div class=row '+(u?'right user':'assistant')+'><div class=avatar>'+(u?'C':'B')+'</div><div><div class=bubble>'+esc(c)+'</div></div></div>'}
function render(){document.getElementById('messages').innerHTML=load().map(m=>bubble(m.role,m.content)).join('')}
function greet(){var n=localStorage.getItem(NAME)||'';if(n)push('assistant','¡Hola otra vez, '+n+'! / Welcome back, '+n+'!');else{push('assistant','¡Hola! Soy Hey Bori. ¿Cómo te llamas? / What\\'s your name?');localStorage.setItem('askname','1');}}
async function ask(q){var h=load().map(m=>({role:m.role,content:m.content}));var r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q,history:h,cont:true})});var j=await r.json();return j.answer;}
document.getElementById('ask').onsubmit=async e=>{
e.preventDefault();var q=document.getElementById('q').value.trim();if(!q)return;
document.getElementById('q').value='';push('user',q);
if(localStorage.getItem('askname')==='1'&&!localStorage.getItem(NAME)){
localStorage.setItem(NAME,q.replace(/^(me llamo|mi nombre es|soy)\\s+/i,''));
localStorage.removeItem('askname');
push('assistant','Encantado, '+localStorage.getItem(NAME)+'! / Great to meet you, '+localStorage.getItem(NAME)+'!');return;
}
var a=await ask(q);push('assistant',a);
};
document.getElementById('btnClear').onclick=()=>{localStorage.removeItem(HIST);render();}
document.getElementById('btnNew').onclick=()=>{localStorage.removeItem(HIST);location.reload();}
render();if(load().length===0)greet();
`;

// Serve everything
const server=http.createServer((req,res)=>{
try{
const u=new URL(req.url,'http://'+(req.headers.host||'localhost'));
if(setCommonHeaders(res,u)){res.end();return;}
if(req.method==='GET'&&u.pathname==='/')return html(res,PAGE.replace("${require('fs').readFileSync(__dirname + '/greet-inline.js', 'utf8')}",INLINE_SCRIPT));
if(req.method==='GET'&&u.pathname==='/manifest.webmanifest')return send(res,200,'application/manifest+json',Buffer.from(MANIFEST));
if(req.method==='GET'&&u.pathname==='/icon-192.png')return send(res,200,'image/png',ICON192);
if(req.method==='GET'&&u.pathname==='/icon-512.png')return send(res,200,'image/png',ICON512);
if(req.method==='GET'&&u.pathname==='/sw.js')return send(res,200,'application/javascript',Buffer.from(SW_JS));
if(req.method==='POST'&&u.pathname==='/api/ask'){
let body='';req.on('data',c=>body+=c);req.on('end',async()=>{
try{
const j=JSON.parse(body||'{}');const q=j.question||'';const hist=j.history||[];
const msgs=[{role:'system',content:'Responde primero en Español (PR) y luego repite en Inglés. Termina con “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'},
...hist,{role:'user',content:q}];
const answer=await openAIChat(msgs);json(res,200,{answer});
}catch(e){json(res,200,{answer:'Error — '+e.message});}
});return;
}
text(res,404,'Not Found');
}catch(e){text(res,500,'Internal Server Error '+e.message);}
});
server.listen(PORT,()=>console.log('✅ Hey Bori — personalized + PWA listening on '+PORT));
