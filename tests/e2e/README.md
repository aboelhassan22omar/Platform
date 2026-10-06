# End-to-end tests

These run against the **running Docker stack**, not a mocked one. The behaviour
worth testing here — entitlement enforcement, webhook settlement, HLS playback,
RTL layout — only exists when the whole system is up.

---

## Setup

```bash
# 1. Bring the stack up and load the catalogue
cd ../..
docker compose up -d --build
docker compose --profile seed run --rm seed

# 2. Relax the rate limits (see below), then restart the API
#    .env:  RATE_LIMIT_MAX=3000
#           AUTH_RATE_LIMIT_MAX=1000
docker compose up -d --force-recreate backend

# 3. Install the runner
cd tests/e2e
npm install
npx playwright install chromium
```

### Why the rate limits need raising

The suite fires hundreds of requests from a single IP, which the
production-grade limiter is designed to stop — that limiter working is a
feature, not a bug.

Two layers are in play:

- **Application** (`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`) — raised for test
  runs, strict in `.env.example` for production
- **nginx edge** (2 req/s on auth routes) — not raised. The API-contract suite
  talks to the backend **directly** on port 7400 to bypass it, because
  throttling is not what that suite measures. Browser suites go through the
  proxy, where the user path actually is.

---

## Running

```bash
npm test                  # everything, desktop
npm run test:mobile       # everything, at 360px

npm run test:journey      # the student journey
npm run test:api          # API contract and security
npm run test:responsive   # layout across 9 viewport widths

npx playwright test -g "Aurexis"      # anything matching
npx playwright test --ui              # interactive
npm run report                        # last HTML report
```

`E2E_BASE_URL` and `E2E_API_URL` override the targets if your ports differ.

---

## The suites

| File                      | Covers                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `student-journey.spec.ts` | register → locked → purchase → settle → unlock → progress → sign out → sign in → **resume**. Plus pathway selection, the five themed identities, and the Aurexis footer credit |
| `api-contract.spec.ts`    | Entitlement enforcement, cross-student isolation, price integrity, checkout/webhook idempotency, progress clamping, RBAC on every admin route                                  |
| `password-reset.spec.ts`  | The full reset flow, and that the request endpoint cannot be used to discover which phone numbers have accounts                                                                |
| `responsive.spec.ts`      | 14 pages × 9 widths (320→1440) asserting no horizontal overflow, plus RTL, Arabic fonts, 44px touch targets, drawer behaviour, reduced motion                                  |

---

## Projects

| Project          | Viewport   | Engine          |
| ---------------- | ---------- | --------------- |
| `desktop-chrome` | 1440 × 900 | Chromium        |
| `mobile-360`     | 360 × 800  | Chromium, touch |
| `mobile-390`     | 390 × 844  | Chromium, touch |
| `tablet`         | 768 × 1024 | Chromium, touch |

> **The mobile projects run the Chromium engine at iPhone geometry.** That
> validates _layout_ at those dimensions, not WebKit behaviour. **Native HLS
> playback on iOS still needs a check on a real device** — see
> [`docs/operations/testing.md`](../../docs/operations/testing.md).

Tests run with `workers: 1` and `fullyParallel: false` because entitlement
tests mutate shared server state.

---

## Writing tests

**Use a fresh student per test.** `newStudent()` generates a unique username and
phone, so tests never contend over one account:

```ts
const ctx = await newSession();
await registerStudent(ctx);
// ...
await ctx.dispose();
```

**Adding a page?** Add it to `PUBLIC_PAGES` in `responsive.spec.ts`. It is then
checked at all nine widths automatically — which is exactly how a route that
404s gets caught.

**Two habits worth keeping**, both learned from real bugs in this codebase:

- **Prefer `load` over `networkidle`.** Next.js prefetches linked routes, so
  network activity continues after the page is visually complete. `gotoSettled()`
  waits for `load` plus fonts plus one frame — faster, and a truer signal.
- **Locate controls unambiguously.** `getByLabel('كلمة السر')` also matches the
  show-password button (`إظهار كلمة السر`). Use
  `page.locator('input[name="password"]')` when a label is a substring of
  another.

---

## Debugging a failure

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

Traces, screenshots and video are retained on failure (`retain-on-failure`), so
a flaky run leaves everything needed to diagnose it.

If many tests fail at once with `429` or `503`, the rate limits are the cause —
see setup above.
