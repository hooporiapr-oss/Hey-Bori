// server.js — Hey Bori (La Voz de Puerto Rico theme) + safe CSP + history context
const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;
const FORCE_DOMAIN = process.env.FORCE_DOMAIN || 'chat.heybori.co';
const FRAME_ANCESTORS_RAW = process.env.CSP_ANCESTORS || 'https://heybori.co https://chat.heybori.co';
const UI_TAG = process.env.UI_TAG || 'voz-pr-v2';

// ---------- CSP sanitizer ----------
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

// ---------- API with continuity ----------
app.post('/api/ask', async (req, res) => {
const q=(req.body?.question||'').toString().slice(0,4000);
const hist=Array.isArray(req.body?.history)?req.body.history:[];
const mapped=hist.slice(-12).map(m=>({
role:m.role==='assistant'?'assistant':'user',
content:(m.content||'').toString().slice(0,2000)
}));

if(!process.env.OPENAI_API_KEY)
return res.json({answer:'OpenAI key not set yet. Please try again soon.\n\n— Bori Labs LLC — Let’s Go Pa’lante 🏀'});

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
{role:'system',content:'ES/EN: Start each reply with an ES/EN note, Spanish first then English, end with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'},
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

// ---------- UI ----------
app.get('/',(_,res)=>{
res.type('html').send(`<!doctype html>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>La Voz de Puerto Rico — Hey Bori</title>
<style>
/* theme vars */
:root{--blue:#0a3a78;--red:#d61e2b;--bg:#f7f8fb;--panel:#fff;--line:#e6e6e6;
--shadow:0 10px 30px rgba(0,0,0,.06);--ink:#1b1b1b;--muted:#60646c;
--user:#eef4ff;--assistant:#f7f7f7;--radius:16px;--max:900px;}
html,body{margin:0;height:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);}
header{background:linear-gradient(90deg,var(--blue),#0f4fa8);color:#fff;padding:22px 20px;box-shadow:var(--shadow);}
.brand{max-width:var(--max);margin:0 auto;display:flex;align-items:center;gap:12px;}
.logo{width:28px;height:28px;display:grid;place-items:center;background:#fff;border-radius:8px;color:var(--red);font-weight:800;}
.title{font-weight:800;letter-spacing:.2px;}
.subtitle{opacity:.9;font-size:14px;}
main{max-width:var(--max);margin:24px auto;padding:0 16px 120px;}
#messages{height:60vh;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);}
.row{display:flex;gap:10px;align-items:flex-start;}
.avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;flex:0 0 28px;border:1px solid var(--line);background:#fff;color:var(--blue);}
.bubble{max-width:75%;border:1px solid var(--line);border-radius:14px;padding:10px 12px;background:#fff;white-space:pre-wrap;line-height:1.45;}
.user .bubble{background:var(--user);border-color:#d8e7ff;}
.assistant .bubble{background:var(--assistant);}
.meta{margin-top:4px;font-size:11px;color:var(--muted);}
.right{justify-content:flex-end;}
.right .avatar{background:var(--red);color:#fff;border-color:#d9d9d9;}
form{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px;box-shadow:0 -8px 20px rgba(0,0,0,.03);}
.bar{max-width:var(--max);margin:0 auto;display:grid;grid-template-columns:1fr auto;gap:10px;}
textarea{width:100%;min-height:64px;resize:vertical;padding:12px;border:1px solid var(--line);border-radius:12px;}
button{padding:12px 16px;border:1px solid #0c2a55;border-radius:12px;background:var(--blue);color:#fff;cursor:pointer;font-weight:700;}
footer{text-align:center;padding:18px;color:var(--muted);border-top:1px solid var(--line);}
</style>
<header>
<div class="brand">
<div class="logo">PR</div>
<div>
<div class="title">La Voz de Puerto Rico — Hey Bori</div>
<div class="subtitle">ES/EN • Spanish first, then English • Continuous conversation</div>
</div>
</div>
</header>
<main><div id="messages"></div></main>
<form id="ask-form" class="bar">
<textarea id="q" placeholder="Haz tu pregunta… / Ask your question…" required></textarea>
<button id="send" type="submit">Send</button>
</form>
<footer>© Bori Labs LLC — Let’s Go Pa’lante 🏀</footer>
<script>
const API='/api/ask',KEY='bori_chat_transcript_v1';
const $=s=>document.querySelector(s);
const els={m:$('#messages'),f:$('#ask-form'),q:$('#q'),s:$('#send')};
function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}}
function save(t){localStorage.setItem(KEY,JSON.stringify(t))}
function render(){const t=load();els.m.innerHTML='';for(const m of t){const r=m.role==='user'?'right user':'assistant';const a=m.role==='user'?'YO':'AI';els.m.insertAdjacentHTML('beforeend',\`<div class="row \${r}"><div class="avatar">\${a}</div><div><div class="bubble">\${m.content}</div><div class="meta">\${new Date(m.ts||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div></div>\`);}els.m.scrollTop=els.m.scrollHeight;}
async function askBackend(q){const h=load().slice(-12);const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q,history:h})});const d=await r.json().catch(()=>({answer:'Error'}));return d.answer||'No answer.'}
els.f.addEventListener('submit',async e=>{e.preventDefault();const q=els.q.value.trim();if(!q)return;els.q.value='';const t=load();t.push({role:'user',content:q,ts:Date.now()});save(t);render();els.s.disabled=true;try{const a=await askBackend(q);const t2=load();t2.push({role:'assistant',content:a,ts:Date.now()});save(t2);render();}catch(err){const t2=load();t2.push({role:'assistant',content:'Error: '+(err.message||err),ts:Date.now()});save(t2);render();}finally{els.s.disabled=false;els.q.focus();}});
render();
</script>`);
});

// error logger
app.use((err,req,res,next)=>{
console.error('Express error:',err?.stack||err);
res.status(500).type('text/plain').send('Internal Server Error (see logs)');
});

app.listen(PORT,()=>console.log(`✅ Hey Bori listening on ${PORT}`));
