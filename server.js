// server.js — continuous chat + /api/ask + CSP + redirect + no-cache
const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS = process.env.CSP_ANCESTORS || 'https://heybori.co https://chat.heybori.co';
const UI_TAG = process.env.UI_TAG || 'v1';

app.set('trust proxy', true);
app.set('etag', false);

// no-cache (avoid stale HTML)
app.use((req, res, next) => {
res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
res.setHeader('Pragma', 'no-cache');
res.setHeader('Expires', '0');
next();
});

// CSP: only heybori.co and chat.heybori.co can embed
app.use((req, res, next) => {
res.setHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`);
next();
});

// 301 any *.onrender.com → custom domain
app.use((req, res, next) => {
const host = (req.headers.host || '').toLowerCase();
if (host.endsWith('.onrender.com')) {
return res.redirect(301, `https://${FORCE_DOMAIN}${req.originalUrl || '/'}`);
}
next();
});

app.use(express.json());

// OpenAI-backed endpoint
app.post('/api/ask', async (req, res) => {
try {
const q = (req.body?.question || '').toString().slice(0, 4000);
if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

// Node 20 has global fetch
const r = await fetch('https://api.openai.com/v1/chat/completions', {
method: 'POST',
headers: {
'content-type': 'application/json',
'authorization': `Bearer ${process.env.OPENAI_API_KEY}`
},
body: JSON.stringify({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: 'ES/EN: Answer Spanish first, then English. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.' },
{ role: 'user', content: q }
]
})
});

if (!r.ok) return res.status(502).json({ error: 'OpenAI request failed', detail: await r.text().catch(()=> '') });
const data = await r.json();
res.json({ answer: data?.choices?.[0]?.message?.content || 'No answer.' });
} catch (e) {
res.status(500).json({ error: String(e?.message || e) });
}
});

// Debug page for iframe checks
app.get('/debug', (_req, res) => {
res.type('html').send(`<!doctype html>
<meta charset="utf-8"><title>Bori /debug</title>
<pre id="out">Loading…</pre>
<script>
const data = {
in_iframe: (window.self !== window.top),
iframe_origin: window.location.origin,
parent_referrer: document.referrer || null,
user_agent: navigator.userAgent
};
document.getElementById('out').textContent = JSON.stringify(data, null, 2);
</script>`);
});

// Continuous chat UI (history in localStorage)
app.get('/', (_req, res) => {
res.type('html').send(`<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Bori Chat — ${UI_TAG}</title>
<style>
:root { --max: 900px; --line:#e9e9e9; }
html, body { margin:0; padding:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background:#fafafa;}
header { padding: 16px 20px; border-bottom: 1px solid var(--line); position: sticky; top:0; background:#fff; z-index:10; }
.brand { font-weight: 800; }
main { max-width: var(--max); margin: 0 auto; padding: 16px 20px 120px; }
#messages { max-height: 60vh; overflow:auto; display:flex; flex-direction:column; gap:12px; padding: 10px 0; }
.msg { border:1px solid var(--line); border-radius: 12px; padding: 12px; background:#fff; }
.user { background:#eef5ff; border-color:#d8e7ff; }
.assistant { background:#f7f7f7; border-color:#eaeaea; white-space:pre-wrap;}
.label { font-size:12px; font-weight:600; color:#444; letter-spacing:.02em }
form { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top:1px solid var(--line); padding: 12px 16px; }
.bar { max-width: var(--max); margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items:end; }
.group { display:flex; flex-direction:column; gap:6px; }
textarea { width:100%; min-height: 60px; max-height: 30vh; resize: vertical; padding: 12px; font: inherit; border:1px solid var(--line); border-radius:12px; background:#fff; }
button { padding: 11px 16px; border:1px solid #111; border-radius:12px; background:#fff; cursor:pointer; font-weight:600; }
.actions { display:flex; gap:8px; margin-top:10px; }
.muted { color:#666; font-size:13px; }
</style>
<header><div class="brand">Bori Chat</div></header>
<main>
<div class="muted">Continuous chat with labeled input. History persists locally in your browser. (Build: ${UI_TAG})</div>
<div id="messages"></div>
<div class="actions">
<button id="clear-btn" title="Clear history">Clear</button>
<button id="export-btn" title="Export transcript">Export</button>
</div>
</main>
<form id="ask-form" aria-label="Ask a question">
<div class="bar">
<div class="group">
<label class="label" for="q">Your question</label>
<textarea id="q" placeholder="Type your question…" required></textarea>
</div>
<button type="submit" id="send" aria-label="Send message">Send</button>
</div>
</form>
<script>
const API_ENDPOINT = '/api/ask';
const KEY = 'bori_chat_transcript_v1';
const el = {
messages: document.getElementById('messages'),
form: document.getElementById('ask-form'),
q: document.getElementById('q'),
send: document.getElementById('send'),
clear: document.getElementById('clear-btn'),
export: document.getElementById('export-btn'),
};
function loadTranscript(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function saveTranscript(t){ localStorage.setItem(KEY, JSON.stringify(t)); }
function renderTranscript(){
const t = loadTranscript();
el.messages.innerHTML = '';
for(const m of t){
const div = document.createElement('div');
div.className = 'msg ' + (m.role === 'user' ? 'user' : 'assistant');
div.textContent = m.content;
el.messages.appendChild(div);
}
el.messages.scrollTop = el.messages.scrollHeight;
}
async function askBackend(question){
const resp = await fetch(API_ENDPOINT, {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ question })
});
if(!resp.ok){ const txt = await resp.text(); throw new Error('Request failed: ' + resp.status + ' ' + txt); }
const data = await resp.json();
return data.answer || JSON.stringify(data);
}
el.form.addEventListener('submit', async (e) => {
e.preventDefault();
const question = el.q.value.trim();
if(!question) return;
el.q.value = '';
const t = loadTranscript();
t.push({ role: 'user', content: question }); saveTranscript(t); renderTranscript();
el.send.disabled = true;
try{
const answer = await askBackend(question);
const t2 = loadTranscript();
t2.push({ role: 'assistant', content: answer }); saveTranscript(t2); renderTranscript();
}catch(err){
const t2 = loadTranscript();
t2.push({ role: 'assistant', content: 'Error: ' + (err.message || err) }); saveTranscript(t2); renderTranscript();
}finally{
el.send.disabled = false; el.q.focus();
}
});
el.clear.addEventListener('click', () => {
if(confirm('Clear local chat history?')){ localStorage.removeItem(KEY); renderTranscript(); }
});
el.export.addEventListener('click', () => {
const t = loadTranscript();
const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'bori-chat-transcript.json';
document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
renderTranscript();
</script>`);
});

app.listen(PORT, () => console.log(`Bori minimal listening on ${PORT}`));
