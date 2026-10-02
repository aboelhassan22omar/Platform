# Access control — the entitlement engine

> The single question this subsystem answers: **may this student watch this
> lesson, right now?**

Everything paid on the platform routes through one service,
[`backend/src/entitlements/entitlements.service.ts`](../../backend/src/entitlements/entitlements.service.ts).
Nothing else is allowed to decide.

---

## Why a separate table instead of flags on the purchase

The obvious design — "the student bought lesson X, so look at their orders" —
falls apart as soon as more than one thing can unlock the same lesson. Here,
four different purchases can:

- the lesson itself
- the chapter it belongs to
- the whole course
- a monthly or yearly subscription to its grade

With order-based checks, "can they watch this?" becomes a different query for
each product type, and every new product type means auditing every call site.
It also cannot express an admin grant, a refund, or a subscription that lapses.

So purchases and access are separated:

```
Order ──creates──> Entitlement ──authorises──> playback
```

An `Entitlement` records *what a student may reach and until when*, regardless of
how they came by it. Adding a product type means teaching `grantForProduct`
about it once; every access check already works.

---

## The model

```prisma
model Entitlement {
  userId    String
  scope     EntitlementScope   // LESSON | CHAPTER | COURSE | GRADE_MONTHLY | GRADE_YEARLY
  status    EntitlementStatus  // ACTIVE | EXPIRED | REVOKED
  source    EntitlementSource  // PURCHASE | ADMIN_GRANT | PROMOTION | MIGRATION

  // Exactly one target, matching `scope`:
  lessonId  String?
  chapterId String?
  courseId  String?
  gradeId        String?
  academicYearId String?

  startsAt  DateTime
  expiresAt DateTime?   // null = perpetual
}
```

`expiresAt IS NULL` means perpetual, which is what an individual lesson,
chapter or course purchase gets: the student paid once and keeps it. Only
subscriptions carry an end date.

---

## Granting access

`grantForProduct()` runs **inside the same transaction** that marks the order
paid. That is the whole point: there is no window in which an order is `PAID`
but its entitlements do not exist, and none in which entitlements exist for an
order that was never paid.

It is idempotent in two independent layers:

1. **Application** — it looks for an existing live entitlement for the same
   target and reuses it.
2. **Database** — partial unique indexes reject a duplicate insert even if two
   webhook deliveries race past step 1:

```sql
CREATE UNIQUE INDEX entitlements_unique_active_lesson
  ON entitlements ("userId", "lessonId")
  WHERE status = 'ACTIVE' AND "lessonId" IS NOT NULL;
```

The `WHERE status = 'ACTIVE'` clause matters: a revoked entitlement can
legitimately be re-granted later, so the constraint must not apply to it.

### Renewals extend, they do not reset

```ts
const base =
  existing?.expiresAt && existing.expiresAt > new Date()
    ? existing.expiresAt   // extend from the current expiry
    : new Date();          // or start fresh if it already lapsed
```

A student with 10 days left who buys another month ends up with 40 days, not
30. Resetting to `now + 30` would quietly take the 10 days they already paid
for — a small bug with a large trust cost.

---

## Checking access

`checkLessonAccess()` returns a decision *and a reason*, because the reason
determines what the student is shown:

| Reason | Meaning | UI response |
|---|---|---|
| `FREE_PREVIEW` | Marked free | Plays |
| `LESSON_PURCHASE` | Owns the lesson | Plays |
| `CHAPTER_BUNDLE` | Owns the chapter | Plays |
| `COURSE_PURCHASE` | Owns the course | Plays |
| `SUBSCRIPTION` | Covered by a live subscription | Plays, with an expiry note |
| `STAFF` | Staff preview | Plays, labelled as staff access |
| `NOT_PUBLISHED` | Draft or archived | "لسه مش منشورة" |
| `NO_ENTITLEMENT` | Never had access | **Buy** prompt |
| `EXPIRED` | Had access, it lapsed | **Renew** prompt |

Distinguishing the last two is worth the extra query. Showing a returning
subscriber a "buy this lesson" screen, when what they need is a renewal link,
loses the sale.

### The query, and a bug worth remembering

All four granting scopes resolve in one query. The structure is load-bearing:

```ts
where: {
  userId,
  status: 'ACTIVE',
  startsAt: { lte: now },
  AND: [
    { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },  // still valid
    { OR: [ /* ...the four scopes... */ ] },                     // covers it
  ],
}
```

An earlier revision spread the expiry condition in alongside a second top-level
`OR`:

```ts
// WRONG — the second OR silently replaces the first
where: { userId, ...live, OR: [ /* scopes */ ] }
```

In JavaScript the later key wins, so the expiry check vanished and **every
lapsed subscription kept working**. Nothing failed loudly; the platform simply
stopped charging for renewals.

It was caught by a unit test asserting the query's shape, and there is now a
regression test at both levels:

- `backend/src/entitlements/entitlements.service.spec.ts` — asserts both `OR`
  groups survive under `AND`
- `tests/e2e/specs/api-contract.spec.ts` — proves an expired entitlement
  actually blocks playback, the library and progress writes

The lesson: when a condition must *always* apply, assert on the query, not just
on the happy path. A dropped `AND` looks exactly like a generous business rule.

---

## Bulk checking

Lesson lists would otherwise run one access check per row. `filterAccessibleLessonIds()`
answers for a whole list in **two queries regardless of size** — one for the
lessons, one for the student's live entitlements — then resolves membership in
memory. A 500-lesson course costs the same two round trips as a 5-lesson one.

---

## Where it is enforced

| Surface | Enforcement |
|---|---|
| `POST /videos/:id/playback` | `checkLessonAccess` before any ticket is issued |
| `GET /api/videos/:id/manifest.m3u8` | Ticket required and verified per request |
| `GET /api/videos/:id/hls/*` | Ticket required and verified per segment |
| `PUT /lessons/:id/progress` | `checkLessonAccess` on every write |
| `GET /me/lessons` | Built from live entitlements only |
| `GET /lessons/:id` | Returns the decision; never the media URL |

The frontend's `isAccessible` flag is a **rendering hint**. It decides whether
to draw a lock, nothing more. Every endpoint above re-checks independently, so
a modified client gains exactly nothing.

---

## Expiry is enforced at read time

A scheduled job flips lapsed rows from `ACTIVE` to `EXPIRED` hourly, but that
job is **housekeeping, not enforcement**. Access checks already compare
`expiresAt` against the current time, so a student whose subscription ended
five minutes ago is refused immediately — not whenever the cron next happens to
run.

The job exists to keep "active subscriptions" counts honest and to free the
partial unique index for a renewal.

---

## Deliberate limits

- **Grade changes are not self-service.** Moving grade would change which paid
  content is in scope, so it goes through support and is recorded in the audit
  log.
- **Entitlements are never hard-deleted.** Revocation sets `REVOKED` with a
  reason and an actor, so a refund dispute can be reconstructed.
- **Staff access is reported honestly.** An admin previewing a draft gets
  `reason: 'STAFF'`, not a fake purchase — analytics must not count staff
  previews as student engagement.
