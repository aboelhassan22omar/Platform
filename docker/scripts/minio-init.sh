#!/bin/sh
# Creates the platform buckets. Idempotent — safe to re-run on every `up`.
set -e

echo "[minio-init] waiting for MinIO..."
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  sleep 2
done

# Private bucket: lesson videos and HLS renditions. Never made public — the API
# hands out short-lived presigned URLs after checking entitlements.
mc mb --ignore-existing "local/$S3_BUCKET_VIDEOS"
mc anonymous set none "local/$S3_BUCKET_VIDEOS"

# Public bucket: thumbnails, posters and brand artwork. Safe to serve directly.
mc mb --ignore-existing "local/$S3_BUCKET_PUBLIC"
mc anonymous set download "local/$S3_BUCKET_PUBLIC"

echo "[minio-init] buckets ready: $S3_BUCKET_VIDEOS (private), $S3_BUCKET_PUBLIC (public-read)"
