# =============================================================================
# Video transcoding worker — Node + ffmpeg
#
# This is the only image that carries ffmpeg. Keeping it out of the API image
# means the API stays small and the CPU-heavy work scales on its own:
#
#   docker compose up -d --scale worker=3
#
# BUILD CONTEXT IS THE REPOSITORY ROOT (see docker-compose.yml), because the
# worker reuses the backend's Prisma schema rather than keeping a second copy
# that could drift out of sync.
# =============================================================================

FROM node:22-alpine AS deps

WORKDIR /app

COPY workers/package*.json ./
RUN npm install --no-audit --no-fund --ignore-scripts

# --- Build -------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY workers/ ./

# One schema, one source of truth for the data model.
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts

# Prisma 7 requires the variable to exist at generate time; no connection is
# opened, so a placeholder keeps the build hermetic.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate

RUN npm run build && npm prune --omit=dev

# --- Runtime -----------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# ffmpeg + ffprobe are the whole point of this image.
RUN apk add --no-cache ffmpeg dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S -u 1001 -G nodejs worker

ENV NODE_ENV=production
ENV TZ=UTC

COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/package.json ./package.json

# Transcoding writes to a temp dir; give the unprivileged user somewhere to do it.
RUN mkdir -p /tmp/transcode && chown worker:nodejs /tmp/transcode
ENV TMPDIR=/tmp/transcode

USER worker

# No HTTP surface to probe. Liveness here is "the process is up"; queue depth
# and job failures are observed via the admin dashboard and the video_jobs table.
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "process.exit(0)"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/transcode.worker.js"]
