// server.js — Bori Chat (final build with safe CSP sanitizer)
const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS_RAW = process.env.CSP_ANCESTORS || 'https://heybori.co https://chat.heybori.co';
const UI_TAG = process.env.UI_TAG || 'v1';

// ----- Helper to sanitize CSP -----
function buildFrameAncestors(raw) {
const cleaned = String(raw || '')
.replace(/[\r\n'"]/g, ' ') // strip control chars & quotes
.replace(/\s+/g, ' ') // collapse whitespace
.trim();
const parts = cleaned
.split(/[,\s]+/)
.map(s => s.replace(/[^\x20-\x7E]/g, '')) // keep visible ASCII only
.filter(Boolean);
const defaults = ['https://heybori.co', 'https://chat.heybori.co'];
return `frame-ancestors ${(parts.length ? parts : defaults).join(' ')}`;
}
const CSP_VALUE = buildFrameAncestors(FRAME_ANCESTORS_RAW);
console.log('CSP →', CSP_VALUE);

app.set('trust proxy', true);
app.set('etag', false);

// no-cache
app.use((req, res, next) => {
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
res.setHeader('Pragma', 'no-cache');
res.setHeader('Expires', '0');
next();
});

// safe CSP header
app.use((req, res, next) => {
try { res.setHeader('Content-Security-Policy', CSP_VALUE); }
catch (e) { console.error('CSP header error:', e); }
next();
});

// redirect *.onrender.com → chat.heybori.co
app.use((req, res, next) => {
const host = (req.headers.host || '').toLowerCase();
if (host.endsWith('.onrender.com')) {
return res.redirect(301, `https://${FORCE_DOMAIN}${req.originalUrl || '/'}`);
}
next();
});

app.use(express.json());

// ---------- API ----------
app.post('/api/ask', async (req, res) => {
const q = (req.body?.question || '').toString().slice(0, 4000);
if (!process.env.OPENAI_API_KEY) {
return res.json({
answer: 'OpenAI key not set yet. Please try again soon.\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀'
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
content: 'ES/EN: Start every reply with ES/EN note, answer in Spanish first then English, end with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'
},
{ role: 'user', content: q }
]
})
});

if (!r.ok) {
const detail = await r.text().catch(() => '');
return res.json({ answer: `The model is unavailable right now. Try again later.\n\n(detail: ${detail.slice(0,200)})` });
}

const data = await r.json();
const answer = data?.choices?.[0]?.message?.content || 'No answer.';
return res.json({ answer });
} catch (e) {
return res.json({ answer: `Temporary error. Try again.\n(detail: ${String(e?.message || e)})` });
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

// ---------- UI ----------
app.get('/', (_req, res) => {
res.type('html').send(`<!doctype html>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bori Chat — ${UI_TAG}</title>
<style>
:root{--max:900px;--line:#e9e9e9;}
html,body{margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#fafafa;}
header{padding:16px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff;z-index:10;}
.brand{font-weight:800;}
main{max-width:var(--max);margin:0 auto;padding:16px 20px 120px;}
#messages{max-height:60vh;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:10px 0;}
.msg{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;}
.user{background:#eef5ff;border-color:#d8e7ff;}
.assistant{background:#f7f7f7;border-color:#eaeaea;white-space:pre-wrap;}
form{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px;}
.bar{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;}
textarea{width:100%;min-height:60px;max-height:30vh;resize:vertical;padding:12px;font:inherit;border:1px solid var(--line);border-radius:12px;}
button{padding:11px 16px;border:1px solid #111;border-radius:12px;background:#fff;cursor:pointer;font-weight:600;}
</style>
<header><div class="brand">Bori Chat</div></header>
<main><div id="messages"></div></main>
<form id="ask-form"><div class="bar"><textarea id="q" placeholder="Ask your question…" required></textarea><button type="submit" id="send">Send</button></div></form>
<script>
const API='/api/ask';const KEY='bori_chat_transcript_v1';
const els={m:document.getElementById('messages'),f:document.getElementById('ask-form'),q:document.getElementById('q'),s:document.getElementById('send')};
function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}}
function save(t){localStorage.setItem(KEY,JSON.stringify(t))}
function render(){const t=load();els.m.innerHTML='';for(const x of t){const d=document.createElement('div');d.className='msg '+(x.role==='user'?'user':'assistant');d.textContent=x.content;els.m.appendChild(d)}els.m.scrollTop=els.m.scrollHeight}
async function ask(q){const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q})});const j=await r.json().catch(()=>({answer:'Error'}));return j.answer||'No answer.'}
els.f.addEventListener('submit',async e=>{e.preventDefault();const q=els.q.value.trim();if(!q)return;els.q.value='';const t=load();t.push({role:'user',content:q});save(t);render();els.s.disabled=true;try{const a=await ask(q);const t2=load();t2.push({role:'assistant',content:a});save(t2);render()}catch(e){const t2=load();t2.push({role:'assistant',content:'Error: '+(e.message||e)});save(t2);render()}finally{els.s.disabled=false;els.q.focus()}});
render();
</script>`);
});

// ----- Error logger -----
app.use((err, req, res, next) => {
console.error('Express error:', err?.stack || err);
res.status(500).type('text/plain').send('Internal Server Error (see logs)');
});

app.listen(PORT, () => console.log(`✅ Bori Chat running on ${PORT}`));
