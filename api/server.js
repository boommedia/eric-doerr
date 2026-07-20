/**
 * Elite Labs API proxy
 * -------------------------------------------------------------
 * Tiny zero-dependency Node service that fetches Elite Dangerous
 * commander data server-side, so the static site can display it
 * without CORS problems and without exposing API keys.
 *
 * Endpoints:
 *   GET /health          -> { ok: true }
 *   GET /api/edsm        -> position, credits, ranks, ships (EDSM)
 *   GET /api/inara       -> commander profile (Inara)
 *
 * Credentials come from environment variables (set them in Coolify):
 *   EDSM_CMDR, EDSM_KEY
 *   INARA_API_KEY, INARA_APP_NAME, INARA_CMDR
 *   ALLOW_ORIGIN  (default "*"), PORT (default 3000)
 *
 * Query params ?cmdr= and ?key= override the env values for testing.
 */
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'elite-labs-proxy' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Bad JSON from ' + url + ': ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Timeout contacting ' + url)));
  });
}

function postJSON(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'elite-labs-proxy' } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Bad JSON from ' + url + ': ' + body.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Timeout contacting ' + url)));
    req.write(data);
    req.end();
  });
}

/* ---------------- EDSM ---------------- */
async function edsm(cmdr, key) {
  if (!cmdr || !key) throw new Error('Missing EDSM commander name or API key (set EDSM_CMDR and EDSM_KEY).');
  const q = `commanderName=${encodeURIComponent(cmdr)}&apiKey=${encodeURIComponent(key)}`;
  const [position, credits, ranks, ships] = await Promise.all([
    getJSON(`https://www.edsm.net/api-logs-v1/get-position?${q}&showCoordinates=1`).catch((e) => ({ error: e.message })),
    getJSON(`https://www.edsm.net/api-commander-v1/get-credits?${q}`).catch((e) => ({ error: e.message })),
    getJSON(`https://www.edsm.net/api-commander-v1/get-ranks?${q}`).catch((e) => ({ error: e.message })),
    getJSON(`https://www.edsm.net/api-commander-v1/get-ships?${q}`).catch((e) => ({ error: e.message })),
  ]);

  const balance =
    credits && Array.isArray(credits.credits) && credits.credits.length && typeof credits.credits[0].balance === 'number'
      ? credits.credits[0].balance
      : null;

  const shipList =
    ships && ships.ships
      ? Object.values(ships.ships).map((s) => ({ name: s.name || null, type: s.type || s.shipName || null, system: s.starsystem || null }))
      : [];

  return {
    source: 'edsm',
    commander: cmdr,
    system: (position && position.system) || null,
    coordinates: (position && position.coordinates) || null,
    credits: balance,
    ranks: (ranks && ranks.ranksVerbose) || (ranks && ranks.ranks) || null,
    ships: shipList,
    raw: { position, credits, ranks, ships },
  };
}

/* ---------------- Inara ---------------- */
async function inara(cmdr, apiKey, appName) {
  if (!apiKey) throw new Error('Missing Inara API key (set INARA_API_KEY).');
  const payload = {
    header: {
      appName: appName || 'EliteLabsCenter',
      appVersion: '1.0.0',
      isBeingDeveloped: true,
      APIkey: apiKey,
      commanderName: cmdr || undefined,
    },
    events: [
      {
        eventName: 'getCommanderProfile',
        eventTimestamp: new Date().toISOString(),
        eventData: { searchName: cmdr || '' },
      },
    ],
  };
  const res = await postJSON('https://inara.cz/inapi/v1/', payload);
  const ev = res && Array.isArray(res.events) ? res.events[0] : null;
  return {
    source: 'inara',
    status: (res && res.header && res.header.eventStatus) || null,
    statusText: (res && res.header && res.header.eventStatusText) || null,
    profile: (ev && ev.eventData) || null,
    raw: res,
  };
}

/* ---------------- server ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (code, obj) => {
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(obj, null, 2));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    });
    return res.end();
  }

  try {
    if (url.pathname === '/health' || url.pathname === '/') {
      return send(200, { ok: true, service: 'elite-labs-api', endpoints: ['/api/edsm', '/api/inara'] });
    }
    if (url.pathname === '/api/edsm') {
      const cmdr = url.searchParams.get('cmdr') || process.env.EDSM_CMDR;
      const key = url.searchParams.get('key') || process.env.EDSM_KEY;
      return send(200, await edsm(cmdr, key));
    }
    if (url.pathname === '/api/inara') {
      const cmdr = url.searchParams.get('cmdr') || process.env.INARA_CMDR || process.env.EDSM_CMDR;
      const key = url.searchParams.get('key') || process.env.INARA_API_KEY;
      return send(200, await inara(cmdr, key, process.env.INARA_APP_NAME));
    }
    return send(404, { error: 'Not found', endpoints: ['/health', '/api/edsm', '/api/inara'] });
  } catch (err) {
    return send(500, { error: err.message || String(err) });
  }
});

server.listen(PORT, () => console.log(`elite-labs-api listening on :${PORT}`));
