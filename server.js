// Hey Bori — STABLE (Single-Turn): ES first → EN, no history, minimal + robust
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
function text(res, code, s) { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(String(s)); }
function html(res, s) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(s); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }

// ---------- health ----------
const startedAt = new Date().toISOString();
function health(res) {
json(res, 200, { ok: true, startedAt, node: process.version });
}

// ---------- OpenAI (single-turn) ----------
function callOpenAI(question, lang) {
return new Promise(resolve => {
if (!process.env.OPENAI_API_KEY) {
return resolve('Falta la clave de API / Missing API key.\n— Bori Labs LLC — Let’s Go Pa’lante 🏀');
}
const systemPrompt =
(lang === 'en')
? 'Respond ONLY in English. Be concise and helpful. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'
: 'Responde primero en Español (PR) y luego repite en Inglés. Sé claro y útil. Termina con “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.';

const body = JSON.stringify({
model: 'gpt-4o-mini',
temperature: 0.3,
messages: [
{ role: 'system', content: systemPrompt },
{ role: 'user', content: String(question || '').slice(0, 4000) }
]
});

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

// ---------- UI (single file) ----------
const PAGE =
'<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
'<title>Hey Bori — Stable</title>' +
'<style>' +
'html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;overflow:hidden}' +
'header{padding:14px 16px;border-bottom:1px solid #eee}' +
'h1{margin:0;font:800 20px/1.2 system-ui} .sub{margin:4px 0 0;color:#666;font:500 13px/1.4 system-ui}' +
'#messages{position:absolute;top:74px;bottom:78px;left:0;right:0;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}' +
'.row{display:flex;gap:10px;align-items:flex-start}' +
'.avatar{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;border:1px solid #e6e6e6}' +
'.right{justify-content:flex-end}.right .avatar{background:#0a3a78;color:#fff;border-color:#b2c8ff}' +
'.bubble{max-width:85%;border:1px solid #e6e6e6;border-radius:12px;padding:10px 12px;background:#fff;white-space:pre-wrap;line-height:1.55}' +
'.user .bubble{background:#eef4ff;border-color:#d8e7ff}.assistant .bubble{background:#f7f7f7}' +
'.meta{font-size:11px;color:#555;margin-bottom:3px}' +
'form{position:fixed;bottom:0;left:0;right:0;display:grid;grid-template-columns:1fr auto auto;gap:10px;border-top:1px solid #eee;padding:10px 14px;background:#fff;box-shadow:0 -3px 8px rgba(0,0,0,.04)}' +
'textarea{width:100%;min-height:56px;resize:none;padding:12px;border:1px solid #ddd;border-radius:12px;font-size:16px;line-height:1.4}' +
'button{padding:12px 16px;border-radius:12px;border:1px solid #0c2a55;background:#0a3a78;color:#fff;font-weight:700;cursor:pointer}' +
'#clear{background:#ff4d4d;border-color:#ff4d4d} #clear:hover{background:#e63e3e}' +
'#send{background:#0a3a78} #send:disabled{opacity:.6;cursor:default}' +
'#err{display:none;position:fixed;top:0;left:0;right:0;background:#ffefef;color:#a40000;border-bottom:1px solid #e5bcbc;padding:8px 12px;z-index:9999;font-size:13px;white-space:pre-wrap}' +
'</style>' +
'<div id=err></div>' +
'<header><h1>Hey Bori</h1><p class=sub>Ask your question — Spanish first, then English (single-turn)</p></header>' +
'<div id=messages></div>' +
'<form id=ask autocomplete=off>' +
'<textarea id=q placeholder="Ask your question to start/continue in ES and EN." required></textarea>' +
'<button id=send type=submit>Send</button>' +
'<button id=clear type=button>Clear</button>' +
'</form>' +
'<script>' +
'window.addEventListener("error",function(e){var b=document.getElementById("err");b.textContent="[JS] "+(e.message||"error");b.style.display="block";});' +
'var els={list:document.getElementById("messages"),form:document.getElementById("ask"),q:document.getElementById("q"),send:document.getElementById("send"),clear:document.getElementById("clear")};' +
'function when(t){return new Date(t||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}' +
'function esc(s){return String(s).replace(/[&<>\"\\\']/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\\\'":"&#39;"}[m]})}' +
'function bubble(role,content,ts){var u=role==="user";var who=u?"Coach":"Hey Bori";var i=u?"C":"B";return "<div class=\\"row "+(u?"right user":"assistant")+"\\"><div class=avatar>"+i+"</div><div><div class=meta>"+who+" · "+when(ts)+"</div><div class=bubble>"+esc(content)+"</div></div></div>"}' +
'function renderOne(role,content){els.list.insertAdjacentHTML("beforeend",bubble(role,content,Date.now()));els.list.scrollTop=els.list.scrollHeight;}' +
'async function askOne(q){var r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:q,lang:"es"})});var j=await r.json().catch(function(){return{answer:"Error"}});return j.answer||"No answer."}' +
'els.form.addEventListener("submit",async function(e){e.preventDefault();var q=els.q.value.trim();if(!q)return;els.q.value="";renderOne("user",q);els.send.disabled=true;try{var a=await askOne(q);renderOne("assistant",a);}catch(err){renderOne("assistant","(network) "+(err&&err.message||err));}finally{els.send.disabled=false;els.q.focus();}});' +
'els.clear.addEventListener("click",function(){els.list.innerHTML="";});' +
'</script>';

// ---------- server ----------
const server = http.createServer((req, res) => {
try {
const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
if (setCommonHeaders(res, u)) { res.end(); return; }

if (req.method === 'GET' && u.pathname === '/health') return health(res);
if (req.method === 'GET' && u.pathname === '/') return html(res, PAGE);

if (req.method === 'POST' && u.pathname === '/api/ask') {
let body = '';
req.on('data', c => (body += c));
req.on('end', async () => {
try {
const j = JSON.parse(body || '{}');
const q = (j.question || '').toString();
const lang = (j.lang || 'es').toLowerCase();
const a = await callOpenAI(q, lang);
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
console.log('✅ Hey Bori — Stable single-turn listening on ' + PORT)
);
