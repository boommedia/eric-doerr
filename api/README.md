# Elite Labs API proxy

A tiny zero-dependency Node service that fetches your Elite Dangerous commander data
**server-side**, so the static site can show live data without CORS issues and without
ever exposing your API keys in the page source.

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /health` | `{ ok: true }` — use this to confirm it's running |
| `GET /api/edsm` | current **system**, **credits**, **ranks**, **ships** (from EDSM) |
| `GET /api/inara` | commander **profile** (from Inara) |

`?cmdr=` and `?key=` query params override the env vars, handy for testing.

## Deploy on Coolify (one new resource)

1. Coolify → **New Resource → Public/Private Git Repository**
2. Repository: `https://github.com/boommedia/eric-doerr.git`, Branch: `main`
3. **Base Directory:** `/api`  ← important, this is what keeps it separate from the website
4. **Build Pack:** `Dockerfile`
5. **Port:** `3000`
6. Add a domain (e.g. `api.yourdomain.com`) → Coolify issues HTTPS
7. Add the **environment variables** below
8. Deploy, then open `https://api.yourdomain.com/health` — you should see `{"ok":true}`

Finally, paste that base URL into the **Elite Labs Center → Live sync → API base URL**
field on the website and hit **Sync now**.

## Environment variables

| Variable | Required | What it is |
|---|---|---|
| `EDSM_CMDR` | for EDSM | Your commander name (e.g. `BOOMINC420`) |
| `EDSM_KEY` | for EDSM | EDSM API key — EDSM → your profile → API key |
| `INARA_API_KEY` | for Inara | Inara → Profile → **API keys** → create one |
| `INARA_APP_NAME` | optional | App name registered with the Inara key (default `EliteLabsCenter`) |
| `INARA_CMDR` | optional | Commander name for Inara (falls back to `EDSM_CMDR`) |
| `ALLOW_ORIGIN` | recommended | Your website origin, e.g. `https://yourdomain.com` (default `*`) |
| `PORT` | no | Defaults to `3000` |

> **Keys live only in Coolify's env vars — never commit them to the repo.**
> Set `ALLOW_ORIGIN` to your site's URL so only your site can call the proxy.

## Where the data comes from

- **EDSM** gives the useful live numbers (credits, current system, ships, ranks) — but only
  if you're **uploading your journal to EDSM** via
  [EDMarketConnector](https://github.com/EDCD/EDMarketConnector) or EDDiscovery.
  No journal upload = no data to read.
- **Inara** returns your **public commander profile** (ranks, squadron, etc.). Inara's API is
  designed mainly for apps *sending* data in, so it is not a source of live private credits.

## Run locally

```bash
EDSM_CMDR="YourCmdr" EDSM_KEY="yourkey" node api/server.js
# then: http://localhost:3000/api/edsm
```
