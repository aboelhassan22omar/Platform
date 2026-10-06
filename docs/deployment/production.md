# Production deployment

Going live with the platform. Read this in full before the first real student
registers.

> **This overlay is a sound single-host deployment. It is not, by itself, an
> answer to high-scale traffic.** The section on scaling explains where the
> limits are and what to do about them.

---

## 1. Pre-flight checklist

Nothing below is optional.

### Secrets

Every secret in `.env.example` is a placeholder. The API **refuses to start** in
production if any still contains `dev_only`, `change_me` or `replace_me`.

```bash
openssl rand -hex 48   # JWT_ACCESS_SECRET
openssl rand -hex 48   # JWT_REFRESH_SECRET      (must differ)
openssl rand -hex 48   # PLAYBACK_TOKEN_SECRET   (must differ)
openssl rand -base64 32 | tr -d '/+=' # POSTGRES_PASSWORD
openssl rand -base64 32 | tr -d '/+=' # REDIS_PASSWORD
openssl rand -base64 32 | tr -d '/+=' # S3_SECRET_KEY
```

Store them in a secrets manager, not in the repository. `.env` is gitignored;
keep it that way.

### Configuration

| Variable              | Production value              | Why                                                                                                                                                                                     |
| --------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `production`                  | Enables the boot-time safety checks                                                                                                                                                     |
| `COOKIE_SECURE`       | `true`                        | Session cookies must be HTTPS-only                                                                                                                                                      |
| `COOKIE_DOMAIN`       | _empty_, or `.yourdomain.com` | Empty gives a host-only cookie, which is what a single origin wants. **Never `localhost`** — a single-label Domain attribute is mishandled by several clients and silently breaks login |
| `PAYMENT_PROVIDER`    | `paymob`                      | `dev` is a sandbox; see [payments.md](payments.md)                                                                                                                                      |
| `SEED_DEMO_DATA`      | `false`                       | The seed refuses to run otherwise                                                                                                                                                       |
| `RATE_LIMIT_MAX`      | `120`                         | Keep the strict default                                                                                                                                                                 |
| `AUTH_RATE_LIMIT_MAX` | `8`                           | Keep the strict default                                                                                                                                                                 |
| `PUBLIC_SITE_URL`     | `https://yourdomain.com`      | Absolute links and payment returns                                                                                                                                                      |
| `CORS_ORIGINS`        | `https://yourdomain.com`      | Never leave empty in production                                                                                                                                                         |
| `LOG_LEVEL`           | `info`                        | `debug` is noisy and can log more than you want                                                                                                                                         |

The boot-time validator (`backend/src/config/configuration.ts`) enforces most
of these and prints exactly what is wrong.

---

## 2. Host sizing

Measured against the shipped stack; adjust once you have real traffic.

| Students | vCPU | RAM   | Disk       | Notes                                 |
| -------- | ---- | ----- | ---------- | ------------------------------------- |
| < 200    | 4    | 8 GB  | 100 GB SSD | Single host is comfortable            |
| 200–1000 | 8    | 16 GB | 250 GB SSD | Move video to a CDN                   |
| 1000+    | —    | —     | —          | Separate database host, CDN mandatory |

Disk is dominated by video. Rough guide: **one hour of lesson at the default
ladder ≈ 1.5–2 GB** across all three renditions plus the source. A 70-lesson
curriculum at 30 minutes each is roughly 60–80 GB. Budget accordingly, and
consider deleting sources once a transcode is verified.

---

## 3. TLS

The shipped nginx config serves HTTP only. Add TLS before going live.

```bash
# Issue certificates (host has port 80 free)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

mkdir -p docker/nginx/certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/nginx/certs/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem  docker/nginx/certs/
```

Add `docker/nginx/conf.d/tls.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    http2 on;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Then the same location blocks as docker/nginx/conf.d/default.conf
    include /etc/nginx/conf.d/locations.inc;
}
```

Move the `location` blocks out of `default.conf` into `locations.inc` so HTTP
and HTTPS share one definition rather than drifting apart.

Renewal:

```bash
# /etc/cron.d/certbot-renew
0 3 * * * root certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/amr/docker/nginx/certs/ && docker compose -f /opt/amr/docker-compose.yml exec proxy nginx -s reload"
```

---

## 4. Deploying

```bash
git clone <repo> /opt/amr && cd /opt/amr
cp .env.example .env && $EDITOR .env      # fill in real values

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Curriculum and packages (idempotent, safe to re-run)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --profile seed run --rm seed

# First administrator — once
BOOTSTRAP_ADMIN_USERNAME=... BOOTSTRAP_ADMIN_PASSWORD=... \
BOOTSTRAP_ADMIN_FULLNAME=... BOOTSTRAP_ADMIN_PHONE=... \
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --profile bootstrap run --rm \
  -e BOOTSTRAP_ADMIN_USERNAME -e BOOTSTRAP_ADMIN_PASSWORD \
  -e BOOTSTRAP_ADMIN_FULLNAME -e BOOTSTRAP_ADMIN_PHONE bootstrap-admin
```

Then **remove the `BOOTSTRAP_ADMIN_*` values from `.env`**. The script refuses
to run again while an admin exists, but leaving credentials on disk is pointless
risk.

### What the production overlay changes

- Postgres, Redis and MinIO bind to `127.0.0.1` only — reach them over an SSH
  tunnel, never across the network
- The backend and frontend are not published at all; nginx is the only way in
- CPU and memory limits per service, so a runaway ffmpeg cannot starve the API
- Log rotation (20 MB × 5 per service)
- `restart: always`

---

## 5. Backups

**The database is the business.** Video can be re-uploaded; orders, entitlements
and progress cannot be reconstructed.

```bash
#!/usr/bin/env bash
# /opt/amr/scripts/backup.sh
set -euo pipefail

BACKUP_DIR=/var/backups/amr
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

# --- Database ---
docker compose -f /opt/amr/docker-compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
  > "$BACKUP_DIR/db-$STAMP.dump"

# --- Object storage ---
docker compose -f /opt/amr/docker-compose.yml exec -T minio \
  mc mirror --overwrite local/amr-videos "$BACKUP_DIR/videos/"

# 30-day retention
find "$BACKUP_DIR" -name 'db-*.dump' -mtime +30 -delete

# Off-site — a backup on the same host is not a backup
rclone copy "$BACKUP_DIR" remote:amr-backups
```

```cron
0 2 * * * /opt/amr/scripts/backup.sh >> /var/log/amr-backup.log 2>&1
```

**Test a restore before you need one:**

```bash
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" --clean --if-exists < db-20260922-020000.dump
```

An untested backup is a guess.

---

## 6. Monitoring

### Health endpoints

| Endpoint                | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `GET /api/health`       | Liveness — dependency-free, so it only fails on a real hang  |
| `GET /api/health/ready` | Readiness — reports database, Redis and storage individually |
| `GET /healthz` (proxy)  | Edge liveness                                                |

Point an uptime monitor at `/api/health/ready` and alert on `status: degraded`.

### What to watch

| Signal                        | Where                                        | Alert when                          |
| ----------------------------- | -------------------------------------------- | ----------------------------------- |
| Failed transcodes             | `video_jobs` where `status = 'FAILED'`       | any                                 |
| Unprocessed webhooks          | `webhook_events` where `processedAt IS NULL` | > 5 minutes old                     |
| Orders stuck awaiting payment | `orders` where `status = 'AWAITING_PAYMENT'` | > 1 hour old                        |
| Disk usage                    | host                                         | > 80%                               |
| Refresh-token reuse           | logs: `Refresh token reuse detected`         | any — this indicates a stolen token |

```sql
-- Unprocessed webhooks: money taken, access possibly not granted
SELECT id, provider, "eventId", "createdAt", error
FROM webhook_events
WHERE "processedAt" IS NULL AND "createdAt" < NOW() - INTERVAL '5 minutes';
```

That query is the single most important alert on the platform: a row in it means
a student may have paid without receiving access.

---

## 7. Scaling

### Where the limits are

1. **Video bandwidth.** Segments stream through the API. 500 concurrent 720p
   viewers ≈ 1.4 Gbps. This binds long before CPU does.
2. **Transcoding CPU.** One ffmpeg process saturates several cores.
3. **Database connections.** `connection_limit=10` per API instance.

### What to do

**Video → CDN (do this first).** Keep the private bucket as origin, put a CDN in
front, and swap playback tickets for signed CDN URLs issued by the same
`checkLessonAccess` call. See
[video-pipeline.md](../architecture/video-pipeline.md).

**Transcoding → more workers.**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=4
```

BullMQ distributes jobs automatically; no coordination needed.

**API → more instances.** The API is stateless (sessions are cookies + database
rows), so it scales horizontally behind nginx. Raise Postgres `max_connections`
to match.

**Database → dedicated host.** Move Postgres off the application host before
adding API instances; they will contend for the same I/O otherwise.

---

## 8. Recovery

### The API will not start

```bash
docker compose logs backend --tail=100
```

The configuration validator prints precisely which variable is wrong. Common
causes: a placeholder secret, `COOKIE_SECURE=false`, or `PAYMENT_PROVIDER=dev`
in production.

### Migrations failed

```bash
docker compose logs migrate
docker compose exec backend npx prisma migrate status
```

The API will not start until `migrate` exits cleanly — by design. Fix the
migration rather than bypassing the dependency.

### Transcodes are stuck

```bash
docker compose logs worker --tail=100
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT id, status, attempts, error FROM video_jobs WHERE status <> 'COMPLETED' ORDER BY \"createdAt\" DESC LIMIT 20;"
```

Retry from the admin dashboard, or `POST /admin/content/lessons/:id/video/retry`.

### A student paid but has no access

```sql
SELECT o.reference, o.status, o."paidAt", p.status AS payment_status, p."providerRef"
FROM orders o LEFT JOIN payments p ON p."orderId" = o.id
WHERE o.reference = 'AM-XXXX-XXXX';
```

- Order `PAID`, no entitlement → should be impossible (same transaction). Open a
  bug with the order reference.
- Order `AWAITING_PAYMENT`, provider shows success → the webhook did not arrive.
  Check `webhook_events`, then replay from the provider dashboard.
- Payment `FAILED` → no money was taken; ask the student to retry.

As a last resort, grant access manually from the admin dashboard — it is
recorded in the audit log with your name against it.

### Full rollback

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
git checkout <previous-tag>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Note that migrations are **not** automatically reversed. If the bad release
included a destructive migration, restore the database from backup.

---

## 9. Legal and data protection

Before launch:

- Have `/privacy` and `/terms` reviewed by a lawyer. The shipped copy is an
  honest draft describing what the platform actually does — it is **not** legal
  advice.
- Review obligations under Egypt's **Personal Data Protection Law (151/2020)**,
  particularly around minors' data and data-controller registration. Most
  students on this platform are under 18.
- Confirm the teacher holds rights to every asset uploaded. The platform ships
  with **no** third-party imagery.
- Decide and document a data-retention period.
