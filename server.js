/**
 * Home Projects Hub — static site server + Elite Labs API
 * -------------------------------------------------------
 * Serves every .html page in this repo exactly like before, and adds
 * live-data endpoints so the Elite Labs Center can pull real commander
 * data with no CORS issues and no API keys in the page source.
 *
 *   GET /health      -> { ok: true }
 *   GET /api/edsm    -> system, credits, ranks, ships (EDSM)
 *   GET /api/inara   -> commander profile (Inara)
 *
 * Configure in Coolify → Environment Variables:
 *   EDSM_CMDR, EDSM_KEY, INARA_API_KEY, INARA_APP_NAME, INARA_CMDR
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { edsm, inara } = require('./api/lib.js');

const ROOT = __dirname;
// Coolify/Nixpacks normally injects PORT. If it doesn't, fall back to 80
// (this resource previously served nginx on 80); if 80 can't be bound,
// retry on 3000 so the site can never fail to come up.
const PORT = Number(process.env.PORT) || 80;
const FALLBACK_PORT = 3000;
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj, null, 2));
}

function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  });
  res.writeHead(200, { 'Content-Type': type });
  stream.pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404 — Not found</h1><p><a href="/">Back to the hub</a></p>');
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return notFound(res); }

  // ---- API routes ----
  try {
    if (url.pathname === '/health') {
      return sendJSON(res, 200, {
        ok: true,
        service: 'home-projects-hub',
        edsmConfigured: Boolean(process.env.EDSM_CMDR && process.env.EDSM_KEY),
        inaraConfigured: Boolean(process.env.INARA_API_KEY),
        endpoints: ['/api/edsm', '/api/inara'],
      });
    }
    if (url.pathname === '/api/edsm') {
      const cmdr = url.searchParams.get('cmdr') || process.env.EDSM_CMDR;
      const key = url.searchParams.get('key') || process.env.EDSM_KEY;
      return sendJSON(res, 200, await edsm(cmdr, key));
    }
    if (url.pathname === '/api/inara') {
      const cmdr = url.searchParams.get('cmdr') || process.env.INARA_CMDR || process.env.EDSM_CMDR;
      const key = url.searchParams.get('key') || process.env.INARA_API_KEY;
      return sendJSON(res, 200, await inara(cmdr, key, process.env.INARA_APP_NAME));
    }
  } catch (err) {
    return sendJSON(res, 200, { error: err.message || String(err) });
  }

  // ---- static files ----
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return notFound(res); }

  if (pathname.includes('\0') || pathname.split('/').some((seg) => seg.startsWith('.') && seg !== '')) {
    return notFound(res);
  }

  let filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) return notFound(res); // traversal guard

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      const idx = path.join(filePath, 'index.html');
      return fs.existsSync(idx) ? sendFile(res, idx) : notFound(res);
    }
    if (!err && stat.isFile()) return sendFile(res, filePath);

    // /foo -> /foo.html, then /foo/index.html
    const asHtml = filePath + '.html';
    if (fs.existsSync(asHtml)) return sendFile(res, asHtml);
    const asIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(asIndex)) return sendFile(res, asIndex);
    return notFound(res);
  });
});

server.on('error', (err) => {
  if ((err.code === 'EACCES' || err.code === 'EADDRINUSE') && server.__retried !== true) {
    server.__retried = true;
    console.warn(`Could not bind :${PORT} (${err.code}) — falling back to :${FALLBACK_PORT}`);
    server.listen(FALLBACK_PORT, HOST, () => console.log(`Home Projects Hub listening on ${HOST}:${FALLBACK_PORT}`));
    return;
  }
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, HOST, () => console.log(`Home Projects Hub listening on ${HOST}:${PORT}`));
