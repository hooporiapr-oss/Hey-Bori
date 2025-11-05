// Hey Bori — Mobile chat (continuity ON, ES→EN), pinned input, labeled buttons
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

// ---------- headers / CSP ----------
function buildFrameAncestors(raw) {
const c = String(raw || '').replace(/[\r\n'"]/g, ' ').replace(/\s+/g, ' ').trim();
const list = c.split(/[,\s]+/).filter(Boolean);
return 'frame-ancestors ' + (list.length ? list : ['https://heybori.co', 'https://chat.heybori.co']).join(' ');
}
const CSP_VALUE = buildFrameAncestors(FRAME_ANCESTORS_RAW);
function setCommonHeaders(res, u) {
res.setHeader('Cache-Control', 'no-store');
res.setHeader('Content-Security-Policy', CSP_VALUE);
const host = (u.host || '').toLowerCase();
if (host.endsWith('.onrender.com')) {
res.statusCode = 301;
res.setHeader('Location', 'https://' + FORCE_DOMAIN + (u.pathname || '/') + (u.search || ''));
return true;
}
return false;
}
function text(res, code, s) {
res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
res.end(String(s));
}
function html(res, s) {
res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(s);
}
function json(res, code, obj) {
res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
res.end(JSON.stringify(obj));
}

// ---------- simple rate limit ----------
const BUCKET = new Map();
function rateOK(ip) {
const now = Date.now();
const b = BUCKET.get(ip) || { n: 0, t: now };
if (now - b.t > 60000) { b.n = 0; b.t = now; }
b.n++;
BUCKET.set(ip, b);
return b.n <= 30;
}

// ---------- OpenAI call ----------
function callOpenAI(messages) {
return new Promise(resolve => {
if (!process.env.OPENAI_API_KEY)
return resolve('Falta la clave de API / Missing API key.\n— Bori Labs LLC — Let’s Go Pa’lante 🏀');

const body = JSON.stringify({ model: 'gpt-4o-mini', messages });
const req = https.request(
{
method: 'POST',
hostname: 'api.openai.com',
path: '/v1/chat/completions',
headers: {
Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
'Content-Type': 'application/json',
'Content-Length': Buffer.byteLength(body)
},
timeout: 30000
},
r => {
let d = '';
r.setEncoding('utf8');
r.on('data', c => (d += c));
r.on('end', () => {
try {
const j = JSON.parse(d);
const out = j?.choices?.[0]?.message?.content || 'Error temporal — intenta otra vez.';
resolve(out);
} catch (e) {
resolve('Error temporal — ' + e.message);
}
});
}
);
req.on('error', e => resolve('Error de red — ' + e.message));
req.on('timeout', () => { req.destroy(); resolve('Tiempo de espera agotado'); });
req.write(body); req.end();
});
}

// ---------- shells ----------
function mobileShellHTML(lang) {
return (
'<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
'<title>Hey Bori</title><style>' +
'html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111}' +
'.screen{height:100svh;height:100dvh;display:flex;flex-direction:column;background:#fff}' +
'.hdr{padding:16px 18px 8px}.t{margin:0 0 4px;font:800 20px/1.2 system-ui}.s{margin:0;color:#666;font:500 13px/1.4 system-ui}' +
'.chat{flex:1 1 auto;min-height:0}iframe{width:100%;height:100%;border:0;background:#fff;display:block}' +
'</style><section class=screen><header class=hdr>' +
'<h1 class=t>Hey Bori</h1><p class=s>Haz tu Pregunta para Comenzar/Continuar — Español o | English - Ask Me Anything to Get Started/Continue</p>' +
'</header><div class=chat><iframe src="/inner?lang=' + encodeURIComponent(lang) + '" title="Hey Bori Chat" loading=eager></iframe></div></section>'
);
}

const INNER_HTML =
'<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">' +
'<title>Hey Bori</title><style>' +
':root{--line:#e6e6e6;--user:#eef4ff;--assistant:#f7f7f7}' +
'html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;overflow:hidden}' +
'main{position:relative;height:100%;display:flex;flex-direction:column;background:#fff}' +
'#messages{flex:1 1 auto;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:16px 14px 100px 14px;scroll-behavior:smooth}' +
'.row{display:flex;gap:10px;align-items:flex-start}' +
'.avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;flex:0 0 28px;border:1px solid var(--line)}' +
'.right{justify-content:flex-end}.right .avatar{background:#0a3a78;color:#fff;border-color:#b2c8ff}' +
'.bubble{max-width:85%;border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff;white-space:pre-wrap;line-height:1.55}' +
'.user .bubble{background:var(--user);border-color:#d8e7ff}.assistant .bubble{background:var(--assistant)}' +
'.name{font-size:12px;font-weight:700;color:#333;margin-bottom:4px;letter-spacing:.2px}' +
'#toolbar{position:absolute;top:10px;right:14px;display:flex;gap:8px;z-index:30}' +
'#toolbar button{font-size:13px;padding:6px 10px;border:1px solid #0c2a55;border-radius:8px;cursor:pointer;font-weight:600}' +
'#copyLast{background:#ffffff;color:#0c2a55}' +
'#copyLast:hover{background:#e6f0ff}' +
'#clearChat{background:#ff4d4d;color:#fff;border-color:#ff4d4d}' +
'#clearChat:hover{background:#e63e3e}' +
'form{position:fixed;bottom:0;left:0;right:0;z-index:20;display:grid;grid-template-columns:1fr auto;gap:10px;border-top:1px solid var(--line);padding:10px 14px;background:#fff;box-shadow:0 -3px 8px rgba(0,0,0,0.04)}' +
'textarea{width:100%;min-height:56px;resize:none;padding:12px;border:1px solid var(--line);border-radius:12px;font-size:16px;line-height:1.4}' +
'button{padding:12px 16px;border:1px solid #0c2a55;border-radius:12px;background:#0a3a78;color:#fff;cursor:pointer;font-weight:700}' +
'button:disabled{opacity:0.6;cursor:default}' +
'</style><main>' +
'<div id=messages></div>' +
'<div id=toolbar><button id=copyLast title="Copy last response">Copy Last</button><button id=clearChat title="Clear chat history">Clear Chat</button></div>' +
'<form id=ask-form autocomplete=off><textarea id=q placeholder="Comenzar.-Continuar… / Start.-Continue…" required></textarea><button id=send type=submit>Send</button></form>' +
'</main><script>' +
// --- state & elements ---
'var LANG=(new URLSearchParams(location.search).get("lang")||"es").toLowerCase();' +
'var KEY="bori_chat_v6";' +
'function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}}' +
'function save(t){try{localStorage.setItem(KEY,JSON.stringify(t))}catch(e){}}' +
'var els={list:document.getElementById("messages"),form:document.getElementById("ask-form"),q:document.getElementById("q"),send:document.getElementById("send"),copyBtn:document.getElementById("copyLast"),clearBtn:document.getElementById("clearChat")};' +
// --- render helpers ---
'function when(t){return new Date(t||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}' +
'function esc(s){return String(s).replace(/[&<>"\\\']/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\\\'":"&#39;"}[m]})}' +
'function md(s){s=esc(s);s=s.replace(/\\*\\*(.+?)\\*\\*/g,"<strong>$1</strong>").replace(/\\*(.+?)\\*/g,"<em>$1</em>").replace(/\\n/g,"<br>");return "<p>"+s+"</p>"}' +
'function bubble(r,c,t){var u=r==="user";var n=u?"Coach":"Hey Bori";var i=u?"C":"B";return "<div class=\\"row "+(u?"right user":"assistant")+"\\"><div class=avatar>"+i+"</div><div><div class=name>"+n+" · "+when(t)+"</div><div class=bubble>"+md(c)+"</div></div></div>"}' +
'function render(end){var t=load();els.list.innerHTML=t.map(function(m){return bubble(m.role,m.content,m.ts)}).join("");if(end)els.list.scrollTop=els.list.scrollHeight}' +
// --- API call (always send history for continuity) ---
'async function askServer(question){var history=load().map(function(m){return{role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,2000)}});' +
'var r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:question,history:history,lang:LANG})});' +
'var j=await r.json().catch(function(){return{answer:"Error"}});return j.answer||"No answer."}' +
// --- typing effect ---
'function typeWriter(t){var o="",i=0,step=Math.max(2,Math.floor(t.length/200));(function tick(){o+=t.slice(i,i+step);i+=step;var a=load();a[a.length-1]={role:"assistant",content:o,ts:Date.now()};save(a);render(true);if(i<t.length)setTimeout(tick,18);})();}' +
// --- send handler ---
'els.form.addEventListener("submit",async function(e){e.preventDefault();var q=els.q.value.trim();if(!q)return;els.q.value="";var t=load();t.push({role:"user",content:q,ts:Date.now()});save(t);render(true);els.send.disabled=true;try{var a=await askServer(q);var t2=load();t2.push({role:"assistant",content:"",ts:Date.now()});save(t2);render(true);typeWriter(a)}catch(err){var t3=load();t3.push({role:"assistant",content:"(network) "+(err&&err.message||err),ts:Date.now()});save(t3);render(true)}finally{els.send.disabled=false;els.q.focus()}});' +
// --- toolbar: clear/copy ---
'els.clearBtn.addEventListener("click",function(){localStorage.removeItem(KEY);render(true);alert("Chat cleared ✅")});' +
'els.copyBtn.addEventListener("click",async function(){try{var t=load();for(var i=t.length-1;i>=0;i--){if(t[i].role==="assistant"){var tmp=document.createElement("div");tmp.innerHTML=md(t[i].content);var txt=tmp.textContent||tmp.innerText||"";await navigator.clipboard.writeText(txt);alert("Copied ✅");return}}alert("Nothing to copy")}catch(e){alert("Copy failed")}});' +
// --- first paint ---
'render(true);' +
'</script>';

// ---------- server (no deps) ----------
const server = http.createServer((req, res) => {
try {
const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
if (setCommonHeaders(res, u)) { res.end(); return; }

// root: mobile shell (default lang=es)
if (req.method === 'GET' && u.pathname === '/') {
const lang = (u.searchParams.get('lang') || 'es').toLowerCase();
return html(res, mobileShellHTML(lang));
}

if (req.method === 'GET' && u.pathname === '/inner') {
return html(res, INNER_HTML);
}

if (req.method === 'POST' && u.pathname === '/api/ask') {
// rate limit
const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '0';
if (!rateOK(ip)) return json(res, 429, { answer: 'Límite de uso — intenta en un minuto.' });

// read body
let body = '';
req.on('data', c => (body += c));
req.on('end', async () => {
try {
const j = JSON.parse(body || '{}');
const q = (j.question || '').toString().slice(0, 4000);
const lang = (j.lang || 'es').toLowerCase();
const hist = Array.isArray(j.history) ? j.history : [];

// system prompt: ES first → EN, use full context
const systemPrompt =
lang === 'en'
? 'Respond ONLY in English. Use full conversation context. Be concise and helpful. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'
: 'Responde SIEMPRE en dos partes: 1) Español (PR) primero, 2) Inglés después. Usa todo el contexto previo. Sé claro, breve y útil. Termina con “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.';

const msgs = [
{ role: 'system', content: systemPrompt },
...hist.map(m => ({
role: m && m.role === 'assistant' ? 'assistant' : 'user',
content: ((m && m.content) || '').toString().slice(0, 2000)
})),
{ role: 'user', content: q }
].slice(-30); // keep final context bounded

const a = await callOpenAI(msgs);
return json(res, 200, { answer: a });
} catch (e) {
return json(res, 200, { answer: 'Error — ' + e.message });
}
});
return;
}

text(res, 404, 'Not Found');
} catch (e) {
text(res, 500, 'Internal Server Error');
}
});

server.listen(Number(PORT), () =>
console.log('✅ Hey Bori (continuity fixed) listening on ' + PORT)
