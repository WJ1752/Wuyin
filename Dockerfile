# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS tooling
WORKDIR /app
RUN npm install --global pnpm@12.15.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM tooling AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM tooling AS production-dependencies
RUN pnpm install --frozen-lockfile --prod

FROM node:24-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_PATH=/app/data/wuyin.sqlite
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/server ./server
RUN mkdir -p /app/data /app/backups && chown node:node /app/data /app/backups
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health', {signal: AbortSignal.timeout(3000)}).then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts"]

FROM caddy:2-alpine AS proxy
RUN mkdir -p /data /config && chown -R 1000:1000 /data /config
COPY deploy/Caddyfile /etc/caddy/Caddyfile
USER 1000:1000
EXPOSE 8080 8443
