# syntax=docker/dockerfile:1
# Imagen única para todos los clientes (Dokploy): un contenedor por
# restaurante, cada uno con sus env vars (DATABASE_URL, BETTER_AUTH_URL,
# NEXT_PUBLIC_BASE_URL, BETTER_AUTH_SECRET).

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.ts ya usa output: standalone
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# migrate necesita el esquema + script (node puro, sin devDeps)
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/schema.sql ./src/lib/schema.sql
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@neondatabase ./node_modules/@neondatabase
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# La migración es idempotente (IF NOT EXISTS): corre en cada arranque.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
