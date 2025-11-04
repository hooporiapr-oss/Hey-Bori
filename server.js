// Hey Bori — Mobile Only (full-screen), desktop gate with QR
// Zero deps, continuity kept, status checks included.

process.on('uncaughtException', e => console.error('[uncaughtException]', e?.stack || e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e?.stack || e));

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS_RAW = process.env.CSP_ANCESTORS || 'https://heybori.co https://www.heybori.co https://chat.heybori.co';

// ---------- CSP (frame-ancestors only) ----------
function buildFrameAncestors(raw) {
const cleaned = String(raw || '')
.replace(/[\r\n'"]/g, ' ')
.replace(/\s+/g, ' ')
.trim();
const list = cleaned.split(/[,\s]+/).filter(Boolean);
return 'frame-ancestors ' + (list.length ? list : ['https://heybori.co','https://chat.heybori.co']).join(' ');
}
const CSP_VALUE = buildFrameAncestors(FRAME_ANCESTORS_RAW);

// ---------- helpers ----------
function json(res, code, obj) {
const body = Buffer.from(JSON.stringify(obj));
res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});
res.end(body);
}
function text(res, code, s) {
const body = Buffer.from(String(s));
res.writeHead(code, {'Content-Type':'text/plain; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});
res.end(body);
}
function html(res, s) {
const body = Buffer.from(String(s));
res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});
res.end(body);
}
function setCommonHeaders(res, reqUrl) {
res.setHeader('Cache-Control','no-store,no-cache,must-revalidate,max-age=0');
res.setHeader('Pragma','no-cache'); res.setHeader('Expires','0');
res.setHeader('Content-Security-Policy', CSP_VALUE);
try {
const host = (reqUrl.host || '').toLowerCase();
if (host.endsWith('.onrender.com')) {
res.statusCode = 301;
res.setHeader('Location', 'https://' + FORCE_DOMAIN + (reqUrl.pathname || '/'));
return true;
}
} catch {}
return false;
}
function isMobileUA(ua='') {
ua = ua.toLowerCase();
return /iphone|ipod|ipad|android|mobile|silk|opera mini|blackberry|bb10|windows phone/.test(ua);
}

// ---------- OpenAI via https ----------
function callOpenAI(messages) {
return new Promise((resolve) => {
if (!process.env.OPENAI_API_KEY) {
return resolve('OpenAI key not set yet. Please try again soon.\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀');
}
const payload = JSON.stringify({ model: 'gpt-4o-mini', messages });
const req = https.request({
method: 'POST', hostname: 'api.openai.com', path: '/v1/chat/completions',
headers: {
'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
'Content-Type': 'application/json',
'Content-Length': Buffer.byteLength(payload)
},
timeout: 30000
}, (r) => {
let data = '';
r.setEncoding('utf8');
r.on('data', c => data += c);
r.on('end', () => {
try {
if (r.statusCode >= 200 && r.statusCode < 300) {
const j = JSON.parse(data);
const out = j?.choices?.[0]?.message?.content || 'No answer.';
resolve(out);
} else {
resolve('Model unavailable. Try again later.\n\n(detail: ' + String(data).slice(0,200) + ')');
}
} catch(e) {
resolve('Temporary error. Try again.\n(detail: ' + (e.message || e) + ')');
}
});
});
req.on('error', e => resolve('Network error. Try again.\n(detail: ' + (e.message || e) + ')'));
req.on('timeout', () => { req.destroy(); resolve('Timeout. Try again.'); });
req.write(payload); req.end();
});
}

// ---------- PAGES ----------
const DESKTOP_GATE = (origin) => (
'<!doctype html><meta charset="utf-8"/>' +
'<meta name="viewport" content="width=device-width, initial-scale=1"/>' +
'<title>Hey Bori — Mobile Only</title>' +
'<style>' +
'html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111}' +
'.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}' +
'.card{max-width:560px;width:100%;border:1px solid #eee;border-radius:16px;padding:22px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.06)}' +
'h1{margin:0 0 6px;font:800 22px/1.2 system-ui;color:#111}' +
'p{margin:0 0 12px;color:#555;font:500 14px/1.5 system-ui}' +
'.link{display:inline-block;margin-top:6px;font-weight:700;color:#0a3a78;text-decoration:none}' +
'.qr{margin-top:14px;border:1px solid #eee;border-radius:12px;overflow:hidden;width:220px;height:220px}' +
'</style>' +
'<div class="wrap"><div class="card">' +
'<h1>Hey Bori — Mobile Only</h1>' +
'<p>Open this on your phone to chat. Scan the QR or tap the link below.</p>' +
'<img class="qr" alt="QR to open on phone" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(origin + '/') + '"/>' +
'<p><a class="link" href="' + origin + '/">Open Hey Bori on mobile →</a></p>' +
'</div></div>'
);

const MOBILE_SHELL =
'<!doctype html><meta charset="utf-8"/>' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>' +
'<meta name="theme-color" content="#ffffff"/>' +
'<meta name="apple-mobile-web-app-capable" content="yes"/>' +
'<meta name="apple-mobile-web-app-status-bar-style" content="white"/>' +
'<link rel="manifest" href="/manifest.json">' +
'<title>Hey Bori</title>' +
'<style>' +
'html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111}' +
'.screen{height:100svh;height:100dvh;display:flex;flex-direction:column;background:#fff}' +
'.hdr{padding:16px 18px 8px}' +
'.t{margin:0 0 4px;font:800 20px/1.2 system-ui;color:#111}' +
'.s{margin:0;color:#666;font:500 13px/1.4 system-ui}' +
'.status{padding:6px 18px;font:600 12px/1;background:#f6f6f6;border-top:1px solid #eee;border-bottom:1px solid #eee;color:#333}' +
'.chat{flex:1 1 auto;min-height:0}' +
'iframe{width:100%;height:100%;border:0;background:#fff;display:block}' +
'</style>' +
'<section class="screen" id="hb">' +
' <header class="hdr"><h1 class="t">Hey Bori</h1><p class="s">Ask Me Anything — Español or English</p></header>' +
' <div class="status" id="hb-status">Checking connection…</div>' +
' <div class="chat"><iframe id="frame" src="/inner?v=mobile-only" title="Hey Bori Chat" aria-label="Hey Bori Chat" loading="eager" allow="clipboard-write" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
'</section>' +
'<script src="/app.js?v=mo"></script>';

const INNER_HTML =
'<!doctype html><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>' +
'<title>Hey Bori — App</title>' +
'<style>' +
':root{--line:#e6e6e6;--user:#eef4ff;--assistant:#f7f7f7}' +
'html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111}' +
'main{height:100%;display:flex;flex-direction:column}' +
'#messages{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px 14px}' +
'.row{display:flex;gap:10px;align-items:flex-start}.avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;flex:0 0 28px;border:1px solid var(--line)}' +
'.right{justify-content:flex-end}.right .avatar{background:#ff4455;color:#fff;border-color:#ffc2c5}' +
'.bubble{max-width:85%;border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff;white-space:pre-wrap;line-height:1.55}' +
'.user .bubble{background:var(--user);border-color:#d8e7ff}.assistant .bubble{background:var(--assistant)}' +
'.name{font-size:12px;font-weight:700;color:#333;margin-bottom:4px;letter-spacing:.2px}' +
'form{flex:0 0 auto;display:grid;grid-template-columns:1fr auto;gap:10px;border-top:1px solid var(--line);padding:12px 14px;background:#fff}' +
'textarea{width:100%;min-height:64px;resize:vertical;padding:12px;border:1px solid var(--line);border-radius:12px;font-size:16px}' +
'button{padding:12px 16px;border:1px solid #0c2a55;border-radius:12px;background:#0a3a78;color:#fff;cursor:pointer;font-weight:700}' +
'</style>' +
'<main><div id="messages"></div><form id="ask-form" autocomplete="off"><textarea id="q" placeholder="Haz tu pregunta… / Ask your question…" required></textarea><button id="send" type="submit">Send</button></form></main>' +
'<script src="/inner-app.js?v=mo"></script>';

// ---------- JS (outer: status + fit) ----------
const APP_JS =
'(()=>{const s=document.getElementById("hb-status"), sec=document.getElementById("hb");' +
'function setStatus(t){if(s) s.textContent=t}' +
'async function ping(){try{const r=await fetch("/api/ping");const j=await r.json();return j&&j.ok===true}catch(e){return false}}' +
'function fit(){if(!sec) return; const vv=window.visualViewport; const h=(vv&&vv.height)||window.innerHeight; sec.style.height=Math.round(h)+"px"}' +
'fit(); window.addEventListener("resize",fit); window.addEventListener("orientationchange",fit); if(window.visualViewport) window.visualViewport.addEventListener("resize",fit);' +
'(async()=>{ setStatus("Checking connection…"); const ok=await ping(); setStatus(ok? "Connected. You can chat.":"Cannot reach server. Pull to refresh and try again."); })();' +
'})();';

// ---------- JS (inner: chat logic with continuity + mobile-safe storage) ----------
const INNER_JS =
'console.log("[Hey Bori] inner app loaded"); (function(){window.__bori_mem=window.__bori_mem||[]})();' +
'var KEY="bori_chat_transcript_v1"; function canStore(){try{var t="__t"+Date.now();localStorage.setItem(t,"1");localStorage.removeItem(t);return true}catch(e){return false}}' +
'var HAS_LS=canStore(); function load(){if(HAS_LS){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){}}return (window.__bori_mem||[])}' +
'function save(t){if(HAS_LS){try{localStorage.setItem(KEY,JSON.stringify(t));return}catch(e){}}window.__bori_mem=t}' +
'var els={list:document.getElementById("messages"),form:document.getElementById("ask-form"),q:document.getElementById("q"),send:document.getElementById("send")};' +
'function when(ts){return new Date(ts||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}' +
'function escapeHTML(s){return String(s||"").replace(/[&<>\"\\\']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\\\'":"&#39;"}[m]})}' +
'function md(s){s=escapeHTML(String(s||"")); s=s.replace(/\\*\\*(.+?)\\*\\*/g,"<strong>$1</strong>"); s=s.replace(/\\*(.+?)\\*/g,"<em>$1</em>"); s=s.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,"<a href=\\"$2\\" target=\\"_blank\\" rel=\\"noopener noreferrer\\">$1</a>"); s=s.replace(/^(?:- |\\* )(.*)$/gm,"<li>$1</li>"); s=s.replace(/(<li>[\\s\\S]*?<\\/li>)/g,"<ul>$1<\\/ul>"); s=s.replace(/\\n{2,}/g,"</p><p>").replace(/\\n/g,"<br>"); return "<p>"+s+"</p>"}' +
'function bubble(role,content,ts){var isUser=role==="user";var who=isUser?"Coach":"Hey Bori";var init=isUser?"C":"B";return "<div class=\\"row "+(isUser?"right user":"assistant")+"\\"><div class=\\"avatar\\">"+init+"</div><div><div class=\\"name\\">"+who+" · "+when(ts)+"</div><div class=\\"bubble\\">"+md(content)+"</div></div></div>"}' +
'function render(scrollEnd){var t=load();els.list.innerHTML=t.map(function(m){return bubble(m.role,m.content,m.ts)}).join("");if(scrollEnd)els.list.scrollTop=els.list.scrollHeight}' +
'async function askBackend(question){var history=load().slice(-12);var r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:question,history:history})});var j=await r.json().catch(function(){return{answer:"Error"}});return j.answer||"No answer."}' +
'els.form.addEventListener("submit",async function(e){e.preventDefault();var q=els.q.value.trim();if(!q)return;els.q.value="";var t=load();t.push({role:"user",content:q,ts:Date.now()});save(t);render(true);els.send.disabled=true;try{var a=await askBackend(q);var t2=load();t2.push({role:"assistant",content:a,ts:Date.now()});save(t2);render(true)}catch(err){var t3=load();t3.push({role:"assistant",content:"(network) "+(err&&err.message||err),ts:Date.now()});save(t3);render(true)}finally{els.send.disabled=false;els.q.focus()}});' +
'render(true);';

// ---------- manifest & SW (optional PWA install) ----------
const MANIFEST = JSON.stringify({
name: "Hey Bori",
short_name: "Hey Bori",
start_url: "/",
display: "standalone",
background_color: "#ffffff",
theme_color: "#ffffff",
icons: [] // provide icons later if you want
});

// ---------- server ----------
const server = http.createServer((req, res) => {
try {
const reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
if (setCommonHeaders(res, reqUrl)) { res.end(); return; }

const ua = req.headers['user-agent'] || '';
const origin = 'https://' + (req.headers.host || FORCE_DOMAIN);

// health / ping
if (req.method === 'GET' && reqUrl.pathname === '/healthz') return text(res, 200, 'ok');
if (req.method === 'GET' && reqUrl.pathname === '/api/ping') return json(res, 200, { ok: true, ts: Date.now() });

// manifest
if (req.method === 'GET' && reqUrl.pathname === '/manifest.json') {
res.writeHead(200, {'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'no-store'});
return res.end(MANIFEST);
}

// desktop gate vs mobile experience
if (req.method === 'GET' && reqUrl.pathname === '/') {
if (isMobileUA(ua)) return html(res, MOBILE_SHELL);
return html(res, DESKTOP_GATE(origin));
}

// outer shell JS
if (req.method === 'GET' && reqUrl.pathname === '/app.js') {
res.writeHead(200, {'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});
return res.end(Buffer.from(APP_JS));
}

// inner app (iframe)
if (req.method === 'GET' && reqUrl.pathname === '/inner') return html(res, INNER_HTML);
if (req.method === 'GET' && reqUrl.pathname === '/inner-app.js') {
res.writeHead(200, {'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});
return res.end(Buffer.from(INNER_JS));
}

// chat endpoint (continuity + de-dupe)
if (req.method === 'POST' && reqUrl.pathname === '/api/ask') {
let body = '';
req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
req.on('end', async () => {
try {
const j = JSON.parse(body || '{}');
const q = (j.question || '').toString().slice(0, 4000);

const hist = Array.isArray(j.history) ? j.history : [];
const mapped = hist.map(m => ({
role: (m && m.role) === 'assistant' ? 'assistant' : 'user',
content: ((m && m.content) || '').toString().slice(0, 2000)
})).filter(m => m.content);

const trimmed = mapped.slice(-12);
const last = trimmed[trimmed.length - 1];
const shouldAppendQ = !(last && last.role === 'user' && last.content === q);

const messages = [
{ role: 'system', content: 'ES/EN: Begin with a short ES/EN note. Spanish first, then English. Use the entire previous conversation as context. Keep replies tight, readable, and friendly. Use short paragraphs and bullets when helpful. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.' },
...trimmed,
...(shouldAppendQ ? [{ role: 'user', content: q }] : [])
];

const answer = await callOpenAI(messages);
return json(res, 200, { answer });
} catch (e) {
return json(res, 200, { answer: 'Temporary error. Try again.\n(detail: ' + (e.message || e) + ')' });
}
});
return;
}

text(res, 404, 'Not Found');
} catch (e) {
console.error('Server error:', e?.stack || e);
text(res, 500, 'Internal Server Error');
}
});

server.listen(Number(PORT), () => {
console.log('✅ Hey Bori (mobile-only) listening on ' + PORT);
});
