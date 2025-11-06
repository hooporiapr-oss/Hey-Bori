// Hey Bori™ — gradient UI + inline SVG logo + continuity + PWA
// Denylist guardrails (incl. guns/explosives/terrorism/war/drugs)
// Agents Router: chat | math | planner | summarize | writer | translate (+ /commands)
// Signature: "— Hey Bori™ — Let’s Go Pa’lante"

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

// ---------- tiny utils ----------
function text(res, code, s){res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(String(s));}
function html(res, s){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(s);}
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));}
function send(res,code,type,buf){res.writeHead(code,{'Content-Type':type,'Cache-Control':'public, max-age=31536000, immutable'});res.end(buf);}

// ---------- CSP + forced domain ----------
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

// ---------- Policy guardrails (denylist) ----------
const BLOCK_PATTERNS = [
// Religion / belief
/\b(religion|religious|christian|muslim|islam|jewish|judaism|hindu|buddhist|atheis[tm])\b/i,
/\b(religi[óo]n|religios[oa]s?|cristi(an[oa]s?)?)\b/i,

// Politics & ideology
/\b(politic[s]?|election|left[-\s]?wing|right[-\s]?wing|liberal|conservative|democrat|republican|politician|campaign)\b/i,
/\b(pol[ií]tica[s]?|elecci[óo]n|izquierda|derecha|liberal(?:es)?|conservador(?:es)?|partido|campaña)\b/i,
/\bwoke\b/i,

// Sexually explicit / identity
/\b(sex|sexual|porn|nsfw|erotic|explicit|fetish|nude|onlyfans)\b/i,
/\b(trans(?:sexual|gender)?|non[-\s]?binary|lgbtq?|gay|lesbian|bisexual|queer)\b/i,
/\b(sexo|sexual|porn[oó]|er[óo]tico|expl[íi]cito|fetiche|nudez)\b/i,

// Guns, weapons, violence
/\b(gun|firearm|pistol|rifle|shotgun|bullet|ammo|weapon|assault\s*rifle|revolver)\b/i,
/\b(arma[s]?|pistola|rifle|escopeta|munici[oó]n|balas|fusil|rev[oó]lver)\b/i,

// Explosives / bombs
/\b(bomb|explosive|grenade|detonate|missile|warhead|IED)\b/i,
/\b(bomba|explosivo|granada|detonar|misil|artefacto\s*explosivo)\b/i,

// Terrorism / extremism
/\b(terror(ist|ism)?|extremist|militia|radical|jihad|attack|bombing)\b/i,
/\b(terrorismo|terrorista|extremista|milicia|radical|ataque|atentado)\b/i,

// War / conflict
/\b(war|battlefield|army|soldier|military|strike|invasion|combat|nuclear)\b/i,
/\b(guerra|batalla|ej[eé]rcito|soldado|militar|invas[ií]on|combate|nuclear)\b/i,

// Drugs / trafficking
/\b(drug|cocaine|heroin|meth|fentanyl|marijuana|weed|cartel|smuggl|traffick|narcotic)\b/i,
/\b(droga[s]?|coca[ií]na|hero[ií]na|metanfetamina|fentanilo|marihuana|cartel|contrabando|tr[aá]fico|narc[oó]tico)\b/i,
];

function violatesPolicy(text){
if(!text) return false;
return BLOCK_PATTERNS.some(rx => rx.test(text));
}
function refusalMessage(){
return (
"ES/EN: Lo siento, no puedo ayudar con ese tipo de consulta (temas restringidos como armas, violencia, drogas, política, religión o contenido sexual). " +
"Puedo apoyar con temas generales, educativos o técnicos.\n" +
"EN: Sorry, I can’t help with that type of inquiry (restricted topics like weapons, violence, drugs, politics, religion, or sexual content). " +
"I can help with general, educational, or technical topics instead.\n" +
"— Hey Bori™ — Let’s Go Pa’lante"
);
}

// ---------- Agents: router + helpers ----------
const AGENT_LIST = ['chat','math','planner','summarize','writer','translate'];

function detectSlashAgent(q){
if(!q) return null;
const m = q.match(/^\/(math|plan|sum|write|translate)\b/i);
if(!m) return null;
const map = { math:'math', plan:'planner', sum:'summarize', write:'writer', translate:'translate' };
return { agent: map[m[1].toLowerCase()], stripped: q.replace(/^\/\w+\s*/,'') };
}

function agentSystemPrompt(agent){
const baseES = "Eres Hey Bori. Usa el contexto de la sesión. Escribe primero en Español y luego en Inglés. Termina con “— Hey Bori™ — Let’s Go Pa’lante”.";
const baseEN = "You are Hey Bori. Use session context. Write Spanish first, then English. End with “— Hey Bori™ — Let’s Go Pa’lante”.";
switch(agent){
case 'math':
return { es: baseES + " Resuelve cálculos con precisión; muestra pasos breves si ayudan.",
en: baseEN + " Solve calculations precisely; show brief steps if helpful." };
case 'planner':
return { es: baseES + " Divide objetivos en pasos accionables con tiempos cortos.",
en: baseEN + " Break goals into actionable steps with short timelines." };
case 'summarize':
return { es: baseES + " Resume en bullets claros (5–8) y una conclusión breve.",
en: baseEN + " Summarize in 5–8 clear bullets plus a brief conclusion." };
case 'writer':
return { es: baseES + " Redacta con tono claro y directo; corrige gramática si es necesario.",
en: baseEN + " Write clearly and directly; fix grammar where useful." };
case 'translate':
return { es: baseES + " Traduce con fidelidad entre Español ↔ Inglés; conserva nombres propios y formato.",
en: baseEN + " Translate faithfully ES ↔ EN; preserve proper names and formatting." };
default:
return { es: baseES, en: baseEN };
}
}

async function routeAgent(question){
const routerSys = "Act as a router. Output ONLY compact JSON like {\"agent\":\"chat|math|planner|summarize|writer|translate\"}. Pick one. No prose.";
const body = JSON.stringify({
model: 'gpt-4o-mini',
temperature: 0,
messages: [
{ role: 'system', content: routerSys },
{ role: 'user', content: "Q: " + String(question||'').slice(0,2000) }
]
});
try{
const raw = await new Promise((resolve)=>{
const req=https.request(
{method:'POST',hostname:'api.openai.com',path:'/v1/chat/completions',
headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},
r=>{let d='';r.setEncoding('utf8');r.on('data',c=>d+=c);r.on('end',()=>resolve(d))}
); req.on('error',e=>resolve('')); req.write(body); req.end();
});
const j = JSON.parse(raw||'{}');
const txt = j?.choices?.[0]?.message?.content || '';
try{ const o = JSON.parse(txt); return AGENT_LIST.includes(o.agent)? o.agent : 'chat'; }
catch{ return 'chat'; }
}catch{ return 'chat'; }
}

// ---------- OpenAI call ----------
function openAIChatWithTemp(messages, temperature){
return new Promise(resolve=>{
if(!process.env.OPENAI_API_KEY)
return resolve('Missing API key.\n— Hey Bori™ — Let’s Go Pa’lante');
const body=JSON.stringify({ model:'gpt-4o-mini', temperature:temperature??0.2, messages });
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

// ---------- inline icons + manifest + service worker ----------
const ICON192=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAQAAAB3mCQtAAAAAklEQVR4AewaftIAAAGLSURBVO3BQY4AAAwEwST9x1w2mQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwH1yBAAFr0mBvAAAAAElFTkSuQmCC','base64');
const ICON512=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAgCAQAAAB3bN0sAAAAAklEQVR4AWNgYGBgYGBg+P8fAAGmAQm2+0j+AAAAAElFTkSuQmCC','base64');
const MANIFEST=JSON.stringify({
name:"Hey Bori™",short_name:"Hey Bori™",
description:"Bilingual chat — Spanish first, then English.",
start_url:"/",scope:"/",display:"standalone",
background_color:"#0a3a78",theme_color:"#0a3a78",
icons:[{src:"/icon-192.png",sizes:"192x192",type:"image/png"},
{src:"/icon-512.png",sizes:"512x512",type:"image/png"}]
});
const SW_JS=`const CACHE_NAME='bori-shell-v2';
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

// ---------- page (inline JS) ----------
const PAGE = `<!doctype html><html lang="es"><head>
<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a3a78"><link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/icon-192.png">
<title>Hey Bori™</title>
<style>
:root{
--bori-deep:#0a3a78;
--bori-sky:#1c64ff;
--white:#ffffff;
--text:#101114;
--border:#e6e6e6;
}
html,body{margin:0;height:100%;background:linear-gradient(180deg,var(--bori-deep) 0%,var(--bori-sky) 100%);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--text)}
.app{min-height:100svh;display:flex;flex-direction:column;background:transparent}
header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;
background:linear-gradient(180deg,rgba(10,58,120,0.85) 0%, rgba(10,58,120,0.55) 100%);backdrop-filter:saturate(1.2) blur(2px);
border-bottom:1px solid rgba(255,255,255,0.2)}
.brandwrap{display:flex;align-items:center;gap:10px}
.title{margin:0;font:800 20px/1.2 system-ui;color:#fff}
.sub{margin:4px 0 0 0;color:rgba(255,255,255,0.9);font:600 12px/1.4 system-ui}
.namepill{display:inline-flex;align-items:center;gap:8px;margin-top:8px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.35);color:#fff;
font:600 12px/1 system-ui;border-radius:999px;padding:6px 10px;cursor:pointer}
.namepill .dot{width:8px;height:8px;border-radius:50%;background:#fff}
.toolbar{display:flex;gap:8px}
button{padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.65);background:transparent;color:#fff;font-weight:800;cursor:pointer}
button:hover{background:rgba(255,255,255,0.08)}
#messages{flex:1 1 auto;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}
.row{display:flex;gap:10px;align-items:flex-start}
.avatar{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;border:1px solid rgba(255,255,255,0.6);color:#fff}
.right{justify-content:flex-end}.right .avatar{background:rgba(255,255,255,0.2)}
.avatar{background:rgba(255,255,255,0.2)}
.bubble{max-width:85%;border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--white);white-space:pre-wrap;line-height:1.55;
box-shadow:0 6px 18px rgba(0,0,0,0.08)}
.user .bubble{background:#eef4ff;border-color:#d8e7ff}
.assistant .bubble{background:#ffffff}
form{position:sticky;bottom:0;left:0;right:0;display:flex;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,0.35);
padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));
background:linear-gradient(0deg, rgba(255,255,255,0.85), rgba(255,255,255,0.92));backdrop-filter:blur(6px)}
textarea{flex:1 1 auto;min-height:48px;max-height:160px;resize:none;padding:10px 12px;border:1px solid #ddd;border-radius:12px;font-size:16px}
#send{flex:0 0 auto;display:grid;place-items:center;width:46px;height:46px;padding:0;border-radius:12px;border:1px solid #0c2a55;background:#0a3a78;color:#fff;font-weight:800;cursor:pointer}
#send:disabled{opacity:.6;cursor:default}
#typing{padding:4px 14px 8px;color:rgba(255,255,255,0.95);font:600 12px/1.4 system-ui;display:none;text-shadow:0 1px 2px rgba(0,0,0,0.2)}
.logo svg{width:36px;height:36px;flex-shrink:0;border-radius:50%;background:#fff}
.hint{padding:6px 16px 0;color:rgba(255,255,255,0.85);font:600 12px/1.4 system-ui}

/* Chips */
.chips{display:flex;gap:8px;padding:8px 14px 0;overflow:auto}
.chip{flex:0 0 auto;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.65);
background:transparent;color:#fff;font:700 12px/1 system-ui;cursor:pointer;white-space:nowrap}
.chip:hover{background:rgba(255,255,255,0.08)}
</style></head><body>
<section class="app">
<header>
<div>
<div class="brandwrap">
<!-- Inline SVG logo -->
<div class="logo">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-label="Hey Bori™ Logo">
<defs><linearGradient id="boriGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#1C64FF"/><stop offset="100%" stop-color="#0A3A78"/>
</linearGradient></defs>
<circle cx="256" cy="256" r="256" fill="#fff"/>
<path fill="url(#boriGrad)" d="M160 120h112c80 0 120 32 120 88 0 36-18 64-52 76 40 10 64 38 64 80 0 64-48 100-132 100H160V120zm76 128h68c32 0 48-12 48-36 0-22-16-36-46-36h-70v72zm0 96h78c34 0 50-12 50-40 0-26-16-40-52-40h-76v80z"/>
</svg>
</div>
<h1 class="title" id="titleText">Hey Bori™</h1>
</div>
<p class="sub">Spanish first, then English · Continuity ON</p>
<div class="namepill" id="namePill" role="button" tabindex="0" style="display:none">
<span class="dot"></span><span id="namePillText">Hola</span>
</div>
</div>
<div class="toolbar">
<button id="btnClear">Clear</button>
<button id="btnNew">New</button>
</div>
</header>
<div id="messages"></div>
<div id="typing">Hey Bori is typing…</div>

<!-- Example chips (optional UI helpers) -->
<div class="chips" id="chips">
<button class="chip" data-cmd="sum">Summarize this</button>
<button class="chip" data-cmd="plan">Plan my week</button>
<button class="chip" data-cmd="translate">Translate ES ↔ EN</button>
<button class="chip" data-cmd="math">Calculate</button>
</div>

<div class="hint">Tap a suggestion or type: /math, /plan, /sum, /write, /translate</div>

<form id="ask" autocomplete="off">
<textarea id="q" placeholder="Ask your question in ES or EN… (use /math, /plan, /sum, /write, /translate to force a skill)" required></textarea>
<button id="send" type="submit" aria-label="Send">
<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
</button>
</form>
</section>

<script>
// Fail-safe: keep UI alive even if a minor error happens elsewhere
window.addEventListener('error', function(){
try {
const el = document.getElementById('typing');
if(el){ el.style.display='block'; el.textContent='Reconnecting… Tap Send again.'; }
} catch(_) {}
});

// ===== Storage & flags =====
var CONT = true; // continuity ON
var HIST_KEY="bori_chat_hist_v1";
var NAME_KEY="bori_user_name";
var ASK_KEY ="bori_ask_name";

function loadHist(){ try{ return JSON.parse(localStorage.getItem(HIST_KEY))||[] }catch(e){ return [] } }
function saveHist(t){ try{ localStorage.setItem(HIST_KEY, JSON.stringify(t)) }catch(e){} }
function clearHist(){ try{ localStorage.removeItem(HIST_KEY) }catch(e){} }

function getName(){ try{ return localStorage.getItem(NAME_KEY)||"" }catch(e){ return "" } }
function setName(n){ try{ localStorage.setItem(NAME_KEY, n) }catch(e){} }
function setAskingName(on){ try{ localStorage.setItem(ASK_KEY, on?"1":"0") }catch(e){} }

// ===== UI =====
var els={list:document.getElementById("messages"),form:document.getElementById("ask"),q:document.getElementById("q"),
send:document.getElementById("send"),btnClear:document.getElementById("btnClear"),btnNew:document.getElementById("btnNew"),
typing:document.getElementById("typing"),
namePill:document.getElementById("namePill"),namePillText:document.getElementById("namePillText")};
console.log('[hey-bori] hooks', !!els.form, !!els.q, !!els.send);

function esc(s){
return String(s).replace(/[&<>\"']/g, function(m){
return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
});
}
function bubble(role,content){
var u=role==="user"; var i=u?"C":"B";
return '<div class="row '+(u?'right user':'assistant')+'"><div class=avatar>'+i+
'</div><div><div class=bubble>'+esc(content)+'</div></div></div>';
}
function render(){
var h = CONT ? loadHist() : [];
els.list.innerHTML = h.map(function(m){ return bubble(m.role,m.content) }).join("");
els.list.scrollTop = els.list.scrollHeight;
}
function push(role,content){
var h = loadHist(); h.push({role,content,ts:Date.now()}); saveHist(h); render();
}

// Greeting bar
function updateGreetingBar(){
var nm = getName();
if(nm){ els.namePill.style.display='inline-flex'; els.namePillText.textContent = "Hola, " + nm + " 👋"; }
else { els.namePill.style.display='none'; }
}

// typing
var _tyInt=null,_tyDot=0;
function showTyping(on){
if(!els.typing) return;
els.typing.style.display = on ? "block" : "none";
if(on){
if(_tyInt) clearInterval(_tyInt);
_tyDot=0; _tyInt=setInterval(function(){_tyDot=(_tyDot+1)%4;els.typing.textContent="Hey Bori is typing"+(".".repeat(_tyDot));},450);
}else{
if(_tyInt){ clearInterval(_tyInt); _tyInt=null; }
els.typing.textContent = "Hey Bori is typing…";
}
}

// auto-resize + Enter=send
(function(){var ta=els.q;function fit(){ta.style.height="auto";ta.style.height=Math.min(180,ta.scrollHeight)+"px";}ta.addEventListener("input",fit);ta.addEventListener("focus",fit);setTimeout(fit,0);})();
els.q.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();els.send.click();}});

// likelyName
function likelyName(s){
var t = String(s||"").trim(); if(!t||t.length>40) return false;
t = t.replace(/^((me\\s+llamo|mi\\s+nombre\\s+es|soy|yo\\s+soy|i\\s*am|i'm|my\\s+name\\s+is)\\s+)/i,'').trim();
if(!/^[A-Za-zÀ-ÿ'’-]+(\\s+[A-Za-zÀ-ÿ'’-]+){0,2}$/.test(t)) return false;
return t;
}
function greetFor(name){
if(name){ return "¡Hola otra vez, "+name+"! ¿Listo para continuar? / Welcome back, "+name+" — ready to continue?\n— Hey Bori™ — Let’s Go Pa’lante"; }
return "¡Hola! Soy Hey Bori™. Pregúntame lo que quieras en Español o Inglés. ¿Cómo te llamas? / Hi! I’m Hey Bori™. Ask me anything in Spanish or English. What’s your name?\n— Hey Bori™ — Let’s Go Pa’lante";
}

// Example chips → prefill textarea with a skill command (NULL-SAFE)
(function(){
var chipsEl = document.getElementById('chips');
if(!chipsEl) return; // if chips not in DOM, do nothing
var box = document.getElementById('q');
function seed(cmd){
switch(cmd){
case 'sum': return '/sum Paste text here → ';
case 'plan': return '/plan Goal: ';
case 'translate': return '/translate ';
case 'math': return '/math ';
default: return '';
}
}
chipsEl.addEventListener('click', function(e){
var b = e.target.closest('.chip'); if(!b) return;
var s = seed(b.dataset.cmd);
var cur = (box.value || '').trim();
box.value = cur ? (s + cur) : s;
box.focus();
box.dispatchEvent(new Event('input')); // trigger autoresize
});
})();

// call server
async function askServer(q){
var history = CONT
? loadHist().map(function(m){ return {role:(m.role==='assistant')?'assistant':'user',content:String(m.content||'').slice(0,2000)}; }).slice(-30)
: [];
var r = await fetch("/api/ask",{ method:"POST", headers:{"content-type":"application/json"},
body:JSON.stringify({question:q, lang:"es", history:history, cont:CONT}) });
var j = await r.json().catch(function(){ return {answer:"Error"} });
return j.answer || "No answer.";
}

// submit
els.form.addEventListener("submit", async function(e){
e.preventDefault();
var q = els.q.value.trim(); if(!q) return;
els.q.value = "";
if(CONT){ push("user", q); } else { els.list.insertAdjacentHTML("beforeend", bubble("user", q)); els.list.scrollTop = els.list.scrollHeight; }

// name capture if asked
if(localStorage.getItem('bori_ask_name')==="1" && !getName()){
var nm = likelyName(q);
if(nm){
localStorage.setItem('bori_ask_name','0');
localStorage.setItem('bori_user_name', nm);
push("assistant","Encantado, "+nm+" 🤝.\nDesde ahora te saludaré por tu nombre.\n/ Great to meet you, "+nm+"! I’ll greet you by name from now on.\n— Hey Bori™ — Let’s Go Pa’lante");
updateGreetingBar();
return;
}
}

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

// header buttons
document.getElementById("btnClear").addEventListener("click", function(){ localStorage.removeItem('bori_chat_hist_v1'); render(); });
document.getElementById("btnNew").addEventListener("click", function(){ localStorage.removeItem('bori_chat_hist_v1'); location.replace(location.pathname + location.search); });
// name pill rename
function openRename(){
var current = localStorage.getItem('bori_user_name')||"";
var ask = current ? "Enter your new name (or leave blank to cancel):"
: "¿Cómo te llamas? / What’s your name? (leave blank to cancel)";
var raw = window.prompt(ask, current || ""); if(raw===null) return;
raw = (raw||"").replace(/\\s+/g,' ').trim(); if(!raw) return;
var nm = likelyName(raw);
if(!nm){ alert("Nombre no válido / Invalid name. Try 1–3 words, letters only."); return; }
localStorage.setItem('bori_user_name', nm); localStorage.setItem('bori_ask_name','0');
push("assistant","Perfecto — te saludaré como "+nm+".\n/ Great! I’ll greet you as "+nm+" from now on.\n— Hey Bori™ — Let’s Go Pa’lante");
updateGreetingBar();
}
els.namePill.addEventListener("click", openRename);
els.namePill.addEventListener("keydown", function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openRename(); }});

// first paint + greeting
(function(){
updateGreetingBar();
var h = loadHist();
if(h.length===0){
var nm = localStorage.getItem('bori_user_name')||"";
if(nm){ push("assistant", greetFor(nm)); localStorage.setItem('bori_ask_name','0'); }
else { push("assistant", greetFor("")); localStorage.setItem('bori_ask_name','1'); }
return;
}
localStorage.setItem('bori_ask_name', (localStorage.getItem('bori_user_name')||"")? '0':'1');
render();
})();

// PWA SW
if("serviceWorker" in navigator){
window.addEventListener("load",function(){ navigator.serviceWorker.register("/sw.js").catch(()=>{}); });
}
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

// Page
if(req.method==='GET'&&u.pathname==='/') return html(res,PAGE);

// API
if(req.method==='POST'&&u.pathname==='/api/ask'){
let body='';req.on('data',c=>body+=c);req.on('end',async()=>{
try{
const j=JSON.parse(body||'{}');
const q =(j.question||'').toString().slice(0,4000);
const lang=(j.lang||'es').toLowerCase();
const cont=!!j.cont;
const histIn=Array.isArray(j.history)?j.history:[];
const normHist=histIn.map(m=>({
role:(m.role==='assistant')?'assistant':'user',
content:String(m.content||'').slice(0,2000)
})).slice(-30);

// Denylist FIRST
const combined = [q].concat((histIn||[]).map(m => m.content||"")).join(" ").slice(0,8000);
if (violatesPolicy(combined)) {
return json(res, 200, { answer: refusalMessage() });
}

// Agents: slash override or auto route
let agentSel='chat', qEff=q;
const slash = detectSlashAgent(q);
if(slash){ agentSel = slash.agent; qEff = slash.stripped || q; }
else { agentSel = await routeAgent(q); }

// Agent-specific system prompt
const sysPair = agentSystemPrompt(agentSel);
const systemPrompt = (lang === 'en') ? sysPair.en : sysPair.es;

// Build messages with continuity
const msgs = cont
? [{role:'system',content:systemPrompt}, ...normHist, {role:'user',content:qEff}]
: [{role:'system',content:systemPrompt}, {role:'user',content:qEff}];

// Temperature by agent
const temp = (agentSel==='writer'||agentSel==='planner')?0.5
:(agentSel==='summarize')?0.2
:(agentSel==='math'||agentSel==='translate')?0.0
:0.2;

console.log('[ask]', {agentSel, hist: normHist.length, qlen: q.length});
const answer = await openAIChatWithTemp(msgs, temp);
return json(res,200,{answer});
}catch(e){ return json(res,200,{answer:'Error — '+e.message}); }
}); return;
}

text(res,404,'Not Found');
}catch(e){ text(res,500,'Internal Server Error: '+e.message); }
});

server.listen(Number(PORT),()=>console.log('✅ Hey Bori™ — continuity + denylist + agents + chips — listening on '+PORT));
