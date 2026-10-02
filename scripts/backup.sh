#!/usr/bin/env bash
#
# Backup: PostgreSQL + object storage.
#
#   ./scripts/backup.sh
#
# Cron it daily:
#   0 2 * * * /opt/amr/scripts/backup.sh >> /var/log/amr-backup.log 2>&1
#
# The database is the business. Video can be re-uploaded; orders, entitlements
# and student progress cannot be reconstructed.
#
# A backup on the same host is not a backup — set BACKUP_REMOTE to push it
# off-box.
#
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/amr}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
# e.g. BACKUP_REMOTE=s3:amr-backups  (any rclone remote)
BACKUP_REMOTE="${BACKUP_REMOTE:-}"

cd "$PROJECT_DIR"

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

: "${POSTGRES_USER:?POSTGRES_USER must be set (check .env)}"
: "${POSTGRES_DB:?POSTGRES_DB must be set (check .env)}"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/videos"

log() { printf '[backup %s] %s\n' "$(date -Iseconds)" "$*"; }

# ---------------------------------------------------------------------------
# Database
#
# -Fc is the custom format: compressed, and restorable selectively with
# pg_restore. Written to a .partial file first so an interrupted run never
# leaves a truncated dump that looks complete.
# ---------------------------------------------------------------------------
log "dumping database ${POSTGRES_DB}"
DUMP="$BACKUP_DIR/db-$STAMP.dump"

docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$DUMP.partial"

mv "$DUMP.partial" "$DUMP"
log "database dump: $(du -h "$DUMP" | cut -f1)"

# Refuse to continue on a suspiciously small dump — an empty file is worse
# than no file, because it looks like a successful backup.
if [ "$(stat -c%s "$DUMP" 2>/dev/null || stat -f%z "$DUMP")" -lt 10000 ]; then
  log "ERROR: dump is implausibly small; not rotating old backups"
  exit 1
fi

# ---------------------------------------------------------------------------
# Object storage
#
# `mc mirror` is incremental, so only new lesson videos transfer after the
# first run.
# ---------------------------------------------------------------------------
if [ "${SKIP_VIDEO_BACKUP:-false}" != "true" ]; then
  log "mirroring object storage"
  docker compose exec -T minio \
    mc mirror --overwrite --quiet "local/${S3_BUCKET_VIDEOS:-amr-videos}" /tmp/backup-videos \
    2>/dev/null || log "WARNING: video mirror failed (continuing — the database dump is the critical part)"
fi

# ---------------------------------------------------------------------------
# Rotation
# ---------------------------------------------------------------------------
log "removing dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.dump' -mtime "+$RETENTION_DAYS" -delete

# ---------------------------------------------------------------------------
# Off-site
# ---------------------------------------------------------------------------
if [ -n "$BACKUP_REMOTE" ]; then
  if command -v rclone >/dev/null 2>&1; then
    log "copying to $BACKUP_REMOTE"
    rclone copy "$BACKUP_DIR" "$BACKUP_REMOTE"
  else
    log "WARNING: BACKUP_REMOTE is set but rclone is not installed"
  fi
else
  log "NOTE: BACKUP_REMOTE is unset — this backup exists only on this host"
fi

log "done: $DUMP"
log "Restore with: docker compose exec -T postgres pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists < $DUMP"
log "TEST YOUR RESTORE. An untested backup is a guess."
