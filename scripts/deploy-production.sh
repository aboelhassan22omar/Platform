#!/usr/bin/env bash
set -euo pipefail
umask 077

release_sha="${1:?A release SHA is required}"
image_prefix="${2:?An image prefix is required}"
registry_user="${3:?A registry user is required}"
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release SHA'; exit 1; }
[[ "$image_prefix" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+$ ]] || { echo 'Invalid image prefix'; exit 1; }
[[ "$registry_user" =~ ^[a-zA-Z0-9-]+$ ]] || { echo 'Invalid registry user'; exit 1; }
deployment_root=/opt/amr-platform
release_dir="$deployment_root/releases/$release_sha"
[[ "$(pwd -P)" = "$release_dir" ]] || { echo 'Run from the immutable release directory'; exit 1; }
test -s "$deployment_root/shared/.env" || { echo 'Production .env is not configured'; exit 1; }

exec 9>"$deployment_root/deploy.lock"
flock -n 9 || { echo 'Another production deployment is running'; exit 1; }
ln -sfn "$deployment_root/shared/.env" .env
export IMAGE_PREFIX="$image_prefix" RELEASE_SHA="$release_sha"
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
assert provider in ("paymob", "manual"), "A real payment provider is required"
if provider == "paymob":
    for key in ("PAYMOB_API_KEY", "PAYMOB_HMAC_SECRET", "PAYMOB_INTEGRATION_ID_CARD", "PAYMOB_IFRAME_ID"):
        assert env.get(key), f"Missing production payment credential: {key}"
else:
    import re
    assert re.fullmatch(r"(010|011|012|015)\d{8}", env.get("PAYMENT_TRANSFER_PHONE", "")), "Missing recipient wallet phone"
'

# Pull the complete tested release before touching running services.
"${compose[@]}" --profile seed --profile bootstrap pull
mkdir -p "$deployment_root/backups"
if "${compose[@]}" ps --status running --services | grep -qx postgres; then
  "${compose[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > "$deployment_root/backups/pre-$release_sha-$(date -u +%Y%m%dT%H%M%SZ).dump"
fi

"${compose[@]}" up -d --no-build --wait --wait-timeout 240
"${compose[@]}" --profile seed run --rm --no-build seed
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
echo "Production deployed: $release_sha"
