# Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache git openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

RUN apk add --no-cache git curl openssl su-exec

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone Next.js server (includes bundled minimal node_modules)
COPY --from=builder /app/.next/standalone ./
# Full node_modules from builder (superset of standalone's — needed for prisma & tsx)
COPY --from=builder /app/node_modules ./node_modules

# Static assets
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema + migrations for migrate deploy
COPY --from=builder /app/prisma ./prisma

# Scripts and lib needed by entrypoint init
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json

COPY entrypoint.sh /entrypoint.sh

RUN chown -R nextjs:nodejs /app && \
    chmod +x /entrypoint.sh

# Entrypoint runs as root to handle /data permissions, then drops to nextjs

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/sqlite.db
ENV DISTILL_GIT_BASE_PATH=/data/repos

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
