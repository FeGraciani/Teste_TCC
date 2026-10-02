# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# Alento — imagem de produção (Next.js "standalone", usuário sem privilégios)
#   docker build -t alento .
#   docker build -t alento-migracoes --target migrations .
# ─────────────────────────────────────────────────────────────

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Imagem auxiliar para aplicar migrações e criar o primeiro acesso:
#   docker run --rm -e DATABASE_URL=... alento-migracoes
#   docker run --rm -it -e DATABASE_URL=... alento-migracoes npm run admin:create
FROM build AS migrations
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S alento && adduser -S alento -G alento
COPY --from=build --chown=alento:alento /app/public ./public
COPY --from=build --chown=alento:alento /app/.next/standalone ./
COPY --from=build --chown=alento:alento /app/.next/static ./.next/static
USER alento
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/saude || exit 1
CMD ["node", "server.js"]
