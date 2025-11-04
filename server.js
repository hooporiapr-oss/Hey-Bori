// Hey Bori — Safe Boot Probe (no deps, no network at boot)

// Hard guard: never die on unhandled errors
process.on('uncaughtException', (e) => {
console.error('[uncaughtException]', e && e.stack ? e.stack : e);
});
process.on('unhandledRejection', (e) => {
console.error('[unhandledRejection]', e && e.stack ? e.stack : e);
});

const http = require('http');
const os = require('os');

const PORT = Number(process.env.PORT || 10000);
const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || 'hey-bori';
const NODE = process.version;

console.log('--- BOOT DIAGNOSTICS ---');
console.log('Service:', SERVICE_NAME);
console.log('Node:', NODE);
console.log('PORT env:', process.env.PORT || '(not set)'); // Render usually sets this
console.log('CWD:', process.cwd());
console.log('Files at root should be server.js + package.json');
console.log('------------------------');

const html = (title, body) => `<!doctype html>
<meta charset="utf-8"/>
<title>${title}</title>
<style>body{font-family:system-ui;margin:10vh auto;max-width:720px;padding:0 16px}</style>
<h1>${title}</h1>
<pre>${body}</pre>
<p>Health: <a href="/healthz">/healthz</a></p>`;

const server = http.createServer((req, res) => {
try {
if (req.url === '/healthz') {
res.writeHead(200, {'content-type':'text/plain; charset=utf-8'}).end('ok');
return;
}
if (req.url === '/env') {
const dump = {
node: NODE,
port_env: process.env.PORT || null,
cwd: process.cwd(),
pid: process.pid,
platform: process.platform,
uptime_s: process.uptime(),
};
res.writeHead(200, {'content-type':'application/json; charset=utf-8'})
.end(JSON.stringify(dump, null, 2));
return;
}
res.writeHead(200, {'content-type':'text/html; charset=utf-8'})
.end(html('Hey Bori — Safe Boot OK ✅', `Node: ${NODE}\nPORT: ${PORT}\nHostname: ${os.hostname()}`));
} catch (e) {
console.error('[request error]', e && e.stack ? e.stack : e);
res.writeHead(500, {'content-type':'text/plain; charset=utf-8'}).end('Internal Server Error');
}
});

server.listen(PORT, () => {
console.log(`✅ Safe Boot Probe listening on ${PORT}`);
});
