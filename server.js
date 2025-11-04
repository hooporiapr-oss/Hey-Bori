// server.js — Hey Bori (Stable Non-Streaming Build)
const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS_RAW = process.env.CSP_ANCESTORS || 'https://heybori.co https://chat.heybori.co';
const UI_TAG = process.env.UI_TAG || 'stable-v1';

// --- CSP sanitizer ---
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

// no-cache
app.use((_, res, next) => {
res.setHeader('Cache-Control','no-store,no-cache,must-revalidate,max-age=0');
res.setHeader('Pragma','no-cache');
res.setHeader('Expires','0');
next();
});

// safe CSP
app.use((_, res, next) => {
try { res.setHeader('Content-Security-Policy', CSP_VALUE); }
catch(e){ console.error('CSP header error:', e); }
next();
});

// redirect *.onrender.com → custom domain
app.use((req,res,next)=>{
const host=(req.headers.host||'').toLowerCase();
if(host.endsWith('.onrender.com'))
return res.redirect(301,`https://${FORCE_DOMAIN}${req.originalUrl||'/'}`);
next();
});

app.use(express.json());

// ---------- Non-stream API (/api/ask) ----------
app.post('/api/ask', async (req, res) => {
const q=(req.body?.question||'').toString().slice(0,4000);
const hist=Array.isArray(req.body?.history)?req.body.history:[];
const mapped=hist.slice(-12).map(m=>({
role:m.role==='assistant'?'assistant':'user',
content:(m.content||'').toString().slice(0,2000)
}));

if(!process.env.OPENAI_API_KEY){
return res.json({answer:'OpenAI key not set yet. Please try again soon.\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀'});
}

try{
const r=await fetch('https://api.openai.com/v1/chat/completions',{
method:'POST',
headers:{
'content-type':'application/json',
'authorization':`Bearer ${process.env.OPENAI_API_KEY}`
},
body:JSON.stringify({
model:'gpt-4o-mini',
messages:[
{role:'system',content:'ES/EN: Begin with a short ES/EN note. Spanish first, then English. Keep replies tight, readable, and friendly. Use short paragraphs and bullets when helpful. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'},
...mapped,
{role:'user',content:q}
]
})
});
if(!r.ok){
const detail=await r.text().catch(()=> '');
return res.json({answer:`Model unavailable. Try again later.\n\n(detail:${detail.slice(0,200)})`});
}
const data=await r.json();
res.json({answer:data?.choices?.[0]?.message?.content||'No answer.'});
}catch(e){
res.json({answer:`Temporary error. Try again.\n(detail:${String(e?.message||e)})`});
}
});

// ---------- Debug ----------
app.get('/debug',(_,res)=>{
res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Hey Bori / debug</title>
<pre id="out">Loading…</pre>
<script>
const data={in_iframe:window.self!==window.top,origin:window.location.origin,referrer:document.referrer||null,user_agent:navigator.userAgent};
document.getElementById('out').textContent=JSON.stringify(data,null,2);
</script>`);
});

// ---------- UI (hybrid layout + dark mode + nice reading) ----------
app.get('/',(_,res)=>{
res.type('html').send(`<!doctype html>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<title>La Voz de Puerto Rico — Hey Bori</title>
<style>
:root{--blue:#0a3a78;--red:#d61e2b;--bg:#f7f8fb;--panel:#fff;--line:#e6e6e6;
--shadow:0 10px 30px rgba(0,0,0,.06);--ink:#1b1b1b;--muted:#60646c;
--user:#eef4ff;--assistant:#f7f7f7;--radius:16px;--max:900px;}
html,body{margin:0;height:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);}
header{background:linear-gradient(90deg,var(--blue),#0f4fa8);color:#fff;padding:22px 20px;box-shadow:var(--shadow);}
.brand{max-width:var(--max);margin:0 auto;display:flex;align-items:center;gap:12px;}
.logo{width:28px;height:28px;display:grid;place-items:center;background:#fff;border-radius:8px;color:var(--red);font-weight:800;}
.title{font-weight:800;letter-spacing:.2px;}
.subtitle{opacity:.9;font-size:14px;}
main{width:100%;margin:0 auto;padding:0 0 120px;max-width:var(--max);}
#messages{
width:100%;height:70vh;overflow:auto;display:flex;flex-direction:column;gap:12px;
padding:20px 18px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:var(--shadow);
}
.row{display:flex;gap:10px;align-items:flex-start;opacity:0;transform:translateY(6px);animation:fadeInUp .25s ease-out forwards;}
@keyframes fadeInUp{to{opacity:1;transform:translateY(0)}}
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
footer{text-align:center;padding:18px;color:var(--muted);border-top:1px solid var(--line)}
/* Mobile comfort */
@media (max-width:560px){
main{max-width:100%;padding:0 0 100px}
#messages{border:none;border-radius:0;box-shadow:none;height:75vh;padding:16px 14px}
.bubble{max-width:92%}
}
/* Auto dark mode */
@media (prefers-color-scheme: dark){
:root{--blue:#7fb0ff;--red:#ff6b73;--bg:#0f1115;--panel:#161920;--line:#2a2f3a;--ink:#f2f4f8;--muted:#9ba4b3;--user:#1a2130;--assistant:#161b24;--shadow:0 8px 24px rgba(0,0,0,.45);}
body{background:var(--bg);color:var(--ink)}
header{background:linear-gradient(90deg,#0a2a55,#11386f)}
#messages{background:var(--panel);border-color:var(--line);box-shadow:none}
.bubble{background:#12161f;border-color:#232b38}
.assistant .bubble{background:#12161f}
.user .bubble{background:#172131;border-color:#263245}
.avatar{background:#0e1420;color:#cfe0ff;border-color:#2a3445}
.right .avatar{background:#ff4a57;color:#fff;border-color:#ffa0a6}
form{background:#0f1218;border-top-color:#222b37;box-shadow:0 -6px 16px rgba(0,0,0,.35)}
textarea{background:#0f131b;color:var(--ink);border-color:#283142}
button{background:#163b77;border-color:#0d2b5b}
footer{background:#0f1218;border-top-color:#222b37;color:var(--muted)}
.name{color:#cfd7e6}
}
</style>

<header>
<div class="brand">
<div class="logo">HB</div>
<div>
<div class="title">La Voz de Puerto Rico — Hey Bori</div>
<div class="subtitle">Ask Me Anything — Español or English</div>
</div>
</div>
</header>

<main>
<div id="messages"></div>
</main>

<form id="ask-form" class="bar" autocomplete="off">
<textarea id="q" placeholder="Haz tu pregunta… / Ask your question…" required></textarea>
<button id="send" type="submit">Send</button>
</form>

<footer>© Bori Labs LLC — Let’s Go Pa’lante 🏀 • Build: ${UI_TAG}</footer>

<script>
const KEY='bori_chat_transcript_v1';
const els={list:document.getElementById('messages'),form:document.getElementById('ask-form'),q:document.getElementById('q'),send:document.getElementById('send')};
const load=()=>{ try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]} };
const save=t=>localStorage.setItem(KEY,JSON.stringify(t));
const when=ts=>new Date(ts||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
function escapeHTML(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function md(s){
s=escapeHTML(String(s||'')); s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
s=s.replace(/`([^`]+)`/g,'<code>$1</code>'); s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
s=s.replace(/^(?:- |\* )(.*)$/gm,'<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/gms,'<ul>$1</ul>');
s=s.replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>'); return '<p>'+s+'</p>';
}
function bubble(role, content, ts){
const isUser = role==='user'; const who=isUser?'Coach':'Hey Bori'; const init=isUser?'C':'B';
return \`<div class="row \${isUser?'right user':'assistant'}"><div class="avatar">\${init}</div><div><div class="name">\${who} · \${when(ts)}</div><div class="bubble">\${md(content)}</div></div></div>\`;
}
function render(scrollEnd=false){ const t=load(); els.list.innerHTML=t.map(m=>bubble(m.role,m.content,m.ts)).join(''); if(scrollEnd) els.list.scrollTop=els.list.scrollHeight; }
async function askBackend(question){
const history = load().slice(-12);
const r = await fetch('/api/ask',{ method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ question, history })});
const j = await r.json().catch(()=>({answer:'Error'}));
return j.answer || 'No answer.';
}
els.form.addEventListener('submit', async (e)=>{
e.preventDefault();
const q=els.q.value.trim(); if(!q) return; els.q.value=''; els.q.style.height='auto';
const t=load(); t.push({role:'user',content:q,ts:Date.now()}); save(t); render(true);
els.send.disabled=true;
try{
const answer=await askBackend(q);
const t2=load(); t2.push({role:'assistant',content:answer,ts:Date.now()}); save(t2); render(true);
}catch(err){
const t2=load(); t2.push({role:'assistant',content:'Error: '+(err?.message||err),ts:Date.now()}); save(t2); render(true);
}finally{ els.send.disabled=false; els.q.focus(); }
});
</script>`);
});

// error logger
app.use((err,req,res,next)=>{
console.error('Express error:',err?.stack||err);
res.status(500).type('text/plain').send('Internal Server Error (see logs)');
});

app.listen(PORT,()=>console.log(`✅ Hey Bori (Stable Non-Streaming) listening on ${PORT}`));
