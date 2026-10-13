#!/usr/bin/env bash
set -euo pipefail
umask 077

release_sha="${1:?A release SHA is required}"
image_prefix="${2:?An image prefix is required}"
registry_user="${3:?A registry user is required}"
# Comma-separated services built for this release (backend,frontend,worker,minio).
# Empty means only compose/nginx changed: every service keeps its running image.
changed_services="${4-}"
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release SHA'; exit 1; }
[[ "$image_prefix" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+$ ]] || { echo 'Invalid image prefix'; exit 1; }
[[ "$registry_user" =~ ^[a-zA-Z0-9-]+$ ]] || { echo 'Invalid registry user'; exit 1; }
service_list='^((backend|frontend|worker|minio)(,(backend|frontend|worker|minio))*)?$'
[[ "$changed_services" =~ $service_list ]] || { echo 'Invalid service list'; exit 1; }
deployment_root=/opt/amr-platform
release_dir="$deployment_root/releases/$release_sha"
[[ "$(pwd -P)" = "$release_dir" ]] || { echo 'Run from the immutable release directory'; exit 1; }
test -s "$deployment_root/shared/.env" || { echo 'Production .env is not configured'; exit 1; }

exec 9>"$deployment_root/deploy.lock"
flock -n 9 || { echo 'Another production deployment is running'; exit 1; }
ln -sfn "$deployment_root/shared/.env" .env

# Image tag per service: this release for what changed, the running tag for the
# rest. Releases before per-service tags ran every image at current-sha.
tags_file="$deployment_root/service-tags.env"
previous_sha="$(cat "$deployment_root/current-sha" 2>/dev/null || true)"
declare -A tags=()
if [ -s "$tags_file" ]; then
  while IFS='=' read -r key value; do
    if [[ "$key" =~ ^(BACKEND|FRONTEND|WORKER|MINIO)_TAG$ && "$value" =~ ^[0-9a-f]{40}$ ]]; then
      tags[$key]="$value"
    fi
  done < "$tags_file"
fi
updated=()
for service in backend frontend worker minio; do
  key="${service^^}_TAG"
  if [[ ",$changed_services," == *",$service,"* ]]; then
    tags[$key]="$release_sha"
    updated+=("$service")
  elif [ -z "${tags[$key]-}" ]; then
    [[ "$previous_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "No running image recorded for $service; deploy it too"; exit 1; }
    tags[$key]="$previous_sha"
  fi
  export "$key=${tags[$key]}"
done
export IMAGE_PREFIX="$image_prefix"
echo "Updating: ${updated[*]:-configuration only}"
echo "Image tags: backend=$BACKEND_TAG frontend=$FRONTEND_TAG worker=$WORKER_TAG minio=$MINIO_TAG"
export DOCKER_CONFIG
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
# The short-lived GitHub token arrives on stdin and never enters a file or log.
docker login ghcr.io --username "$registry_user" --password-stdin
compose=(docker compose -p amr-production -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.host.yml -f docker-compose.images.yml)
"${compose[@]}" config --quiet
"${compose[@]}" config --format json | python3 -c '
import json, sys
config = json.load(sys.stdin)
env = config["services"]["backend"]["environment"]
assert env.get("NODE_ENV") == "production", "NODE_ENV must be production"
assert env.get("COOKIE_SECURE") == "true", "HTTPS cookies are required"
provider = env.get("PAYMENT_PROVIDER")
assert provider in ("paymob", "kashier", "manual"), "A real payment provider is required"
if provider == "paymob":
    for key in ("PAYMOB_API_KEY", "PAYMOB_HMAC_SECRET", "PAYMOB_INTEGRATION_ID_CARD", "PAYMOB_IFRAME_ID"):
        assert env.get(key), f"Missing production payment credential: {key}"
elif provider == "kashier":
    for key in ("KASHIER_MERCHANT_ID", "KASHIER_API_KEY", "KASHIER_SECRET_KEY"):
        assert env.get(key), f"Missing production payment credential: {key}"
    assert env.get("KASHIER_MODE") == "live", "KASHIER_MODE must be live in production"
else:
    import re
    assert re.fullmatch(r"(010|011|012|015)\d{8}", env.get("PAYMENT_TRANSFER_PHONE", "")), "Missing recipient wallet phone"
'

# Pull every image before touching running services; unchanged ones are
# already local, so only the updated services actually download.
for attempt in 1 2 3; do
  if "${compose[@]}" --profile seed --profile bootstrap pull --quiet; then
    break
  fi
  if [ "$attempt" = 3 ]; then
    echo 'Image download failed after three attempts; production was not changed.' >&2
    exit 1
  fi
  echo "Image download interrupted; retrying ($attempt/3)."
  sleep $((attempt * 10))
done
mkdir -p "$deployment_root/backups"
if "${compose[@]}" ps --status running --services | grep -qx postgres; then
  "${compose[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > "$deployment_root/backups/pre-$release_sha-$(date -u +%Y%m%dT%H%M%SZ).dump"
fi

# Compose only recreates services whose image or configuration changed.
"${compose[@]}" up -d --no-build --wait --wait-timeout 240
course_count=$("${compose[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM courses"' | tr -d '[:space:]')
[[ "$course_count" =~ ^[0-9]+$ ]] || { echo 'Cannot verify existing content'; exit 1; }
if [ "$course_count" = 0 ]; then
  "${compose[@]}" --profile seed run --rm seed
else
  echo 'Existing teaching content and prices preserved; automatic seed skipped.'
fi
curl --fail --silent --show-error http://127.0.0.1:17080/api/health/ready | python3 -c '
import json, sys
result = json.load(sys.stdin)
assert result.get("status") == "ok", f"Production dependencies are unhealthy: {result}"
print("Database, Redis and storage readiness verified")
'
curl --fail --silent --show-error http://127.0.0.1:17080/healthz

# Keep the active release pointer unchanged until all checks pass.
ln -sfn "$release_dir" "$deployment_root/current.next"
mv -Tf "$deployment_root/current.next" "$deployment_root/current"
printf '%s\n' "$release_sha" > "$deployment_root/current-sha"
printf 'BACKEND_TAG=%s\nFRONTEND_TAG=%s\nWORKER_TAG=%s\nMINIO_TAG=%s\n' \
  "$BACKEND_TAG" "$FRONTEND_TAG" "$WORKER_TAG" "$MINIO_TAG" > "$tags_file.next"
mv -f "$tags_file.next" "$tags_file"
echo "Production deployed: $release_sha"
