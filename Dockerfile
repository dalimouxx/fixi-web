# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY package*.json ./
# Cache npm + Prisma entre les builds. Le retry externe est volontaire :
# les téléchargements @prisma/engines sont effectués dans un postinstall et
# n'utilisent pas toujours les retries npm. Une coupure ECONNRESET ne doit
# donc pas forcer l'utilisateur à recommencer manuellement tout le build.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.cache/prisma \
    set -eux; \
    npm config set registry https://registry.npmjs.org/; \
    npm config set fetch-retries 10; \
    npm config set fetch-retry-mintimeout 20000; \
    npm config set fetch-retry-maxtimeout 120000; \
    npm config set fetch-timeout 600000; \
    npm config set prefer-offline true; \
    success=0; \
    for attempt in 1 2 3 4 5; do \
      echo "=== npm install / Prisma engines : tentative ${attempt}/5 ==="; \
      if npm install --no-audit --no-fund; then success=1; break; fi; \
      echo "Téléchargement interrompu. Nouvelle tentative après $((attempt * 15)) s..."; \
      sleep $((attempt * 15)); \
    done; \
    test "$success" = "1"

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://fixi:build@localhost:5432/fixi?schema=public
ENV AUTH_SECRET=build-secret-only-not-used-at-runtime-123456789
ENV PLATFORM_AUTH_SECRET=build-platform-secret-only-not-used-runtime
ENV DATA_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /app/data/uploads /app/data/platform-media && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["sh","-c","npx prisma db push --skip-generate && node server.js"]
