# Testing

What is covered, how to run it, and what still needs a human.

---

## Running the tests

### Backend unit tests

No database needed — Prisma is mocked, so these run in seconds.

```bash
cd backend
npm test              # 73 tests
npm run test:cov      # with coverage
```

### End-to-end

These run against the **running Docker stack**, because the behaviour worth
testing — entitlement enforcement, webhook settlement, HLS playback — only
exists when the whole system is up.

```bash
docker compose up -d --build
docker compose --profile seed run --rm seed

cd tests/e2e
npm install
npx playwright install chromium

npm test                  # everything, desktop
npm run test:mobile       # everything, at 360px
npm run test:api          # API contract only
npm run test:journey      # the student journey only
npm run test:responsive   # layout only
```

> **Raise the rate limits first.** The suite fires hundreds of requests from one
> IP, which the production-grade limiter is designed to stop. Set
> `RATE_LIMIT_MAX=3000` and `AUTH_RATE_LIMIT_MAX=1000` in `.env` and restart the
> backend. Keep the strict defaults for production.

---

## What is covered

### Unit — `backend/src/**/*.spec.ts` (73 tests)

| Area | What is asserted |
|---|---|
| **Entitlements** | All five granting scopes; expiry; staff bypass; renewal extends rather than resets; grade/year isolation; idempotent grants; bulk filtering runs a fixed number of queries |
| **Money** | Piastre conversion; half-up rounding; discount caps; float-artifact cases (`0.1 + 0.2`, `1.005`) |
| **Phone** | All accepted input shapes including Eastern-Arabic digits; every invalid operator prefix; masking for logs |

One of these caught a real bug — see [Bugs the tests caught](#bugs-the-tests-caught).

### E2E — `tests/e2e/specs/` (191 tests per project)

**`api-contract.spec.ts`** — the rules that protect the business:

- A paid lesson is locked; playback returns `403` and produces no media URL
- Buying one lesson unlocks exactly that lesson
- One student cannot read another's content or orders
- Order totals come from the database; client-supplied prices are rejected
- Checkout is idempotent per `Idempotency-Key`
- A replayed webhook grants nothing extra
- An unsigned webhook is rejected
- Owned content cannot be bought twice
- Progress percent is server-derived and clamped
- Every admin route refuses students (`403`) and anonymous callers (`401`)
- Unpublished lessons never reach the public catalogue

**`student-journey.spec.ts`** — the whole thing through the real UI:

register → empty library → locked lesson → purchase → sandbox settlement →
unlocked → progress saved → sign out → sign in → **progress still there**.

Plus pathway selection (a بكالوريا grade never appears under الثانوية العامة),
the five distinct themes resolving to five distinct accent colours, and the
Aurexis footer credit (present, centred, correct `href`/`target`/`rel`, visible
on a phone).

**`password-reset.spec.ts`** — including the privacy property: the request
endpoint answers identically for a registered and an unregistered phone, and
mints no token for the latter.

**`responsive.spec.ts`** — 14 pages × 9 viewport widths (320 → 1440), asserting
no horizontal overflow, plus RTL, Arabic font loading, 44px touch targets,
mobile drawer behaviour and reduced motion.

---

## Bugs the tests caught

Worth recording, because each was silent.

**1. The global rate limiter locked everyone out.**
Registering a second named throttler in `ThrottlerModule` applies it to *every*
route, not only the ones referencing it. The strict auth limit (8 per 10
minutes) therefore applied platform-wide — every student would have been
locked out of the entire API after eight requests. Found by the container
healthcheck failing with `429`.

**2. Expired entitlements kept working.**
Two top-level `OR` keys in a Prisma query: the second silently replaced the
first, dropping the expiry check. Every lapsed subscription would have kept
working — the platform would simply have stopped charging for renewals. Found
by a unit test asserting the query's *shape*, not just the happy path.

**3. `/forgot-password` did not exist.**
The login page linked to a route that returned 404, so no student could reset
their password. Found because the responsive suite's `networkidle` wait never
settled on `/login` — a hanging prefetch of the missing route.

**4. Presigned upload URLs were unusable by browsers.**
They were signed for the internal Docker hostname `minio`, which no browser can
resolve, and the host cannot be rewritten without invalidating the signature.
Found by the video-pipeline test failing DNS resolution.

**5. `Domain=localhost` broke sessions.**
A single-label `Domain` attribute is rejected or mishandled by several HTTP
clients and browsers. Found when the journey suite's session silently failed to
persist.

**6. Signing out bounced to the login page.**
Clearing the user raced the navigation home, so the route guard redirected to
`/login?next=<the page just left>` — asking a student to sign back into the page
they had deliberately signed out of.

**7. The required-field asterisk leaked into accessible names.**
`aria-hidden` removes a node from the accessibility tree but it still
contributes to text content, so inputs were named "كلمة السر *". Fixed with
`content: '*' / ''`, which gives the marker empty alternative text.

Items 1, 2, 3 and 6 were user-facing defects that no amount of code review had
surfaced. They appeared only when the system was actually run.

---

## What still needs a human

Stated plainly rather than implied by silence.

| Area | Why automation is not enough |
|---|---|
| **Safari / iOS** | The mobile projects run the Chromium engine at iPhone geometry. That validates layout, not WebKit behaviour. **Native HLS playback on iOS must be checked on a real device.** |
| **Paymob** | The adapter is written to the documented API but has never run against live or sandbox merchant credentials. Work through the checklist in [payments.md](../deployment/payments.md) on a test account first. |
| **Arabic copy** | Tests assert that strings are present, not that they read naturally. A native Egyptian Arabic speaker should review the student-facing wording. |
| **Curriculum accuracy** | Tests assert structure, not correctness. Courses flagged `isProvisional` need checking against the official textbooks. |
| **Real-network video** | Transcoding and playback are verified locally. Behaviour on Egyptian mobile networks — quality switching, buffering, data usage — needs field testing. |
| **Load** | No load test has been run. The bandwidth arithmetic in [video-pipeline.md](../architecture/video-pipeline.md) is arithmetic, not measurement. |
| **Lighthouse** | Bundle sizes are known (102 kB shared, most routes under 175 kB first load) but no Lighthouse run has been performed, so no performance score is claimed. |

---

## Adding tests

**Business rule?** Unit test in `backend/src/**/*.spec.ts`. Mock Prisma; keep it
fast.

**Cross-service behaviour?** E2E in `tests/e2e/specs/`. Use a fresh student per
test (`newStudent()`) so tests never contend for one account.

**Layout?** Add the route to `PUBLIC_PAGES` in `responsive.spec.ts`. It is then
automatically checked at all nine widths — which is exactly how the missing
`/forgot-password` route would have been caught earlier.

Two habits worth keeping, both learned the hard way above:

- **Assert on query shape when a condition must always apply.** A dropped
  `AND` looks exactly like a generous business rule.
- **Prefer `load` over `networkidle`** for layout tests. An app that prefetches
  routes may never reach network idle, and waiting on it fails layout tests for
  network reasons.
