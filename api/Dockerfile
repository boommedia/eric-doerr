# Elite Labs API proxy — zero-dependency Node service
# Deployed as its own Coolify resource (Base Directory: /api, Port: 3000)
FROM node:22-alpine

WORKDIR /app
COPY server.js .

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
