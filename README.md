# منصة عمرو محروس التعليمية

**Amr Mahrous Educational Platform** — an Arabic, RTL, mobile-first platform for
teaching history to Egyptian secondary-school students (الثانوية العامة and
البكالوريا المصرية).

Developed by **[Aurexis](https://aurexis.cc/)**.

The application core is reusable for other teachers and subjects. Brand,
teacher, subject, logos, SEO and contact channels are configured through
environment variables. See [the customization guide](docs/customization/teacher-platform.md)
before creating a chemistry, biology or physics deployment.

---

## What this is

A complete educational platform, not a prototype:

- Students register, pick their pathway and grade, browse a curriculum-shaped
  catalogue, buy individual lessons or subscribe, watch protected HLS video,
  and resume exactly where they stopped.
- Administrators manage students, content, video uploads, prices and packages,
  and see real business figures.
- Everything runs in Docker: frontend, API, background worker, Postgres, Redis,
  object storage and a reverse proxy.

Every access decision is made on the server. The frontend renders locks from an
`isAccessible` flag, but that flag is advisory — the playback endpoint, the
progress endpoint and the library endpoint each re-check entitlements
independently, so a tampered client gains nothing.

---

## Quick start

**Requirements:** Docker Desktop (or Docker Engine + Compose v2). Nothing else —
Node, Postgres, Redis and ffmpeg all live in containers.

```bash
# 1. Configuration
cp .env.example .env

# 2. Generate real secrets (do not skip this)
#    Three DIFFERENT values are required.
openssl rand -hex 48   # -> JWT_ACCESS_SECRET
openssl rand -hex 48   # -> JWT_REFRESH_SECRET
openssl rand -hex 48   # -> PLAYBACK_TOKEN_SECRET

# 3. Build and start everything
docker compose up -d --build

# 4. Load the curriculum, grades and packages
docker compose --profile seed run --rm seed

# 5. Create the first administrator
BOOTSTRAP_ADMIN_USERNAME=your.admin \
BOOTSTRAP_ADMIN_PASSWORD='a-strong-password-12-chars-min' \
BOOTSTRAP_ADMIN_FULLNAME='عمرو محروس' \
BOOTSTRAP_ADMIN_PHONE=01000000000 \
docker compose --profile bootstrap run --rm \
  -e BOOTSTRAP_ADMIN_USERNAME -e BOOTSTRAP_ADMIN_PASSWORD \
  -e BOOTSTRAP_ADMIN_FULLNAME -e BOOTSTRAP_ADMIN_PHONE \
  bootstrap-admin
```

Then open **<http://localhost:7080>**.

Migrations run automatically: the `migrate` service applies them and must exit
successfully before the API is allowed to start.

### Ports

Chosen after checking what was already bound on the build machine — 80, 8080,
5433, 1521 and 9007 were occupied, so the 7xxx block is used. All of them are
environment variables; change them freely in `.env`.

| Service | Host port | Notes |
|---|---|---|
| Reverse proxy (the site) | **7080** | The only one you normally need |
| Frontend (direct) | 7300 | Bypasses the proxy; debugging only |
| Backend API (direct) | 7400 | Swagger at `/api/docs` in development |
| PostgreSQL | 7432 | Not published in production |
| Redis | 7379 | Not published in production |
| MinIO API / console | 7900 / 7901 | Not published in production |

### Demo data

`SEED_DEMO_DATA=true` (the default in `.env.example`) creates five clearly
labelled demo students, one per grade:

| Username | Grade |
|---|---|
| `demo.ahmed` | أولى ثانوي |
| `demo.mariam` | تانية ثانوي |
| `demo.youssef` | تالتة ثانوي |
| `demo.nour` | أولى بكالوريا |
| `demo.salma` | تانية بكالوريا |

Password for all of them: `Demo12345`. **Test credentials only.** The seed
refuses to run with `NODE_ENV=production`.

---

## Architecture

```
                         ┌──────────────┐
  Browser  ──────────────│ nginx :7080  │  one origin, so auth cookies
                         └──────┬───────┘  stay first-party
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼────────┐     ┌────────▼────────┐
            │ Next.js 15     │     │ NestJS 11       │
            │ App Router     │     │ REST + OpenAPI  │
            └────────────────┘     └───┬────┬────┬───┘
                                       │    │    │
                     ┌─────────────────┘    │    └──────────────┐
                     │                      │                   │
            ┌────────▼────────┐    ┌────────▼───────┐  ┌────────▼────────┐
            │ PostgreSQL 17   │    │ Redis 7        │  │ MinIO (S3)      │
            │ Prisma 7        │    │ presence+queue │  │ private + public│
            └─────────────────┘    └────────┬───────┘  └────────▲────────┘
                                            │ BullMQ            │
                                   ┌────────▼────────┐          │
                                   │ Worker + ffmpeg │──────────┘
                                   │ HLS transcoding │
                                   └─────────────────┘
```

| Concern | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Server components read the API with the session cookie, so the catalogue renders without a client round-trip |
| Backend | NestJS 11 | Guards and DI make "deny by default" enforceable globally rather than per-route |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Typed queries; v7 moves the connection to a driver adapter |
| Money | Integer piastres | Floating point has no place in a price |
| Video | ffmpeg → HLS, in a separate container | Transcoding is CPU-bound and must scale apart from the API |
| Motion | Motion (Framer Motion) | Transform/opacity only, with `reducedMotion: 'user'` honoured globally |

Deeper notes live in [`docs/architecture/`](docs/architecture/).

---

## Repository layout

```
.
├── backend/              NestJS API
│   ├── prisma/           schema, migrations, seed, curriculum data
│   └── src/
│       ├── auth/         registration, login, token rotation
│       ├── entitlements/ THE access-control engine
│       ├── payments/     orders, provider adapters, webhooks
│       ├── videos/       upload tickets, playback authorisation, streaming
│       ├── progress/     resumable watch position
│       ├── presence/     "online now" tracking
│       ├── admin/        dashboard, students, content, pricing
│       └── common/       prisma, redis, storage, guards, audit, utils
├── frontend/             Next.js app
│   └── src/
│       ├── app/          routes
│       ├── features/     screen-level composition
│       ├── components/   UI, motion and decorative primitives
│       ├── themes/       the five academic identities
│       └── lib/          API client, motion system, formatting
├── workers/              ffmpeg transcoding worker
├── docker/               nginx config, init scripts
├── docs/                 architecture, deployment, operations
├── tests/e2e/            Playwright suites
├── docker-compose.yml           development stack
└── docker-compose.prod.yml      production overlay
```

---

## The five academic experiences

Each grade has its own visual identity, driven by what it actually studies. One
set of components renders all five; a `themeKey` on the grade row re-points the
accent tokens, the hero motif, the chronological strip and the motion rhythm.

| Grade | Theme | Direction |
|---|---|---|
| أولى ثانوي | `pharaonic-dawn` | Lapis and gold; temple colonnade; ancient civilisations |
| تانية ثانوي | `renaissance-atlas` | Verdigris and brass; compass rose over a graticule |
| تالتة ثانوي | `modern-egypt-archive` | Burgundy and ink; archival documents. Calmest motion — it is the exam year |
| أولى بكالوريا | `bacc-foundations` | Indigo; papyrus weave with analytical nodes |
| تانية بكالوريا | `revolution-chronicle` | Copper; rising banners; July revolution |

See [`frontend/src/themes/registry.ts`](frontend/src/themes/registry.ts).

---

## Testing

```bash
# Backend unit tests — business logic, no database needed
cd backend && npm test                  # 73 tests

# End-to-end, against the RUNNING stack
docker compose up -d --build
cd tests/e2e
npm install && npx playwright install chromium
npm test                                # journey + API contract + responsive
npm run test:mobile                     # the same journey at 360px
```

What the suites cover:

- **`student-journey.spec.ts`** — register → locked lesson → purchase →
  settlement → unlocked → progress → sign out → sign in → resume. Plus pathway
  selection, the five themed experiences, and the Aurexis footer credit.
- **`api-contract.spec.ts`** — entitlement enforcement, cross-student isolation,
  price integrity, checkout and webhook idempotency, progress clamping, RBAC on
  every admin route.
- **`responsive.spec.ts`** — horizontal-overflow assertions on 13 pages across
  9 viewport widths (320 → 1440), RTL, touch-target sizes, drawer behaviour and
  reduced motion.

---

## Common operations

```bash
docker compose ps                        # service health
docker compose logs -f backend           # follow API logs
docker compose logs -f worker            # follow transcoding

docker compose up -d --scale worker=3    # more transcoding throughput

docker compose --profile seed run --rm seed          # re-seed (idempotent)
docker compose exec backend npx prisma migrate deploy # apply new migrations

docker compose down                      # stop, keep data
docker compose down -v                   # stop and DELETE ALL DATA
```

---

## Before going live

`PAYMENT_PROVIDER=dev` is the default and **processes no real payments**. The
API refuses to boot with `NODE_ENV=production` unless you either configure
Paymob or deliberately override the check.

The full checklist is in
[`docs/deployment/production.md`](docs/deployment/production.md). The essentials:

1. Rotate every secret in `.env`; none of the shipped values are usable.
2. `COOKIE_SECURE=true` and terminate TLS.
3. `PAYMENT_PROVIDER=paymob` with real merchant credentials, verified against
   Paymob's test account first.
4. `SEED_DEMO_DATA=false`.
5. Move video delivery to a CDN — see
   [`docs/architecture/video-pipeline.md`](docs/architecture/video-pipeline.md).
6. Have the legal pages reviewed against Egypt's Personal Data Protection Law
   (151/2020). The shipped copy is an honest draft, not legal advice.
7. Replace the placeholder curriculum and prices from the dashboard.

---

## Known limitations

Stated plainly, because shipping is easier than un-shipping a false claim.

| Area | Status |
|---|---|
| Payments | The Paymob adapter is written to the documented API but has **not** been run against live or sandbox merchant credentials — none were available. Verify before taking money. |
| SMS / phone verification | No provider is integrated. `PHONE_VERIFICATION=off` by default; password-reset tokens are logged, never sent. The UI says so rather than implying an SMS arrived. |
| Brand assets | The teacher's Facebook page is behind a login wall, so no logo, photography or brand colours could be extracted. The palette is an original design direction; asset slots are wired to editable settings. **No image is used without rights.** |
| Curriculum | Compiled from Egyptian education press and published distribution summaries, not a machine-readable Ministry source. Courses carry an `isProvisional` flag and the admin UI shows a warning badge. Review before launch. |
| Content protection | Short-lived signed playback tickets over private storage stop hotlinking and URL sharing. They do **not** stop screen recording — that needs DRM (Widevine/FairPlay), a separate commercial integration. |
| Scale | This is a sound single-host deployment. It is not, by itself, an answer to thousands of concurrent viewers; video must move to a CDN first. |
| Marketing copy | No testimonials, student counts or ratings appear anywhere, because none were supplied. |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/architecture/overview.md`](docs/architecture/overview.md) | System design and the reasoning behind it |
| [`docs/architecture/entitlements.md`](docs/architecture/entitlements.md) | How access control works and why it is shaped this way |
| [`docs/architecture/video-pipeline.md`](docs/architecture/video-pipeline.md) | Upload, transcoding, playback authorisation, and what it does not protect |
| [`docs/deployment/production.md`](docs/deployment/production.md) | Going live: TLS, backups, scaling, monitoring, recovery |
| [`docs/deployment/payments.md`](docs/deployment/payments.md) | Enabling Paymob and verifying it |
| [`docs/operations/admin-guide.md`](docs/operations/admin-guide.md) | Day-to-day administration, in Arabic |
| [`docs/operations/brand-assets.md`](docs/operations/brand-assets.md) | Where to drop the official logo and photography |
| [`docs/api/README.md`](docs/api/README.md) | API reference; Swagger at `/api/docs` |

---

<p align="center">
  Powered by <a href="https://aurexis.cc/">Aurexis</a>
</p>
