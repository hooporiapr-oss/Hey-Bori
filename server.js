// Hey Bori — continuity by default; DIAG_MODE to bypass OpenAI for fast triage.
// ES first → EN, CSP, 301 redirect, no external deps.

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
const DIAG_MODE = (process.env.DIAG_MODE || '').toLowerCase() === 'on';

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

// ---------- OpenAI (used only when DIAG_MODE is off) ----------
function openAIChat(messages) {
return new Promise(resolve => {
if (!process.env.OPENAI_API_KEY) return resolve('Missing API key.\n— Bori Labs LLC — Let’s Go Pa’lante 🏀');

const body = JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, messages });
const req = https.request(
{ method: 'POST', hostname: 'api.openai.com', path: '/v1/chat/completions',
headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
timeout: 30000 },
r => {
let d=''; r.setEncoding('utf8');
r.on('data', c => d += c);
r.on('end', () => {
try {
console.log('[openAIChat] status', r.statusCode, 'len', d.length);
if (r.statusCode !== 200) {
return resolve('Upstream error ' + r.statusCode + ' — ' + (d.slice(0,200) || ''));
}
const j = JSON.parse(d);
const out = j?.choices?.[0]?.message?.content || 'Temporary error — try again.';
resolve(out);
} catch(e) {
console.log('[openAIChat][parse-error]', e?.message);
resolve('Temporary error — ' + e.message);
}
});
}
);
req.on('error', e => { console.log('[openAIChat][net-error]', e?.message); resolve('Network error — ' + e.message); });
req.on('timeout', () => { console.log('[openAIChat][timeout]'); req.destroy(); resolve('Request timed out'); });
req.write(body); req.end();
});
}

// ---------- Page (continuity default; ?cont=off disables) ----------
const PAGE =
'<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
'<title>Hey Bori</title>' +
'<style>' +
'html,body{margin:0;height:100%;background:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;overflow:hidden}' +
'header{padding:14px 16px;border-bottom:1px solid #eee}' +
'h1{margin:0;font:800 20px/1.2 system-ui} .sub{margin:4px 0 0;color:#666;font:500 13px/1.4 system-ui}' +
'#messages{position:absolute;top:74px;bottom:78px;left:0;right:0;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}' +
'.row{display:flex;gap:10px;align-items:flex-start}' +
'.avatar{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;border:1px solid #e6e6e6}' +
'.right{justify-content:flex-end}.right .avatar{background:#0a3a78;color:#fff;border-color:#b2c8ff}' +
'.bubble{max-width:85%;border:1px solid #e6e6e6;border-radius:12px;padding:10px 12px;background:#fff;white-space:pre-wrap;line-height:1.55}' +
'.user .bubble{background:#eef4ff;border-color:#d8e7ff}.assistant .bubble{background:#f7f7f7}' +
'.meta{font-size:11px;color:#555;margin-bottom:3px}' +
/* >> Roomier input bar (flex) << */
'form{position:fixed;bottom:0;left:0;right:0;z-index:20;display:flex;align-items:center;gap:10px;border-top:1px solid #eee;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:#fff;box-shadow:0 -3px 8px rgba(0,0,0,.04)}' +
'textarea{flex:1;min-height:48px;max-height:160px;resize:none;padding:10px 12px;border:1px solid #ddd;border-radius:12px;font-size:16px;line-height:1.4}' +
'button{padding:12px 16px;border-radius:12px;border:1px solid #0c2a55;background:#0a3a78;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap}' +
'#clear{background:#ff4d4d;border-color:#ff4d4d} #clear:hover{background:#e63e3e}' +
'#newchat{background:#444;border-color:#444} #newchat:hover{background:#333}' +
'#send{background:#0a3a78} #send:disabled{opacity:.6;cursor:default}' +
'#err{display:none;position:fixed;top:0;left:0;right:0;background:#ffefef;color:#a40000;border-bottom:1px solid #e5bcbc;padding:8px 12px;z-index:9999;font-size:13px;white-space:pre-wrap}' +
'#typing{position:absolute;left:14px;right:14px;bottom:78px;color:#666;opacity:.9;font:500 12px/1.4 system-ui;display:none}' +
'</style>' +
'<div id=err></div>' +
'<header><h1>Hey Bori</h1><p class=sub>Spanish first, then English · Continuity ON (add ?cont=off for single-turn)</p></header>' +
'<div id=messages></div>' +
'<div id="typing">Hey Bori is typing…</div>' +
'<form id=ask autocomplete=off>' +
'<textarea id=q placeholder="Ask your question in ES or EN…" required></textarea>' +
'<button id=send type=submit>Send</button>' +
'<button id=clear type=button>Clear</button>' +
'<button id=newchat type=button>New</button>' +
'</form>' +
'<script>' +
'window.addEventListener("error",function(e){var b=document.getElementById("err");if(!b)return;b.textContent="[JS] "+(e.message||"error");b.style.display="block";});' +
'var CONT_PARAM=(new URLSearchParams(location.search).get("cont")||"").toLowerCase();var CONT = CONT_PARAM==="off" ? false : true;' +
'var KEY="bori_chat_hist_v1";function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]}}function save(t){try{localStorage.setItem(KEY,JSON.stringify(t))}catch(e){}}' +
'var els={list:document.getElementById("messages"),form:document.getElementById("ask"),q:document.getElementById("q"),send:document.getElementById("send"),clear:document.getElementById("clear"),newchat:document.getElementById("newchat"),typing:document.getElementById("typing")};' +
'function when(t){return new Date(t||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}' +
'function esc(s){return String(s).replace(/[&<>\"\\\']/g,function(m){return{"&":"&amp;","<":"&lt;","&gt;":">","\\"":"&quot;","\\\'":"&#39;"}[m]})}' +
'function bubble(role,content,ts){var u=role==="user";var who=u?"Coach":"Hey Bori";var i=u?"C":"B";return "<div class=\\"row "+(u?"right user":"assistant")+"\\"><div class=avatar>"+i+"</div><div><div class=meta>"+who+" · "+when(ts)+"</div><div class=bubble>"+esc(content)+"</div></div></div>"}' +
'function scrollToEnd(){els.list.scrollTop=els.list.scrollHeight}' +
'function render(){var h=CONT?load():[];els.list.innerHTML=h.map(function(m){return bubble(m.role,m.content,m.ts)}).join("");scrollToEnd();}' +
'(function(){var ta=els.q;function fit(){ta.style.height="auto";ta.style.height=Math.min(180,ta.scrollHeight)+"px";}ta.addEventListener("input",fit);ta.addEventListener("focus",fit);setTimeout(fit,0);})();' +
'els.q.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();els.send.click();}});' +
'var _tyInt=null,_tyDot=0;function showTyping(on){if(!els.typing)return;els.typing.style.display=on?"block":"none";if(on){if(_tyInt)clearInterval(_tyInt);_tyDot=0;_tyInt=setInterval(function(){_tyDot=(_tyDot+1)%4;els.typing.textContent="Hey Bori is typing"+(".".repeat(_tyDot));},450);}else{if(_tyInt){clearInterval(_tyInt);_tyInt=null;}els.typing.textContent="Hey Bori is typing…";}}' +
'async function askServer(q){var history=CONT?load().map(function(m){return{role:m.role,content:String(m.content||"").slice(0,2000)}}):[];var r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:q,lang:"es",history:history,cont:CONT})});var j=await r.json().catch(function(){return{answer:"Error"}});return j.answer||"No answer."}' +
'els.form.addEventListener("submit",async function(e){e.preventDefault();var q=els.q.value.trim();if(!q)return;els.q.value="";if(CONT){var h=load();h.push({role:"user",content:q,ts:Date.now()});save(h);render();}else{els.list.insertAdjacentHTML("beforeend",bubble("user",q,Date.now()));scrollToEnd();}els.send.disabled=true;showTyping(true);try{var a=await askServer(q);if(CONT){var h2=load();h2.push({role:"assistant",content:a,ts:Date.now()});save(h2);render();}else{els.list.insertAdjacentHTML("beforeend",bubble("assistant",a,Date.now()));scrollToEnd();}}catch(err){var msg="(network) "+(err&&err.message||err);if(CONT){var h3=load();h3.push({role:"assistant",content:msg,ts:Date.now()});save(h3);render();}else{els.list.insertAdjacentHTML("beforeend",bubble("assistant",msg,Date.now()));scrollToEnd();}}finally{showTyping(false);els.send.disabled=false;els.q.focus();}});' +
'els.clear.addEventListener("click",function(){if(CONT){try{localStorage.removeItem(KEY)}catch(e){};render();}else{els.list.innerHTML="";}});' +
'els.newchat.addEventListener("click",function(){try{localStorage.removeItem(KEY)}catch(e){};location.replace(location.pathname + location.search);});' +
'render();' +
'</script>';

// ---------- server ----------
const server = http.createServer((req, res) => {
try {
const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
if (setCommonHeaders(res, u)) { res.end(); return; }

if (req.method === 'GET' && u.pathname === '/') return html(res, PAGE);

if (req.method === 'POST' && u.pathname === '/api/ask') {
let body = '';
req.on('data', c => (body += c));
req.on('end', async () => {
try {
const j = JSON.parse(body || '{}');
const q = (j.question || '').toString().slice(0, 4000);
const lang = (j.lang || 'es').toLowerCase();
const cont = !!j.cont;
const hist = Array.isArray(j.history) ? j.history : [];

// DIAG reply: bypass OpenAI to prove UI path works
if (DIAG_MODE) {
const dt = new Date().toLocaleString();
const echo = [
'OK — DIAG MODE',
'Time: ' + dt,
'Lang: ' + lang,
'Cont: ' + cont,
'Q: ' + q
].join('\\n');
const answer = (lang === 'en')
? echo + '\\n— Bori Labs LLC — Let’s Go Pa’lante 🏀'
: echo + '\\n' + '— Bori Labs LLC — Let’s Go Pa’lante 🏀';
return json(res, 200, { answer });
}

const systemPrompt = (lang === 'en')
? 'Respond ONLY in English. Use conversation context if provided. Be concise and avoid repeating earlier answers unless asked. End with “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.'
: 'Responde primero en Español (PR) y luego repite en Inglés. Usa TODO el contexto previo si se provee. Sé conciso y evita repetir salvo que te lo pidan. Termina con “— Bori Labs LLC — Let’s Go Pa’lante 🏀”.';

const msgs = cont
? [
{ role: 'system', content: systemPrompt },
...hist.map(m => ({ role: (m.role === 'assistant') ? 'assistant' : 'user', content: String(m.content||'').slice(0,2000) })).slice(-30),
{ role: 'user', content: q }
]
: [
{ role: 'system', content: systemPrompt },
{ role: 'user', content: q }
];

const answer = await openAIChat(msgs);
return json(res, 200, { answer });
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
console.log('✅ Hey Bori — continuity default; DIAG_MODE available — listening on ' + PORT)
);
