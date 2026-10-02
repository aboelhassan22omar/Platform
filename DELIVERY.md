# Implementation report

**منصة عمرو محروس التعليمية** — Amr Mahrous Educational Platform
Delivered by **[Aurexis](https://aurexis.cc/)**

---

## Summary

A complete, running educational platform: Next.js frontend, NestJS API,
PostgreSQL, Redis, S3-compatible object storage, an ffmpeg transcoding worker
and an nginx reverse proxy — all in Docker, all verified working together.

Everything below is separated into **what was verified by execution**, **what
is implemented but needs external credentials**, and **what is not done**. That
separation is the point of this document.

```
Verified by running the system:
  73  backend unit tests
 191  E2E tests on desktop (Chromium, 1440px)
 191  E2E tests on mobile  (360px — the full journey on a phone)
```

---

## 1. Fully implemented and verified

Each item below was executed against the running Docker stack, not reasoned
about.

### Infrastructure

- **Seven containerised services**, all reporting healthy: proxy, frontend,
  backend, worker, postgres, redis, minio
- **Multi-stage Dockerfiles**, non-root users, `dumb-init` for signal handling,
  health checks, named volumes
- **Host ports chosen after inspecting what was already bound** (80, 8080,
  5433, 1521, 9007 were occupied) — the 7xxx block, all env-configurable
- **Production overlay** (`docker-compose.prod.yml`) binding data stores to
  loopback only, with resource limits and log rotation. Validated with
  `docker compose config`
- **Migrations gate the API**: the `migrate` service must exit cleanly before
  the backend starts

### Database

- **29 tables**, **38 foreign keys**, **15 CHECK constraints**, **5 partial
  unique indexes** — verified by querying `pg_constraint`
- Money stored as **integer piastres** throughout; `CHECK (totalMinor =
  subtotalMinor - discountMinor)` makes a calculator bug fail the insert
- Partial unique indexes prevent duplicate active entitlements
- The `entitlements_window_valid` constraint demonstrably rejected an attempt
  to set an expiry before a start date
- **Idempotent seed** — running it twice leaves identical row counts

### Authentication

- Argon2id hashing (19 MiB, t=2, p=1), verified working
- Rotating refresh tokens, stored hashed; **re-use of a rotated token kills
  every session** for that user
- httpOnly cookies, host-only, `SameSite=Lax`
- Egyptian phone normalisation: `+20`, `0020`, Eastern-Arabic digits,
  separators — all 10 accepted shapes tested; all invalid prefixes rejected
- Pathway/grade pairing enforced in the DTO **and** re-validated server-side
- Login errors are word-identical for a wrong password and an unknown user
- **Password reset verified end to end**, including that an unregistered phone
  gets the same response and no token

### Entitlements

- All five granting scopes (lesson, chapter, course, monthly, yearly)
- **Expired access genuinely blocks** playback, the library and progress writes
  — verified by backdating a row in the live database
- Renewal extends from the current expiry, so early renewal loses no days
- Idempotent grants at two layers: application check plus database constraint
- **43 paid orders produced exactly 43 entitlements** across all test runs,
  including deliberate webhook replays

### Commerce

- Prices read from the database; client-supplied price fields rejected
- `Idempotency-Key` returns the original order on a retry
- Settlement is **one transaction**: order, payment, entitlements, subscription
  and notification commit together
- Replayed webhooks return `duplicate: true` and change nothing
- Unsigned webhooks rejected with `400`
- Amount mismatch between provider and order refuses to grant
- Owned content cannot be bought twice

### Video

**Verified end to end** with a generated 1280×720 source:

- Presigned direct-to-storage upload (the API never buffers the file)
- ffmpeg transcode to **360p / 480p / 720p** in a single pass
- Duration probed correctly (20s source → 20s recorded)
- Poster frame extracted to the public bucket
- Playback ticket issued only after a server-side entitlement check
- Manifest served with child URLs carrying the ticket
- **Real MPEG-TS segment served** (509,480 bytes, `0x47` sync byte verified)
- Missing ticket → `403`; forged ticket → `403`
- Private bucket refuses anonymous listing
- Resume position remembered across sessions

### Admin

- Secure bootstrap: **all three safeguards verified** — weak password refused,
  valid creation succeeded, second run refused with an admin already present
- Real dashboard figures from live tables
- Student search, filters, pagination; suspension logs out every device
  immediately
- Manual entitlement grant and revoke, both audited
- Plans seeded **inactive** — nothing is sellable until deliberately activated
- Activating a plan makes it publicly visible; deactivating hides it — both
  verified through the public API
- Password hashes never appear in any admin response

### Frontend

- **26 routes** building cleanly. 102 kB shared JS; every route under 175 kB
  first load except the admin dashboard (280 kB — Recharts, code-split and
  staff-only)
- Genuine RTL with Cairo/Tajawal, self-hosted
- **Five visually distinct academic identities**, verified to resolve to five
  different accent colours at runtime
- **Zero horizontal overflow** across 14 pages × 9 viewport widths (320–1440)
- Touch targets ≥ 44px; mobile drawer locks the page behind it
- `prefers-reduced-motion` honoured globally
- Aurexis footer credit: present, centred within 2% of page centre, correct
  `href`/`target`/`rel`, visible at 320px

### The complete student journey

Executed through the real UI, on desktop **and at 360px**:

> register → empty library → locked lesson (no `<video>` element exists) →
> purchase → sandbox settlement → unlocked → progress saved → sign out →
> sign in → **progress still there**

---

## 2. Implemented, needs external credentials

These are built and wired. They cannot be called *verified* because the
external service was unavailable.

### Paymob payments

**Status:** adapter written against Paymob's documented Accept API — auth
token → order → payment key → iframe, with HMAC-SHA512 webhook verification
over Paymob's specified field order, compared with `timingSafeEqual`.

**Not verified:** never executed against live or sandbox merchant credentials;
none were available.

**To enable:** credentials in `.env`, then work through the checklist in
[`docs/deployment/payments.md`](docs/deployment/payments.md) on a Paymob test
account. The API refuses to boot in production with the sandbox adapter unless
explicitly overridden.

### SMS / phone verification

**Status:** not integrated. `PHONE_VERIFICATION=off` by default.

Password-reset tokens are logged server-side and returned in the API response
**in development only**, always accompanied by a notice stating no SMS was
sent. The platform never claims to have sent a message it did not send.

**To enable:** implement a provider behind the existing seam and set
`PHONE_VERIFICATION=sms`.

---

## 3. Needs the teacher's official assets

### Brand

The supplied Facebook page yielded only its name — **"MR Amr Mahrous -
أ/عمرو محروس"**. The content sits behind a login wall, so no logo, photography
or brand colours could be examined.

Accordingly, and deliberately:

- No logo was invented and presented as his
- No AI-generated portrait was passed off as a photograph of him
- No image was scraped; public visibility is not a commercial licence
- No brand colours were claimed to be "his"

Instead, an original design direction was developed from the subject matter
(midnight navy, warm ivory, aged gold, bronze), and every asset slot is built,
wired and waiting. Placeholders are visibly placeholders, never fakes.

See [`docs/operations/brand-assets.md`](docs/operations/brand-assets.md).

### Marketing claims

**No testimonials, student counts, ratings or achievement statistics appear
anywhere on the platform**, because none were supplied. Inventing them would be
a claim the teacher cannot stand behind.

---

## 4. Needs curriculum verification

Unit and lesson titles were compiled in September 2026 from Egyptian education
press and published curriculum-distribution summaries — **not** from a
machine-readable Ministry source, because none was accessible.

| Grade | Confidence |
|---|---|
| أولى ثانوي / أولى بكالوريا | Corroborated across sources; marked verified |
| تانية بكالوريا | Structure confirmed (6 units × 4 lessons, two parts); two lesson titles published verbatim; **rest provisional** |
| تالتة ثانوي | Unit 1 (الحملة الفرنسية) confirmed; **rest provisional** |
| تانية ثانوي | **Provisional throughout** |

Provisional courses carry `isProvisional: true`, and both the public course card
and the admin dashboard show a warning badge. Everything is editable from the
dashboard — no curriculum text is hardcoded in components.

---

## 5. Known limitations

| Area | Limitation |
|---|---|
| **Content protection** | Signed short-lived tickets over private storage stop hotlinking and URL sharing. They do **not** stop screen recording — that needs DRM (Widevine/FairPlay), a separate commercial integration |
| **Scale** | Sound single-host deployment. Video segments stream through the API; ~500 concurrent 720p viewers ≈ 1.4 Gbps. **Move video to a CDN before scaling** |
| **Safari / iOS** | Mobile tests run the Chromium engine at iPhone geometry — layout is validated, WebKit behaviour is not. **Native HLS on iOS needs a real-device check** |
| **Refunds** | Modelled (`REFUNDED` states) but manual. Policy for partially-consumed subscriptions is a commercial decision, not one to guess |
| **Legal pages** | Honest drafts describing actual behaviour. **Not legal advice.** Must be reviewed against Egypt's PDP Law 151/2020, especially on minors' data |
| **Performance scores** | Bundle sizes measured from the production build; **no Lighthouse run performed**, so no Core Web Vitals score is claimed |
| **Load testing** | None performed. The bandwidth figures are arithmetic, not measurement |
| **Arabic copy** | Written to read naturally in Egyptian Arabic, but not reviewed by a native speaker |

---

## 6. Bugs found by running the system

Seven defects surfaced only under execution. Recording them because each was
silent, and four were user-facing:

1. **The rate limiter locked every student out.** A second named throttler in
   NestJS applies globally, not only where referenced — so the strict auth limit
   (8 per 10 min) applied platform-wide. Caught by the container healthcheck
   returning `429`.
2. **Expired entitlements kept working.** Two top-level `OR` keys in a Prisma
   query; the second silently replaced the first, dropping the expiry check.
   The platform would have stopped charging for renewals. Caught by a unit test
   asserting query *shape*.
3. **`/forgot-password` returned 404.** The login page linked to a route that
   was never written, so no student could reset their password.
4. **Presigned upload URLs were unusable by browsers** — signed for the
   internal Docker hostname.
5. **`Domain=localhost` broke sessions** in several HTTP clients.
6. **Signing out bounced to the login page** asking the student to sign back
   into the page they had just left.
7. **The required-field asterisk leaked into accessible names** —
   `aria-hidden` removes a node from the accessibility tree but it still
   contributes to text content.

All fixed, all with regression tests. Details in
[`docs/operations/testing.md`](docs/operations/testing.md).

---

## 7. Starting it

```bash
cp .env.example .env

# Three DIFFERENT secrets — the API refuses to start in production otherwise
openssl rand -hex 48   # JWT_ACCESS_SECRET
openssl rand -hex 48   # JWT_REFRESH_SECRET
openssl rand -hex 48   # PLAYBACK_TOKEN_SECRET

docker compose up -d --build
docker compose --profile seed run --rm seed

BOOTSTRAP_ADMIN_USERNAME=your.admin \
BOOTSTRAP_ADMIN_PASSWORD='at-least-12-characters' \
BOOTSTRAP_ADMIN_FULLNAME='عمرو محروس' \
BOOTSTRAP_ADMIN_PHONE=01000000000 \
docker compose --profile bootstrap run --rm \
  -e BOOTSTRAP_ADMIN_USERNAME -e BOOTSTRAP_ADMIN_PASSWORD \
  -e BOOTSTRAP_ADMIN_FULLNAME -e BOOTSTRAP_ADMIN_PHONE bootstrap-admin
```

Open **<http://localhost:7080>**.

Demo students (development only): `demo.ahmed`, `demo.mariam`, `demo.youssef`,
`demo.nour`, `demo.salma` — password `Demo12345`.

---

## 8. Before going live

1. Rotate every secret; none of the shipped values are usable
2. `COOKIE_SECURE=true`, terminate TLS
3. `PAYMENT_PROVIDER=paymob` with real credentials, **verified on a test account
   first**
4. `SEED_DEMO_DATA=false`, remove demo accounts
5. Restore strict rate limits (`RATE_LIMIT_MAX=120`, `AUTH_RATE_LIMIT_MAX=8`)
6. Review provisional curricula against the official textbooks
7. Upload authorised brand assets
8. Legal review of the privacy and terms pages
9. Plan the CDN migration for video
10. Configure backups **and test a restore**

Full detail: [`docs/deployment/production.md`](docs/deployment/production.md).

---

## 9. Where things are

| Path | Contents |
|---|---|
| [`README.md`](README.md) | Quick start, architecture, limitations |
| [`docs/architecture/overview.md`](docs/architecture/overview.md) | System design and reasoning |
| [`docs/architecture/entitlements.md`](docs/architecture/entitlements.md) | Access control |
| [`docs/architecture/video-pipeline.md`](docs/architecture/video-pipeline.md) | Video, and what it does not protect |
| [`docs/deployment/production.md`](docs/deployment/production.md) | TLS, backups, scaling, recovery |
| [`docs/deployment/payments.md`](docs/deployment/payments.md) | Paymob setup and verification |
| [`docs/operations/admin-guide.md`](docs/operations/admin-guide.md) | Day-to-day administration (Arabic) |
| [`docs/operations/brand-assets.md`](docs/operations/brand-assets.md) | Asset slots |
| [`docs/operations/presence.md`](docs/operations/presence.md) | What "online" measures |
| [`docs/operations/testing.md`](docs/operations/testing.md) | Coverage and what needs a human |
| [`docs/api/README.md`](docs/api/README.md) | API reference |

---

<p align="center">Powered by <a href="https://aurexis.cc/">Aurexis</a></p>
