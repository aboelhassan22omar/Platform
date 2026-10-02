# Architecture overview

The reasoning behind the system's shape. For access control specifically see
[entitlements.md](entitlements.md); for video see
[video-pipeline.md](video-pipeline.md).

---

## The constraint that shaped everything

Most of this platform is ordinary CRUD. One part is not: **students pay money
for access to specific content, and that access must be correct every single
time.**

Getting it wrong is expensive in both directions. Too permissive and the
teacher gives away paid lessons. Too strict and a paying student is locked out
of something they bought — which costs trust, not just a refund.

So the architecture is organised around making access decisions **unambiguous
and centralised**, and around making it structurally hard to take money without
granting access, or to grant access without taking money.

---

## Services

```
nginx  ──┬── Next.js (frontend)
         └── NestJS (API) ──┬── PostgreSQL
                            ├── Redis ──── BullMQ ──── Worker (ffmpeg)
                            └── Object storage (S3-compatible)
```

| Service | Role | Why separate |
|---|---|---|
| **proxy** | One public origin | Auth cookies stay first-party; TLS terminates once |
| **frontend** | Next.js App Router | Server components render the catalogue with the session cookie |
| **backend** | NestJS REST API | Every authorisation decision lives here |
| **worker** | ffmpeg transcoding | CPU-bound; must scale independently of the API |
| **postgres** | System of record | Orders, entitlements, progress |
| **redis** | Presence + job queue | Ephemeral state that should not touch the database |
| **minio** | Object storage | Video never touches the application filesystem |

### Why one origin

The browser reaches everything through nginx on a single origin. The
alternative — frontend on one host, API on another — makes the session cookie
third-party, which Safari's tracking prevention blocks by default. Students on
iPhones would silently fail to stay logged in.

This also means `/api/*` and `/` share a cookie jar with no CORS complexity in
the normal path.

---

## Deny by default

`JwtAuthGuard` is registered **globally**:

```ts
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

Every route requires authentication unless it carries `@Public()`. A developer
who adds an endpoint and forgets a guard ships something *protected*, not
something exposed. The failure mode of forgetfulness points the safe way.

`RolesGuard` implements a rank hierarchy, so `@Roles(Role.ADMIN)` is satisfied
by `SUPER_ADMIN` without enumerating every role at every call site.

### One throttler, not several

A subtle trap worth recording: registering two named throttlers in
`ThrottlerModule` applies **both** to every route, not just to the routes that
reference them. An early revision registered a strict `auth` throttler
(8 requests / 10 minutes) alongside the default — and it silently applied
globally, locking every student out of the whole API after eight requests.

The fix is one global throttler, with auth routes tightening it via
`@Throttle({ default: { limit, ttl } })`. Login is additionally throttled
per-identifier in Redis, so spreading guesses across many IPs does not help an
attacker.

---

## Data model principles

### Money is integers

Every amount is piastres (1 EGP = 100). `125.50 EGP` is `12550`.

Floating point cannot represent `0.1` exactly; accumulate enough of those and a
student is charged the wrong amount. The database enforces the arithmetic too:

```sql
CHECK ("totalMinor" = "subtotalMinor" - "discountMinor")
```

A calculator bug fails the insert instead of taking the wrong amount.

### History is immutable

`OrderItem` snapshots the title, kind and unit price at purchase time. When the
teacher raises a price, past orders and revenue reports keep what was actually
charged. Products are deactivated, never deleted, so order lines never dangle.

### Constraints live in the database

15 `CHECK` constraints and 5 partial unique indexes enforce rules the
application also checks. The application check gives a friendly Arabic message;
the database constraint is what holds under concurrency.

Examples:

```sql
-- A product must have exactly one target, matching its kind
CHECK ((lessonId IS NOT NULL)::int + (chapterId IS NOT NULL)::int
     + (courseId IS NOT NULL)::int + (planId IS NOT NULL)::int = 1)

-- One active entitlement per student per lesson
CREATE UNIQUE INDEX ... ON entitlements ("userId", "lessonId")
  WHERE status = 'ACTIVE' AND "lessonId" IS NOT NULL;

-- Access cannot expire before it starts
CHECK ("expiresAt" IS NULL OR "expiresAt" > "startsAt")
```

That last one caught a test trying to backdate an entitlement — the constraint
was doing exactly its job.

### Timestamps are UTC

Stored in UTC, formatted for `ar-EG` at the presentation layer. Egypt observes
DST; storing local time would make some hours ambiguous.

---

## Transactions where it matters

Settlement is one transaction:

```ts
await prisma.$transaction(async (tx) => {
  order → PAID
  payment → SUCCEEDED
  entitlements granted
  subscription created
  notification queued
});
```

There is no window in which an order is paid but its entitlements do not exist.
The alternative — commit the order, then grant access — leaves a paying student
locked out if the process dies in between, and that is precisely the failure a
student will notice and complain about.

Audit entries are written **inside** the transaction they describe, so the log
cannot disagree with reality.

---

## Frontend

### Server components read the API

Catalogue pages fetch on the server, forwarding the session cookie:

```ts
const cookieHeader = (await headers()).get('cookie') ?? '';
const grade = await apiFetchServer<GradeDetail>(`/academic/grades/${slug}`, cookieHeader);
```

The student gets rendered HTML with their access state already resolved — no
loading spinner, no flash of locked content that then unlocks.

Server-side calls go direct over the compose network (`INTERNAL_API_URL`),
skipping the proxy; the browser goes through the public origin.

### Auth is in httpOnly cookies

No token is ever readable by JavaScript, so an XSS bug cannot steal a session.
Refresh tokens are opaque random bytes stored hashed, and they rotate on every
use — presenting an already-rotated token means it leaked, so **every** session
for that user is killed rather than just refusing the request.

### `isAccessible` is a rendering hint

The frontend draws locks from a boolean the API returns. That boolean is
advisory. Playback, progress and the library each re-check independently on the
server, so a modified client gains nothing.

---

## Motion system

Heavy animation was an explicit requirement, which makes incoherence and jank
the real risks rather than "not enough movement". Three rules:

1. **Only `transform` and `opacity` animate.** Those are the two properties the
   compositor handles without re-laying-out the page — the difference between
   smooth and janky on a mid-range Android.
2. **One easing vocabulary**, shared between the CSS custom properties and the
   JS variants, so CSS transitions and Motion animations agree.
3. **`reducedMotion: 'user'` globally.** Set once in `MotionConfig`; components
   never re-implement the check.

Scroll reveals use `once: true`. Re-animating on every scroll-past is the most
reliable way to make an animated page tiring to actually use.

---

## The five academic identities

One set of components renders five visually distinct experiences. A `themeKey`
on the `Grade` row selects an entry in
[`frontend/src/themes/registry.ts`](../../frontend/src/themes/registry.ts),
which re-points CSS custom properties via `[data-theme]`:

```css
[data-theme='modern-egypt-archive'] {
  --accent: #8c2f39;
  --hero-wash: /* … */;
}
```

Each theme also supplies its own decorative SVG motif, chronological strip and
stagger rhythm — تالتة ثانوي animates more slowly than the others because it is
the exam year and should feel composed rather than busy.

Adding a sixth identity is a registry entry and a CSS block. Nothing forks.

---

## Trade-offs taken deliberately

| Decision | Cost | Why anyway |
|---|---|---|
| Segments stream through the API | API bandwidth | Storage stays fully private and revocation is immediate. Documented as the first thing to move to a CDN |
| Re-read the user on every request | One indexed lookup | Suspension and forced logout take effect immediately, not at token expiry |
| Presence in Redis with a durable mirror | Slight complexity | Survives a Redis flush without writing to Postgres on every heartbeat |
| Curriculum in a seed file, admin-editable | Placeholder content ships | The teacher owns the curriculum; hardcoding it in components would make every correction a deploy |
| Entitlements never hard-deleted | Table grows | A refund dispute must be reconstructable |

---

## What is deliberately not built

- **DRM.** Signed tickets stop hotlinking, not screen recording. Claiming
  otherwise would be false.
- **Automated refunds.** Modelled but manual; the policy for partially-consumed
  subscriptions is a commercial decision, not one to guess at.
- **SMS.** No provider is integrated; the UI says so rather than implying a
  message was sent.
- **Multi-tenancy.** This is one teacher's platform. Adding tenants later means
  a tenant column and a query-level filter, not a redesign.
