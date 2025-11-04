// Hey Bori — Core HTTPS (Base64 UI, zero deps)

process.on('uncaughtException', e => console.error('[uncaughtException]', e?.stack || e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e?.stack || e));

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS_RAW = process.env.CSP_ANCESTORS || 'https://heybori.co https://www.heybori.co https://chat.heybori.co';

// ---------- CSP ----------
function buildFrameAncestors(raw) {
const cleaned = String(raw || '')
.replace(/[\r\n'"]/g, ' ')
.replace(/\s+/g, ' ')
.trim();
const list = cleaned.split(/[,\s]+/).filter(Boolean);
return 'frame-ancestors ' + (list.length ? list : ['https://heybori.co','https://chat.heybori.co']).join(' ');
}
const CSP_VALUE = buildFrameAncestors(FRAME_ANCESTORS_RAW);
console.log('CSP →', CSP_VALUE);

// ---------- helpers ----------
function json(res, code, obj) {
const body = Buffer.from(JSON.stringify(obj));
res.writeHead(code, {
'Content-Type': 'application/json; charset=utf-8',
'Content-Length': body.length,
'Cache-Control': 'no-store'
});
res.end(body);
}
function text(res, code, s) {
const body = Buffer.from(String(s));
res.writeHead(code, {
'Content-Type': 'text/plain; charset=utf-8',
'Content-Length': body.length,
'Cache-Control': 'no-store'
});
res.end(body);
}
function setCommonHeaders(res, reqUrl) {
res.setHeader('Cache-Control','no-store,no-cache,must-revalidate,max-age=0');
res.setHeader('Pragma','no-cache');
res.setHeader('Expires','0');
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

// ---------- OpenAI via https ----------
function callOpenAI(messages) {
return new Promise((resolve) => {
if (!process.env.OPENAI_API_KEY) {
return resolve('OpenAI key not set yet. Please try again soon.\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀');
}
const payload = JSON.stringify({ model: 'gpt-4o-mini', messages });

const req = https.request({
method: 'POST',
hostname: 'api.openai.com',
path: '/v1/chat/completions',
headers: {
'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
'Content-Type': 'application/json',
'Content-Length': Buffer.byteLength(payload)
},
timeout: 30000
}, (r) => {
let data = '';
r.setEncoding('utf8');
r.on('data', chunk => { data += chunk; });
r.on('end', () => {
try {
if (r.statusCode >= 200 && r.statusCode < 300) {
const j = JSON.parse(data);
const out = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || 'No answer.';
resolve(out);
} else {
resolve('Model unavailable. Try again later.\n\n(detail: ' + String(data).slice(0,200) + ')');
}
} catch (e) {
resolve('Temporary error. Try again.\n(detail: ' + (e.message || e) + ')');
}
});
});

req.on('error', (e) => resolve('Network error. Try again.\n(detail: ' + (e.message || e) + ')'));
req.on('timeout', () => { req.destroy(); resolve('Timeout. Try again.'); });
req.write(payload);
req.end();
});
}

// ---------- HTML UI (Base64 encoded to avoid parser issues) ----------
const HTML_B64 = Buffer.from(`<!doctype html>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<title>La Voz de Puerto Rico — Hey Bori</title>
<style>
:root{--blue:#0a3a78;--red:#d61e2b;--bg:#f7f8fb;--panel:#fff;--line:#e6e6e6;--shadow:0 10px 30px rgba(0,0,0,.06);--ink:#1b1b1b;--muted:#60646c;--user:#eef4ff;--assistant:#f7f7f7;--radius:16px;--max:900px;}
html,body{margin:0;height:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);}
header{background:linear-gradient(90deg,var(--blue),#0f4fa8);color:#fff;padding:22px 20px;box-shadow:var(--shadow);}
.brand{max-width:var(--max);margin:0 auto;display:flex;align-items:center;gap:12px;}
.logo{width:28px;height:28px;display:grid;place-items:center;background:#fff;border-radius:8px;color:#d61e2b;font-weight:800;}
.title{font-weight:800;letter-spacing:.2px;}
.subtitle{opacity:.9;font-size:14px;}
main{width:100%;margin:0 auto;padding:0 0 120px;max-width:var(--max);}
#messages{width:100%;height:70vh;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:20px 18px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:var(--shadow);}
.row{display:flex;gap:10px;align-items:flex-start}
.avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;flex:0 0 28px;border:1px solid var(--line);background:#fff;color:#0a3a78;}
.right{justify-content:flex-end}
.right .avatar{background:#ff4455;color:#fff;border-color:#ffc2c5}
.bubble{max-width:75%;border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff;white-space:pre-wrap;line-height:1.55;}
.user .bubble{background:var(--user);border-color:#d8e7ff}
.assistant .bubble{background:var(--assistant)}
.name{font-size:12px;font-weight:700;color:#333;margin-bottom:4px;letter-spacing:.2px}
form{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px;box-shadow:0 -6px 16px rgba(0,0,0,.04)}
.bar{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:1fr auto;gap:10px}
textarea{width:100%;min-height:64px;resize:vertical;padding:12px;border:1px solid var(--line);border-radius:12px;font-size:16px}
button{padding:12px 16px;border:1px solid #0c2a55;border-radius:12px;background:#0a3a78;color:#fff;cursor:pointer;font-weight:700}
footer{text-align:center;padding:18px;color:#60646c;border-top:1px solid var(--line)}
@media (max-width:560px){main{max-width:100%;padding:0 0 100px}#messages{border:none;border-radius:0;box-shadow:none;height:75vh;padding:16px 14px}.bubble{max-width:92%}}
</style>
<header><div class="brand"><div class="logo">HB</div><div><div class="title">La Voz de Puerto Rico — Hey Bori</div><div class="subtitle">Ask Me Anything — Español or English</div></div></div></header>
<main><div id="messages"></div></main>
<form id="ask-form" class="bar" autocomplete="off">
<textarea id="q" placeholder="Haz tu pregunta… / Ask your question…" required></textarea>
<button id="send" type="submit">Send</button>
</form>
<footer>© Bori Labs LLC — Let’s Go Pa’lante 🏀 • Build: core-https-b64</footer>
<script>
var KEY='bori_chat_transcript_v1';
var els={list:document.getElementById('messages'),form:document.getElementById('ask-form'),q:document.getElementById('q'),send:document.getElementById('send')};
function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}}
function save(t){localStorage.setItem(KEY,JSON.stringify(t))}
function when(ts){return new Date(ts||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
function escapeHTML(s){return String(s||'').replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\\'' : '&#39;'}[m]})}
function md(s){s=escapeHTML(String(s||''));
s=s.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
s=s.replace(/\\*(.+?)\\*/g,'<em>$1</em>');
s=s.replace(/\$begin:math:display$([^\\$end:math:display$]+)\\]\$begin:math:text$(https?:\\\\/\\\\/[^\\\\s)]+)\\$end:math:text$/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
s=s.replace(/^(?:- |\\* )(.*)$/gm,'<li>$1</li>');
s=s.replace(/(<li>[\\s\\S]*?<\\/li>)/g,'<ul>$1<\\/ul>');
s=s.replace(/\\n{2,}/g,'</p><p>').replace(/\\n/g,'<br>');
return '<p>'+s+'</p>'}
function bubble(role, content, ts){
var isUser = role==='user'; var who=isUser?'Coach':'Hey Bori'; var init=isUser?'C':'B';
return '<div class="row '+(isUser?'right user':'assistant')+'"><div class="avatar">'+init+'</div><div><div class="name">'+who+' · '+when(ts)+'</div><div class="bubble">'+md(content)+'</div></div></div>'}
function render(scrollEnd){var t=load(); els.list.innerHTML=t.map(function(m){return bubble(m.role,m.content,m.ts)}).join(''); if(scrollEnd) els.list.scrollTop=els.list.scrollHeight}
async function askBackend(question){
var history = load().slice(-12);
var r = await fetch('/api/ask',{ method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ question:question, history:history })});
var j = await r.json().catch(function(){return {answer:'Error'}});
return j.answer || 'No answer.'}
els.form.addEventListener('submit', async function(e){
e.preventDefault();
var q=els.q.value.trim(); if(!q) return; els.q.value=''; els.q.style.height='auto';
var t=load(); t.push({role:'user',content:q,ts:Date.now()}); save(t); render(true);
els.send.disabled=true;
try{
var answer=await askBackend(q);
var t2=load(); t2.push({role:'assistant',content:answer,ts:Date.now()}); save(t2); render(true);
}catch(err){
var t3=load(); t3.push({role:'assistant',content:'Error: '+(err&&err.message||err),ts:Date.now()}); save(t3); render(true);
}finally{ els.send.disabled=false; els.q.focus(); }
});
render(true);
</script>
`, 'utf8').toString('base64');

function html() {
return Buffer.from(HTML_B64, 'base64').toString('utf8');
}

// ---------- server ----------
const server = http.createServer((req, res) => {
try {
const reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
if (setCommonHeaders(res, reqUrl)) { res.end(); return; }

if (req.method === 'GET' && reqUrl.pathname === '/healthz') return text(res, 200, 'ok');

if (req.method === 'GET' && reqUrl.pathname === '/') {
const page = html();
res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
return res.end(page);
}

if (req.method === 'POST' && reqUrl.pathname === '/api/ask') {
let body = '';
req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
req.on('end', async () => {
try {
const j = JSON.parse(body || '{}');
const q = (j.question || '').toString().slice(0,4000);
const hist = Array.isArray(j.history) ? j.history : [];
const mapped = hist.slice(-12).map(m => ({
role: m && m.role === 'assistant' ? 'assistant' : 'user',
content: (m && m.content || '').toString().slice(0,2000)
}));
const messages = [
{ role: 'system', content: 'ES/EN: Begin with a short ES/EN note. Spanish first, then English. Keep replies tight, readable, and friendly. Use short paragraphs and bullets when helpful. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.' },
...mapped,
{ role: 'user', content: q }
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
console.log('✅ Hey Bori (core-https-b64) listening on ' + PORT);
});
