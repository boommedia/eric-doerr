# Static site served by nginx — used by Coolify (Dockerfile build pack)
FROM nginx:alpine

# Serve our HTML at the web root
COPY index.html /usr/share/nginx/html/index.html

# nginx listens on 80 by default; tell Coolify to map to this port
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
