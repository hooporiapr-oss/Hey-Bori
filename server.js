const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
app.set('trust proxy', true);

// Health + debug
app.get('/debug', (_req, res) => {
res.type('html').send(`<!doctype html><meta charset="utf-8"><title>/debug OK</title>
<pre>{"ok":true,"stage":"ui-only"}</pre>`);
});

// Continuous chat UI (no /api/ask yet)
app.get('/', (_req, res) => {
res.type('html').send(`<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Bori Chat — ui-only</title>
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
<div class="muted">Continuous chat UI (no OpenAI yet). History is stored locally in your browser.</div>
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
const KEY = 'bori_chat_transcript_v1';
const el = {
messages: document.getElementById('messages'),
form: document.getElementById('ask-form'),
q: document.getElementById('q'),
send: document.getElementById('send'),
clear: document.getElementById('clear-btn'),
export: document.getElementById('export-btn'),
};
function loadT(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function saveT(t){ localStorage.setItem(KEY, JSON.stringify(t)); }
function render(){
const t = loadT(); el.messages.innerHTML = '';
for(const m of t){ const d = document.createElement('div'); d.className = 'msg ' + (m.role==='user'?'user':'assistant'); d.textContent = m.content; el.messages.appendChild(d); }
el.messages.scrollTop = el.messages.scrollHeight;
}
el.form.addEventListener('submit', (e) => {
e.preventDefault();
const question = el.q.value.trim(); if(!question) return; el.q.value = '';
const t = loadT(); t.push({ role:'user', content: question }); t.push({ role:'assistant', content: '(OpenAI not enabled yet — next step)' }); saveT(t); render();
el.q.focus();
});
el.clear.addEventListener('click', () => { if(confirm('Clear local chat history?')){ localStorage.removeItem(KEY); render(); } });
el.export.addEventListener('click', () => {
const t = loadT(); const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'bori-chat-transcript.json';
document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
render();
</script>`);
});

app.listen(PORT, () => console.log(`Bori minimal listening on ${PORT}`));
