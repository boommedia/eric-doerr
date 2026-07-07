# Static site served by nginx — used by Coolify (Dockerfile build pack)
# Serves index.html (landing) + every other .html page in this repo.
FROM nginx:alpine

# Copy the whole site into the web root (.dockerignore filters out non-web files)
COPY . /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
