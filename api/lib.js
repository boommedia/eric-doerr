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

/* ---- Nearby home-base finder (public EDSM data, no key needed) ---- */
async function nearby(systemName, radius, factionsCsv) {
  if (!systemName) throw new Error('Provide ?system= (your current system name).');
  radius = Math.min(Math.max(parseInt(radius, 10) || 20, 5), 40);
  const url = `https://www.edsm.net/api-v1/sphere-systems?systemName=${encodeURIComponent(systemName)}&radius=${radius}&showInformation=1`;
  const list = await getJSON(url);
  if (!Array.isArray(list) || !list.length) {
    return { system: systemName, radius, count: 0, candidates: [],
      note: 'No systems found — EDSM may not know this system, or you are in deep space with nothing populated nearby (a Fleet Carrier is your only "home" out here).' };
  }
  const fset = new Set((factionsCsv || '').split('|').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const populated = list
    .filter((s) => s.information && (s.information.population || 0) > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 14);

  const out = [];
  for (const s of populated) {
    const rings = new Set();
    try {
      const b = await getJSON(`https://www.edsm.net/api-system-v1/bodies?systemName=${encodeURIComponent(s.name)}`);
      if (b && Array.isArray(b.bodies)) {
        for (const body of b.bodies) {
          if (Array.isArray(body.rings)) {
            for (const r of body.rings) {
              const t = (r.type || '').toLowerCase();
              if (t.includes('icy')) rings.add('Icy');
              else if (t.includes('metal')) rings.add('Metallic');
              else if (t.includes('rocky')) rings.add('Rocky');
            }
          }
        }
      }
    } catch (e) { /* body data optional */ }

    const info = s.information || {};
    const faction = info.faction || '';
    const friendly = fset.has(faction.toLowerCase());
    let score = 0;
    if (friendly) score += 3;
    if (rings.has('Icy')) score += 3;         // Void Opals / LTDs
    if (rings.has('Metallic')) score += 2;    // Painite / Platinum
    if (rings.size) score += 2;               // any ring => RES potential
    if ((info.population || 0) > 0) score += 1;

    out.push({
      name: s.name,
      distance: Math.round(s.distance * 100) / 100,
      faction, friendly,
      allegiance: info.allegiance || null,
      economy: info.economy || null,
      security: info.security || null,
      population: info.population || 0,
      rings: [...rings],
      score,
    });
  }
  out.sort((a, b) => b.score - a.score || a.distance - b.distance);
  return { system: systemName, radius, count: out.length, candidates: out };
}

module.exports = { edsm, inara, nearby };
