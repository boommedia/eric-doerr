# Elite Labs live data API

The site now runs on a tiny Node server (`../server.js`) that serves **all the existing
HTML pages exactly as before**, plus these live-data endpoints. Keys stay server-side,
and because it's the same domain there are **no CORS problems**.

| Endpoint | Returns |
|---|---|
| `GET /health` | `{ok:true}` + whether EDSM/Inara keys are configured |
| `GET /api/edsm` | current **system**, **credits**, **ranks**, **ships** |
| `GET /api/inara` | commander **profile** |

`?cmdr=` and `?key=` query params override the env vars (handy for a quick test).

## Setup — add your keys in Coolify

Coolify → your `eric-doerr` app → **Environment Variables** → add:

| Variable | Required | What it is |
|---|---|---|
| `EDSM_CMDR` | yes (for live data) | Your commander name, e.g. `BOOMINC420` |
| `EDSM_KEY` | yes (for live data) | EDSM → your profile → **API key** |
| `INARA_API_KEY` | optional | Inara → Profile → **API keys** → create one |
| `INARA_APP_NAME` | optional | App name tied to the Inara key (default `EliteLabsCenter`) |
| `INARA_CMDR` | optional | Commander name for Inara (falls back to `EDSM_CMDR`) |

Then **Redeploy**. Check `https://<your-domain>/health` — `edsmConfigured` should be `true`.

Finally, open **Elite Labs Center → Live sync**, leave the API base URL blank (same domain)
or enter your site URL, and hit **Sync now**.

## Prerequisite (important)

EDSM only knows what your game uploads to it. You must be running
[EDMarketConnector](https://github.com/EDCD/EDMarketConnector) or EDDiscovery with EDSM
syncing enabled, and **credits sharing turned on in your EDSM settings** — otherwise the
endpoint returns no credits.

**Inara** returns your *public profile* (ranks, squadron). Its API is designed for apps
*sending* data in, so it is **not** a source of live private credits — EDSM is.

## Deployment notes

- Build pack: **Nixpacks** detects `package.json` and runs `npm start` → `node server.js`.
- The server listens on `$PORT`, falling back to `80`, then `3000`.
- `Dockerfile` (nginx) is kept only as a static-only fallback; Nixpacks ignores it.

## Run locally

```bash
PORT=8099 EDSM_CMDR="YourCmdr" EDSM_KEY="yourkey" node server.js
# http://localhost:8099/health
```
