#!/usr/bin/env bash
# Read-only production health report for lesson videos.
# Runs on the server through .github/workflows/production-diagnostics.yml.
# The repository is public, so this prints NO secret values, phone numbers or
# IP addresses.
set -uo pipefail
root=/opt/amr-platform
p=amr-production
psql_q() { docker exec -i "$p-postgres-1" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<< "$1"; }
section() { printf '\n========== %s ==========\n' "$1"; }

section 'Release'
echo "current-sha: $(cat "$root/current-sha" 2>/dev/null || echo none)"
cat "$root/service-tags.env" 2>/dev/null || echo 'service-tags.env: none yet'

section 'Containers'
docker ps -a --filter "label=com.docker.compose.project=$p" --format '{{.Names}}  {{.Status}}  {{.Image}}'

section 'Object storage endpoint used for browser uploads'
grep -E '^(S3_PUBLIC_ENDPOINT|S3_PUBLIC_PORT|S3_PUBLIC_USE_SSL|S3_FORCE_PATH_STYLE|MAX_UPLOAD_BYTES|S3_BUCKET_VIDEOS)=' "$root/shared/.env"

section 'Upload path test (presigned URL for the workflow to PUT from outside)'
# The URL itself is masked by the workflow, which uploads from the internet
# like a browser does, then asks the API whether the object arrived.
docker exec -i "$p-backend-1" node - <<'JS'
const { ConfigService } = require('@nestjs/config');
const { configuration } = require('./dist/src/config/configuration');
const { StorageService } = require('./dist/src/common/storage/storage.service');
(async () => {
  const storage = new StorageService(new ConfigService(configuration()));
  const key = `diagnostics/upload-check-${Date.now()}.txt`;
  const { url } = await storage.presignUpload(storage.videoBucket, key, 300);
  console.log('presigned upload host:', new URL(url).origin);
  console.log(`UPLOAD_TEST_URL=${url}`);
  console.log(`UPLOAD_TEST_KEY=${key}`);
})().catch((e) => console.log('presign error:', e.message));
JS

section 'Lessons and video assets'
psql_q "select count(*) as lessons, count(v.id) as with_asset, count(v.\"processedAt\") as with_published_video from lessons l left join video_assets v on v.\"lessonId\" = l.id;"
psql_q "select status, count(*), count(\"hlsPrefix\") as has_hls, count(\"sourceKey\") as has_source from video_assets group by status order by status;"
psql_q "select left(\"lessonId\", 12) as lesson, status, \"sourceKey\" is not null as source, \"hlsPrefix\" is not null as hls, \"processedAt\", left(coalesce(\"errorMessage\", ''), 120) as error, \"updatedAt\" from video_assets order by \"updatedAt\" desc limit 15;"

section 'Transcode jobs (latest 15)'
psql_q "select left(id, 10) as job, status, attempts, progress, left(coalesce(error, ''), 160) as error, \"createdAt\", \"startedAt\", \"finishedAt\" from video_jobs order by \"createdAt\" desc limit 15;"

section 'Worker logs (last 80 lines)'
docker logs --tail 80 "$p-worker-1" 2>&1

section 'API logs about videos (last 3 days)'
docker logs --since 72h "$p-backend-1" 2>&1 | grep -E 'transcode|upload|Video|storage' | sed -E 's/[0-9]{1,3}(\.[0-9]{1,3}){3}/<ip>/g' | tail -60

section 'Disk'
df -h / /var/lib/docker 2>/dev/null | sort -u
