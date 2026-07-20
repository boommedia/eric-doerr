/**
 * Elite Labs data helpers — fetch commander data from EDSM / Inara.
 * Used by the site server (../server.js) so API keys stay server-side.
 */
const https = require('https');

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'elite-labs' } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Bad JSON from ' + url + ': ' + body.slice(0, 160))); }
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
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'elite-labs' } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Bad JSON from ' + url + ': ' + body.slice(0, 160))); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Timeout contacting ' + url)));
    req.write(data);
    req.end();
  });
}

async function edsm(cmdr, key) {
  if (!cmdr || !key) {
    throw new Error('EDSM not configured — set EDSM_CMDR and EDSM_KEY environment variables in Coolify (or pass ?cmdr=&key=).');
  }
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
    ships && ships.ships && typeof ships.ships === 'object'
      ? Object.values(ships.ships).map((s) => ({ name: s.name || null, type: s.type || s.shipName || null, system: s.starsystem || null }))
      : [];

  return {
    source: 'edsm',
    commander: cmdr,
    system: (position && position.system) || null,
    credits: balance,
    ranks: (ranks && (ranks.ranksVerbose || ranks.ranks)) || null,
    ships: shipList,
    notes: balance === null ? 'No credits returned — enable credits sharing in your EDSM settings and make sure EDMC/EDDiscovery is uploading your journal.' : undefined,
  };
}

async function inara(cmdr, apiKey, appName) {
  if (!apiKey) throw new Error('Inara not configured — set INARA_API_KEY in Coolify.');
  const payload = {
    header: {
      appName: appName || 'EliteLabsCenter',
      appVersion: '1.0.0',
      isBeingDeveloped: true,
      APIkey: apiKey,
      commanderName: cmdr || undefined,
    },
    events: [{ eventName: 'getCommanderProfile', eventTimestamp: new Date().toISOString(), eventData: { searchName: cmdr || '' } }],
  };
  const res = await postJSON('https://inara.cz/inapi/v1/', payload);
  const ev = res && Array.isArray(res.events) ? res.events[0] : null;
  return {
    source: 'inara',
    status: (res && res.header && res.header.eventStatus) || null,
    statusText: (res && res.header && res.header.eventStatusText) || null,
    profile: (ev && ev.eventData) || null,
  };
}

module.exports = { edsm, inara };
