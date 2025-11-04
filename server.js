// server.js — Bori Chat (La Voz de Puerto Rico themed UI) + safe CSP + history context
const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS_RAW = process.env.CSP_ANCESTORS || 'https://heybori.co https://chat.heybori.co';
const UI_TAG = process.env.UI_TAG || 'voz-pr-v1';

// ----- Helper to sanitize CSP -----
function buildFrameAncestors(raw) {
const cleaned = String(raw || '')
.replace(/[\r\n'"]/g, ' ')
.replace(/\s+/g, ' ')
.trim();
const parts = cleaned
.split(/[,\s]+/)
.map(s => s.replace(/[^\x20-\x7E]/g, ''))
.filter(Boolean);
const defaults = ['https://heybori.co', 'https://chat.heybori.co'];
return `frame-ancestors ${(parts.length ? parts : defaults).join(' ')}`;
}
const CSP_VALUE = buildFrameAncestors(FRAME_ANCESTORS_RAW);
console.log('CSP →', CSP_VALUE);

app.set('trust proxy', true);
app.set('etag', false);

// No-cache
app.use((req, res, next) => {
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
res.setHeader('Pragma', 'no-cache');
res.setHeader('Expires', '0');
next();
});

// Safe CSP header
app.use((req, res, next) => {
try { res.setHeader('Content-Security-Policy', CSP_VALUE); }
catch (e) { console.error('CSP header error:', e); }
next();
});

// 301 redirect *.onrender.com → custom domain
app.use((req, res, next) => {
const host = (req.headers.host || '').toLowerCase();
if (host.endsWith('.onrender.com')) {
return res.redirect(301, `https://${FORCE_DOMAIN}${req.originalUrl || '/'}`);
}
next();
});

app.use(express.json());

// ---------- API with history context ----------
app.post('/api/ask', async (req, res) => {
const q = (req.body?.question || '').toString().slice(0, 4000);
const hist = Array.isArray(req.body?.history) ? req.body.history : [];

// Map last 12 messages into OpenAI format (balanced context)
const mappedHistory = hist.slice(-12).map(m => ({
role: m.role === 'assistant' ? 'assistant' : 'user',
content: (m.content || '').toString().slice(0, 2000)
}));

if (!process.env.OPENAI_API_KEY) {
return res.json({
answer:
'OpenAI key not set yet. Please try again soon.\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀'
});
}

try {
const r = await fetch('https://api.openai.com/v1/chat/completions', {
method: 'POST',
headers: {
'content-type': 'application/json',
'authorization': `Bearer ${process.env.OPENAI_API_KEY}`
},
body: JSON.stringify({
model: 'gpt-4o-mini',
messages: [
{
role: 'system',
content:
'ES/EN: Start every reply with a short ES/EN note, answer in Spanish first, then English, and end with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”. Keep answers concise unless asked for detail.'
},
...mappedHistory,
{ role: 'user', content: q }
]
})
});

if (!r.ok) {
const detail = await r.text().catch(() => '');
return res.json({
answer: `The model is unavailable right now. Try again later.\n\n(detail: ${detail.slice(0, 200)})\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀`
});
}

const data = await r.json();
const answer = data?.choices?.[0]?.message?.content || 'No answer.';
return res.json({ answer });
} catch (e) {
return res.json({
answer: `Temporary error. Please try again.\n(detail: ${String(e?.message || e)})\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀`
});
}
});

// ---------- Debug ----------
app.get('/debug', (_req, res) => {
res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Bori /debug</title>
<pre id="out">Loading…</pre>
<script>
const data = {
in_iframe: window.self !== window.top,
origin: window.location.origin,
referrer: document.referrer || null,
user_agent: navigator.userAgent
};
document.getElementById('out').textContent = JSON.stringify(data, null, 2);
</script>`);
});

// ---------- Themed UI (La Voz de Puerto Rico) ----------
app.get('/', (_req, res) => {
res.type('html').send(`<!doctype html>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>La Voz de Puerto Rico — Bori Chat</title>
<style>
:root{
--bg:#f7f8fb;
--panel:#ffffff;
--line:#e6e6e6;
--shadow:0 10px 30px rgba(0,0,0,.06);
--blue:#0a3a78; /* PR flag deep blue */
--red:#d61e2b; /* PR flag red */
--ink:#1b1b1b;
--muted:#60646c;
--user:#eef4ff;
--assistant:#f7f7f7;
--radius:16px;
--max:900px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
margin:0;
font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
color:var(--ink);
background:
radial-gradient(1200px 400px at 20% -10%, rgba(214,30,43,.08), transparent 60%),
radial-gradient(1200px 600px at 120% -20%, rgba(10,58,120,.08), transparent 60%),
var(--bg);
}
.wrap{min-height:100svh;display:grid;grid-template-rows:auto 1fr auto}
header{
background:linear-gradient(90deg, var(--blue), #0f4fa8);
color:#fff;
padding:22px 20px;
box-shadow:var(--shadow);
}
.brand{
max-width:var(--max);
margin:0 auto;
display:flex;align-items:center;gap:12px;
}
.logo{
width:28px;height:28px;display:inline-grid;place-items:center;
background:#fff;border-radius:8px;color:var(--red);font-weight:800;
}
.title{font-weight:800;letter-spacing:.2px}
.subtitle{opacity:.9;font-size:14px}
main{
max-width:var(--max);
margin:24px auto;
padding:0 16px 120px;
width:100%;
}
.panel{
background:var(--panel);
border:1px solid var(--line);
border-radius:var(--radius);
box-shadow:var(--shadow);
overflow:hidden;
}
.topbar{
display:flex;justify-content:space-between;align-items:center;
padding:12px 14px;border-bottom:1px solid var(--line);background:#fff;
}
.tag{font-size:12px;color:var(--muted)}
#messages{
height:60vh;min-height:320px;max-height:70vh;
overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(#fff, #fff 50%, #fcfcfc);
}
.row{display:flex;gap:10px;align-items:flex-start}
.avatar{
width:28px;height:28px;border-radius:50%;display:grid;place-items:center;
font-size:13px;font-weight:800;flex:0 0 28px;border:1px solid var(--line);
background:#fff;color:var(--blue);
}
.bubble{
max-width:75%;
border:1px solid var(--line);border-radius:14px;padding:10px 12px;background:#fff;
box-shadow:0 1px 0 rgba(0,0,0,.03);
white-space:pre-wrap;word-wrap:break-word;line-height:1.45;
}
.user .bubble{background:var(--user);border-color:#d8e7ff}
.assistant .bubble{background:var(--assistant);border-color:#ececec}
.meta{margin-top:4px;font-size:11px;color:var(--muted)}
.right{justify-content:flex-end}
.right .avatar{background:var(--red);color:#fff;border-color:#d9d9d9}
.right .bubble{background:var(--user);border-color:#d8e7ff}
.typing{display:inline-block;min-width:24px}
.typing span{display:inline-block;width:6px;height:6px;margin-right:3px;border-radius:50%;background:#bdbdbd;animation:blink 1.2s infinite ease-in-out}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}
.composer{
position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);
padding:12px 16px;box-shadow:0 -8px 20px rgba(0,0,0,.03);
}
.bar{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:1fr auto;gap:10px}
textarea{
width:100%;min-height:64px;max-height:32vh;resize:vertical;
padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit;
}
button{
padding:12px 16px;border:1px solid #0c2a55;border-radius:12px;background:var(--blue);color:#fff;cursor:pointer;font-weight:700;
}
.tools{display:flex;gap:10px}
.muted{color:var(--muted);font-size:12px}
footer{padding:18px;color:var(--muted);text-align:center;border-top:1px solid var(--line);background:#fff}
.float-bottom{position:absolute;right:18px;bottom:80px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 12px;box-shadow:var(--shadow);font-size:12px;cursor:pointer}
@media (max-width:640px){ .bubble{max-width:86%} .title{font-size:18px} }
</style>

<div class="wrap">
<header>
<div class="brand">
<div class="logo">PR</div>
<div>
<div class="title">La Voz de Puerto Rico — Bori Chat</div>
<div class="subtitle">ES/EN • Spanish first, then English • History on-screen</div>
</div>
</div>
</header>

<main>
<section class="panel">
<div class="topbar">
<div class="tag">Build: ${UI_TAG}</div>
<div class="tools">
<button id="clear" title="Clear conversation" style="background:#fff;color:#333;border-color:#ccc">Clear</button>
<button id="export" title="Export transcript" style="background:#fff;color:#333;border-color:#ccc">Export</button>
</div>
</div>

<div id="messages"></div>
</section>
<button id="toBottom" class="float-bottom" style="display:none;">Jump to latest ↓</button>
</main>

<div class="composer">
<form id="ask-form" class="bar" autocomplete="off">
<textarea id="q" placeholder="Haz tu pregunta… / Ask your question…" required></textarea>
<button id="send" type="submit">Send</button>
</form>
<div class="muted" style="max-width:var(--max);margin:8px auto 0;">
Press <b>Enter</b> to send · <b>Shift+Enter</b> for new line
</div>
</div>

<footer>© Bori Labs LLC — Let’s Go Pa’lante 🏀</footer>
</div>

<script>
const API = '/api/ask';
const KEY = 'bori_chat_transcript_v1';
const $ = sel => document.querySelector(sel);
const els = { list: $('#messages'), form: $('#ask-form'), q: $('#q'), send: $('#send'), clear: $('#clear'), export: $('#export'), toBottom: $('#toBottom') };

function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function save(t){ localStorage.setItem(KEY, JSON.stringify(t)); }
function add(role, content){
const t = load(); t.push({ role, content, ts: Date.now() }); save(t); render(true);
}
function when(ts){
const d = new Date(ts||Date.now());
return d.toLocaleString([], { hour:'2-digit', minute:'2-digit', month:'short', day:'numeric' });
}
function bubbleHTML(role, content, ts){
const isUser = role === 'user';
const side = isUser ? 'right' : 'left';
const init = isUser ? 'YO' : 'AI';
return \`
<div class="row \${isUser ? 'right user' : 'assistant'}">
<div class="avatar">\${init}</div>
<div>
<div class="bubble">\${content}</div>
<div class="meta">\${when(ts)}</div>
</div>
</div>
\`;
}
function render(scrollToEnd=false){
const t = load();
els.list.innerHTML = t.map(m => bubbleHTML(m.role, m.content, m.ts)).join('');
if (scrollToEnd) els.list.scrollTop = els.list.scrollHeight;
els.toBottom.style.display = (els.list.scrollHeight - els.list.scrollTop - els.list.clientHeight) > 80 ? 'block' : 'none';
}
function typingOn(){
const row = document.createElement('div'); row.className = 'row assistant';
row.innerHTML = '<div class="avatar">AI</div><div><div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div><div class="meta">typing…</div></div>';
els.list.appendChild(row);
els.list.scrollTop = els.list.scrollHeight;
return row;
}
async function askBackend(question){
const history = load().slice(-12); // send recent context
const resp = await fetch(API, {
method:'POST', headers:{'content-type':'application/json'},
body: JSON.stringify({ question, history })
});
const data = await resp.json().catch(()=>({answer:'Error'}));
return data.answer || 'No answer.';
}

els.form.addEventListener('submit', async (e) => {
e.preventDefault();
const question = els.q.value.trim(); if(!question) return;
els.q.value = ''; els.q.style.height = 'auto';
add('user', question);
els.send.disabled = true;
const tip = typingOn();
try {
const answer = await askBackend(question);
tip.remove();
add('assistant', answer);
} catch (err) {
tip.remove();
add('assistant', 'Error: ' + (err?.message || err));
} finally {
els.send.disabled = false; els.q.focus();
}
});

// Enter=send, Shift+Enter=new line
els.q.addEventListener('keydown', (e) => {
if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); els.form.requestSubmit(); }
});

// Auto-grow textarea
els.q.addEventListener('input', () => {
els.q.style.height = 'auto';
els.q.style.height = Math.min(els.q.scrollHeight, window.innerHeight * 0.32) + 'px';
});

els.clear.addEventListener('click', () => {
if (confirm('Clear this conversation on this device?')) { localStorage.removeItem(KEY); render(true); }
});
els.export.addEventListener('click', () => {
const t = load();
const blob = new Blob([JSON.stringify(t, null, 2)], { type:'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'bori-chat-transcript.json';
document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
els.toBottom.addEventListener('click', () => els.list.scrollTop = els.list.scrollHeight);
els.list.addEventListener('scroll', () => {
els.toBottom.style.display = (els.list.scrollHeight - els.list.scrollTop - els.list.clientHeight) > 80 ? 'block' : 'none';
});

render(true);
</script>`);
});

// Error logger
app.use((err, req, res, next) => {
console.error('Express error:', err?.stack || err);
res.status(500).type('text/plain').send('Internal Server Error (see logs)');
});

app.listen(PORT, () => console.log(`✅ La Voz de Puerto Rico — Bori Chat listening on ${PORT}`));
