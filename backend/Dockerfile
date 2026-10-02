# =============================================================================
# Backend API — NestJS
#
# Multi-stage: dependencies are installed once, the app is compiled in a
# throwaway stage, and only the production artefacts land in the final image.
# =============================================================================

# --- Stage 1: install every dependency (including dev, needed to build) ------
FROM node:22-alpine AS deps

WORKDIR /app

# Copied alone so this layer is cached until the manifests actually change.
COPY package*.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts

# --- Stage 2: generate the Prisma client and compile TypeScript --------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma 7 reads the datasource URL from prisma.config.ts, which requires the
# variable to exist at generate time. The value is irrelevant here — no
# connection is opened — so a placeholder keeps the build hermetic.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate

RUN npm run build

# --- Stage 3: production dependency tree ------------------------------------
# Keep `builder` testable for CI. Pruning in a separate stage prevents the
# production optimisation from deleting Jest/TypeScript before tests run.
FROM builder AS production-deps
RUN npm prune --omit=dev

# --- Stage 4: runtime --------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# dumb-init reaps zombies and forwards signals, so SIGTERM reaches Node and
# Nest's shutdown hooks actually run.
RUN apk add --no-cache dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S -u 1001 -G nodejs nestjs

ENV NODE_ENV=production
ENV TZ=UTC

COPY --from=production-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Migrations and the seed run from this image too (see the `migrate`, `seed`
# and `bootstrap-admin` services in docker-compose.yml).
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
