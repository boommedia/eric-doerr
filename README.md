# Patio & Garage Conversion Planner

A single-file, self-contained interactive budget planner (`index.html`). No build step, no
dependencies — just static HTML/CSS/JS. Edits save to the visitor's browser (localStorage).

## Deploy on Coolify

This repo works with **either** Coolify build pack. Pick one:

### Option A — Static build pack (simplest)
1. Coolify → **New Resource → Public/Private Git Repository**
2. Repository: `https://github.com/boommedia/eric-doerr.git`, Branch: `main`
3. **Build Pack: `Static`**
4. **Base/Publish Directory:** `/`  (index.html is at the repo root)
5. Deploy. Add your domain under **Domains** and Coolify issues HTTPS automatically.

### Option B — Dockerfile build pack (bulletproof, uses the included Dockerfile)
1. Same first two steps as above
2. **Build Pack: `Dockerfile`**
3. **Port: `80`**
4. Deploy → add domain → HTTPS.

## Updating the site
Edit `index.html`, commit, push. If Coolify auto-deploy (webhook) is on, it redeploys on push;
otherwise hit **Redeploy** in the Coolify UI.
