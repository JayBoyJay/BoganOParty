// Bogan-o Party — optional local server (adapted from Marble Mayhem).
// The game normally runs from GitHub Pages with phones connecting peer-to-peer. This server is for
// playing on your own Wi-Fi without internet: it serves the site and relays phone messages over WebSockets.
// No npm install needed: run `node server/server.js` (or start.bat).

const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer } = require('./lib/ws');
const QRCode = require('./lib/qrcode');
const QRErrorCorrectLevel = require('./lib/qrcode/QRErrorCorrectLevel');

const PORT = Number(process.env.PORT) || 3000;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || PORT + 443;
const CERT_DIR = path.join(__dirname, 'certs');
const PUBLIC = path.join(__dirname, '..');
const HIDDEN = /^[\\/](server|\.github|\.git)([\\/]|$)/;

// ---------- network helpers ----------
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      let score = 0;
      if (a.address.startsWith('192.168.')) score = 3;
      else if (a.address.startsWith('10.')) score = 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score = 1;
      // virtual adapters (docker, vpn, wsl) are rarely what phones can reach
      if (/docker|veth|vbox|vmnet|utun|tun|wsl|br-/i.test(name)) score -= 5;
      out.push({ name, address: a.address, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

function hostIp() { return process.env.HOST_IP || (lanAddresses()[0] || {}).address || 'localhost'; }
function joinUrl() { return `http://${hostIp()}:${PORT}/play.html`; }
function secureJoinUrl() { return httpsServer ? `https://${hostIp()}:${HTTPS_PORT}/play.html` : null; }

// HTTPS is only needed for phone tilt controls: phone browsers only give motion
// sensor data to secure pages. A self-signed certificate is bundled in ./certs
// (phones will show a one-time "not private" warning to tap through).
function loadCert() {
  const key = path.join(CERT_DIR, 'key.pem'), cert = path.join(CERT_DIR, 'cert.pem');
  if (!fs.existsSync(key) || !fs.existsSync(cert)) {
    try {
      fs.mkdirSync(CERT_DIR, { recursive: true });
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '3650', '-subj', '/CN=bogan-o-party.local'], { stdio: 'ignore' });
    } catch { return null; }
  }
  try { return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) }; } catch { return null; }
}

function qrMatrix(text) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text);
  qr.make();
  return qr.modules; // 2D array of booleans
}

function qrSvg(text) {
  const m = qrMatrix(text);
  const n = m.length, pad = 3, size = n + pad * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) d += `M${x + pad} ${y + pad}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}

function qrTerminal(text) {
  const m = qrMatrix(text);
  const n = m.length;
  const get = (x, y) => (y >= 0 && y < n && x >= 0 && x < n ? m[y][x] : false);
  let out = '';
  for (let y = -2; y < n + 2; y += 2) {
    let line = '  ';
    for (let x = -2; x < n + 2; x++) {
      const top = get(x, y), bottom = get(x, y + 1);
      line += top && bottom ? ' ' : top ? '▄' : bottom ? '▀' : '█';
    }
    out += line + '\n';
  }
  return out;
}

// ---------- static files ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '/host') return serveFile(res, path.join(PUBLIC, 'index.html'));
  if (p === '/play' || p === '/play/') return serveFile(res, path.join(PUBLIC, 'play.html'));
  if (HIDDEN.test(p)) { res.writeHead(404); res.end(); return; }
  if (p === '/api/info') {
    const u = joinUrl();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    const su = secureJoinUrl();
    res.end(JSON.stringify({ server: 'bogan-o-party', url: u, qr: qrSvg(u), secureUrl: su, qrSecure: su ? qrSvg(su) : null, addresses: lanAddresses().map((a) => a.address) }));
    return;
  }
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  serveFile(res, file);
}
const server = http.createServer(handle);
const tls = loadCert();
const httpsServer = tls ? https.createServer(tls, handle) : null;

// ---------- relay ----------
// The TV screen is the "host" and owns all game state. The server only
// remembers which phone is which (by a stable id kept in the phone's storage)
// so a phone that locks its screen can reconnect to the same player.
const wss = new WebSocketServer({ noServer: true });
for (const srv of [server, httpsServer]) {
  if (!srv) continue;
  srv.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
}
let host = null;
const phones = new Map(); // pid -> ws

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

wss.on('connection', (ws) => {
  ws.role = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (!ws.role) {
      if (msg.t === 'host') {
        if (host && host !== ws) { send(host, { t: 'replaced' }); host.close(); }
        host = ws; ws.role = 'host';
        send(ws, { t: 'phones', pids: [...phones.keys()] });
        for (const p of phones.values()) send(p, { t: 'hostup' });
        console.log('  TV screen connected');
      } else if (msg.t === 'phone') {
        let pid = typeof msg.pid === 'string' && /^[a-z0-9]{6,20}$/.test(msg.pid) ? msg.pid : crypto.randomBytes(5).toString('hex');
        const old = phones.get(pid);
        if (old && old !== ws) { old.replaced = true; send(old, { t: 'moved' }); old.close(); }
        ws.role = 'phone'; ws.pid = pid; phones.set(pid, ws);
        send(ws, { t: 'welcome', pid, host: !!host });
        send(host, { t: 'phone-connect', pid });
      }
      return;
    }

    if (ws.role === 'phone') {
      send(host, { t: 'phone-msg', pid: ws.pid, msg });
    } else if (ws.role === 'host') {
      if (msg.t === 'send') send(phones.get(msg.pid), msg.msg);
      else if (msg.t === 'broadcast') for (const p of phones.values()) send(p, msg.msg);
      else if (msg.t === 'kick') { const p = phones.get(msg.pid); if (p) { send(p, { t: 'kicked' }); } }
    }
  });

  ws.on('close', () => {
    if (ws.role === 'host' && host === ws) {
      host = null;
      for (const p of phones.values()) send(p, { t: 'nohost' });
      console.log('  TV screen disconnected');
    } else if (ws.role === 'phone' && phones.get(ws.pid) === ws) {
      phones.delete(ws.pid);
      if (!ws.replaced) send(host, { t: 'phone-disconnect', pid: ws.pid });
    }
  });
});

// keep connections alive through phone sleep / wifi power saving
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 15000);
wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });

server.listen(PORT, '0.0.0.0', () => {
  const u = joinUrl();
  console.log('\n  BOGAN-O PARTY is running\n');
  console.log(`  TV screen (open on the TV / laptop):    http://localhost:${PORT}`);
  console.log(`  Phones join at:                        ${u}\n`);
  console.log(qrTerminal(u));
  const others = lanAddresses().slice(1);
  if (others.length) console.log(`  If phones can't connect, try another address: ${others.map((a) => a.address).join(', ')}\n  (set it with HOST_IP=x.x.x.x npm start)\n`);
});
if (httpsServer) {
  httpsServer.on('error', (e) => console.log(`  (Secure link for phone tilt controls unavailable: ${e.message})`));
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => console.log(`  Secure link for phone tilt controls:         ${secureJoinUrl()}\n`));
}
