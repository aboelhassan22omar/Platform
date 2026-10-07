#!/usr/bin/env bash
set -euo pipefail
umask 077

release_sha="${1:?A release SHA is required}"
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release SHA'; exit 1; }
deployment_root=/opt/amr-platform
release_dir="$deployment_root/releases/$release_sha"
[[ "$(pwd -P)" = "$release_dir" ]] || { echo 'Run from the immutable release directory'; exit 1; }
test -s "$deployment_root/shared/.env" || { echo 'Production .env is not configured'; exit 1; }

exec 9>"$deployment_root/deploy.lock"
flock -n 9 || { echo 'Another production deployment is running'; exit 1; }
ln -sfn "$deployment_root/shared/.env" .env
compose=(docker compose -p amr-production -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.host.yml)
"${compose[@]}" config --quiet
"${compose[@]}" config --format json | python3 -c '
import json, sys
config = json.load(sys.stdin)
env = config["services"]["backend"]["environment"]
assert env.get("NODE_ENV") == "production", "NODE_ENV must be production"
assert env.get("COOKIE_SECURE") == "true", "HTTPS cookies are required"
assert env.get("PAYMENT_PROVIDER") == "paymob", "A real payment provider is required"
for key in ("PAYMOB_API_KEY", "PAYMOB_HMAC_SECRET", "PAYMOB_INTEGRATION_ID_CARD", "PAYMOB_IFRAME_ID"):
    assert env.get(key), f"Missing production payment credential: {key}"
'

# Build before touching running services. The current production stays up if
# compilation fails. Keep all prior images and releases available for recovery.
"${compose[@]}" --profile seed --profile bootstrap build
mkdir -p "$deployment_root/backups"
if "${compose[@]}" ps --status running --services | grep -qx postgres; then
  "${compose[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > "$deployment_root/backups/pre-$release_sha-$(date -u +%Y%m%dT%H%M%SZ).dump"
fi

"${compose[@]}" up -d --wait --wait-timeout 240
"${compose[@]}" --profile seed run --rm seed
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
