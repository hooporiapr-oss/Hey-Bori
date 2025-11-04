// Minimal zero-dependency server — Hey Bori
const http = require('http');
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
if (req.url === '/healthz') {
res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
return res.end('ok');
}

res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
res.end(`<!doctype html>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Hey Bori — Minimal</title>
<main style="font-family:system-ui;-webkit-font-smoothing:antialiased;max-width:720px;margin:12vh auto;padding:0 16px">
<h1>Hey Bori is alive ✅</h1>
<p>Server time: <code>${new Date().toISOString()}</code></p>
<p>Health check: <a href="/healthz">/healthz</a></p>
</main>`);
});

server.on('listening', () => {
console.log(`✅ Minimal zero-dep server listening on ${PORT}`);
});
server.on('error', (err) => {
console.error('Server error:', err && err.stack ? err.stack : err);
});
server.listen(PORT);
