# API reference

Interactive documentation (development only): **<http://localhost:7400/api/docs>**

Swagger is disabled in production deliberately — it is a map of the attack
surface.

---

## Conventions

**Base path:** `/api`

**Authentication:** httpOnly cookies (`access_token`, `refresh_token`). A
`Bearer` token is also accepted on the `Authorization` header so Swagger and
integration tests work.

**Errors** are uniform, with Arabic messages ready to show a student:

```json
{
  "statusCode": 403,
  "message": "لازم تشتري الحصة أو تشترك عشان تتفرج",
  "code": "FORBIDDEN",
  "path": "/api/videos/abc123/playback",
  "timestamp": "2026-09-22T14:30:00.000Z"
}
```

`message` is a string, or an array of strings when several fields fail
validation.

**Money** is always integer piastres. `12550` = 125.50 EGP.

**Status codes:** `400` validation, `401` not signed in, `403` signed in but not
permitted, `404` missing or not visible to you, `409` conflict, `429` rate
limited.

---

## Authentication

| Method  | Path                           | Auth   | Purpose                      |
| ------- | ------------------------------ | ------ | ---------------------------- |
| `POST`  | `/auth/register`               | —      | Create a student account     |
| `POST`  | `/auth/login`                  | —      | Sign in (username or phone)  |
| `POST`  | `/auth/refresh`                | cookie | Rotate the session           |
| `POST`  | `/auth/logout`                 | —      | End the session              |
| `GET`   | `/auth/me`                     | ✔     | Current account              |
| `PATCH` | `/auth/me`                     | ✔     | Update name / guardian phone |
| `PATCH` | `/auth/me/password`            | ✔     | Change password              |
| `POST`  | `/auth/password/reset/request` | —      | Begin a reset                |
| `POST`  | `/auth/password/reset/confirm` | —      | Complete a reset             |

### `POST /auth/register`

```json
{
  "fullName": "أحمد محمد علي",
  "username": "ahmed.mohamed",
  "password": "Str0ngPass",
  "phone": "01012345678",
  "parentPhone": "01112345678",
  "educationSystem": "GENERAL",
  "gradeLevel": "SEC_1"
}
```

Phone numbers accept `+20…`, `0020…`, Eastern-Arabic digits and separators; all
are normalised to `01XXXXXXXXX`. Only the `010/011/012/015` operator prefixes
are valid.

`gradeLevel` **must belong to** `educationSystem`:

| System    | Valid grades              |
| --------- | ------------------------- |
| `GENERAL` | `SEC_1`, `SEC_2`, `SEC_3` |
| `BACC`    | `BACC_1`, `BACC_2`        |

Any other pairing returns `400`.

### `POST /auth/password/reset/request`

Always returns `200` with the same message, whether or not the phone is
registered — it must not become a way to discover which numbers have accounts.

In development the response also carries `devToken` **and** a `devNotice`
stating that no SMS was sent. No SMS provider is integrated; the UI says so
rather than implying a message is on its way.

---

## Catalogue (public)

| Method | Path                                     | Purpose                              |
| ------ | ---------------------------------------- | ------------------------------------ |
| `GET`  | `/academic/systems`                      | Both pathways with their grades      |
| `GET`  | `/academic/grades`                       | All grades (`?system=GENERAL\|BACC`) |
| `GET`  | `/academic/grades/:slug`                 | One grade with courses and plans     |
| `GET`  | `/academic/years`                        | Academic years                       |
| `GET`  | `/grades/:gradeSlug/courses/:courseSlug` | Full syllabus                        |

Public routes still read the session when one is present, so a signed-in
student receives their `isAccessible` flags and progress inline.

**Unpublished content is never returned to a student**, whatever their
entitlements. Staff receive drafts with `access.reason: "STAFF"`.

---

## Student

| Method | Path                    | Purpose                                   |
| ------ | ----------------------- | ----------------------------------------- |
| `GET`  | `/me/lessons`           | **حصصي** — everything reachable right now |
| `GET`  | `/me/continue-watching` | **كمّل من مكان ما وقفت**                  |
| `GET`  | `/me/progress/summary`  | Totals for the dashboard                  |
| `GET`  | `/lessons/:id`          | Lesson with an access decision            |
| `GET`  | `/lessons/:id/progress` | Saved position                            |
| `PUT`  | `/lessons/:id/progress` | Save position                             |
| `GET`  | `/orders`               | Purchase history                          |
| `GET`  | `/orders/:reference`    | One order                                 |
| `GET`  | `/subscriptions/mine`   | **اشتراكاتي**                             |
| `POST` | `/presence/heartbeat`   | Presence ping                             |

### `GET /lessons/:id`

Returns the lesson plus:

```json
{
  "access": {
    "allowed": false,
    "reason": "NO_ENTITLEMENT",
    "expiresAt": null
  }
}
```

`reason` drives the UI:

| Reason                                                   | Shown as                        |
| -------------------------------------------------------- | ------------------------------- |
| `FREE_PREVIEW`                                           | Plays                           |
| `LESSON_PURCHASE` / `CHAPTER_BUNDLE` / `COURSE_PURCHASE` | Plays                           |
| `SUBSCRIPTION`                                           | Plays, with the expiry date     |
| `STAFF`                                                  | Plays, labelled as staff access |
| `NOT_PUBLISHED`                                          | "لسه مش منشورة"                 |
| `NO_ENTITLEMENT`                                         | **Buy** prompt                  |
| `EXPIRED`                                                | **Renew** prompt                |

The distinction between the last two matters: showing a lapsed subscriber a
"buy this lesson" screen when they need a renewal link loses the sale.

### `PUT /lessons/:id/progress`

```json
{ "positionSeconds": 300, "durationSeconds": 600 }
```

- Entitlement is re-checked on **every** write (`403` if it lapsed mid-session)
- `percent` is computed server-side; a client claiming 100% changes nothing
- `positionSeconds` is clamped to the real duration
- Watch time only accrues on forward movement, so scrubbing cannot inflate
  engagement figures

Called roughly every 15 seconds and on pause/unload — never per frame.

---

## Commerce

| Method | Path                        | Purpose                                                   |
| ------ | --------------------------- | --------------------------------------------------------- |
| `POST` | `/checkout`                 | Create an order, start payment                            |
| `POST` | `/webhooks/payments`        | Provider callback — **the only thing that grants access** |
| `POST` | `/payments/sandbox/confirm` | Development only                                          |

### `POST /checkout`

```json
{ "productIds": ["prod_abc"], "couponCode": "WELCOME10", "method": "CARD" }
```

Send an `Idempotency-Key` header. A repeat with the same key returns the
original order rather than creating a second one.

Prices are read from the database. Any price field in the request body is
rejected by the validation pipe — `forbidNonWhitelisted` is on.

Returns `400` if the student already owns the content, rather than taking money
for something they cannot use twice.

The response always reports the provider:

```json
{
  "payment": {
    "provider": "DEV_SANDBOX",
    "isSandbox": true,
    "notice": "وضع تجريبي: لا تتم أي عملية دفع حقيقية."
  }
}
```

### `POST /webhooks/payments`

Signature-verified, idempotent, transactional. A student returning from the
payment page grants nothing — only this callback does.

Rejects an invalid signature with `400`. A replayed event returns
`{ received: true, duplicate: true }` and changes nothing.

---

## Video

| Method | Path                                      | Purpose                                |
| ------ | ----------------------------------------- | -------------------------------------- |
| `POST` | `/videos/:lessonId/playback`              | Entitlement check → short-lived ticket |
| `GET`  | `/videos/:lessonId/manifest.m3u8?ticket=` | HLS master playlist                    |
| `GET`  | `/videos/:lessonId/hls/*?ticket=`         | Variant playlists and segments         |

`POST /videos/:id/playback` returns:

```json
{
  "ticket": "…",
  "expiresIn": 300,
  "manifestUrl": "/api/videos/abc/manifest.m3u8?ticket=…",
  "posterUrl": "…",
  "durationSeconds": 1820,
  "accessReason": "SUBSCRIPTION",
  "resumeAtSeconds": 240
}
```

The manifest and segment routes are `@Public()` at the guard level because
hls.js cannot attach the auth cookie to segment requests in every mobile
browser. Authorisation comes from the ticket, which is verified on **every
single request**.

---

## Admin

All require staff. `RolesGuard` ranks roles, so a higher role satisfies a lower
requirement.

| Path                               | Minimum role      |
| ---------------------------------- | ----------------- |
| `/admin/dashboard/*`               | `SUPPORT`         |
| `/admin/students` (read)           | `SUPPORT`         |
| `/admin/students/:id/status`       | `ADMIN`           |
| `/admin/students/:id/entitlements` | `ADMIN`           |
| `/admin/content/*`                 | `CONTENT_MANAGER` |
| `/admin/pricing/*`                 | `ADMIN`           |
| `/admin/dashboard/audit`           | `ADMIN`           |

### Dashboard

| Method | Path                                     | Returns                       |
| ------ | ---------------------------------------- | ----------------------------- |
| `GET`  | `/admin/dashboard/overview`              | KPIs from live tables         |
| `GET`  | `/admin/dashboard/online`                | Presence, with its definition |
| `GET`  | `/admin/dashboard/registrations?days=30` | Signups over time             |
| `GET`  | `/admin/dashboard/sales?days=30`         | Orders and revenue over time  |
| `GET`  | `/admin/dashboard/popular-courses`       | Best sellers                  |
| `GET`  | `/admin/dashboard/engagement`            | Completion rates              |
| `GET`  | `/admin/dashboard/audit`                 | Privileged-action log         |

`/online` includes a `definition` field stating that the count is an
approximation based on recent heartbeats. The dashboard shows it verbatim
rather than presenting an estimate as fact.

### Content and video upload

| Method               | Path                                                      |
| -------------------- | --------------------------------------------------------- |
| `GET`/`POST`/`PATCH` | `/admin/content/courses`                                  |
| `POST`/`PATCH`       | `/admin/content/.../units`, `.../chapters`, `.../lessons` |
| `POST`               | `/admin/content/lessons/:id/video/upload-ticket`          |
| `POST`               | `/admin/content/lessons/:id/video/complete`               |
| `GET`                | `/admin/content/lessons/:id/video/status`                 |
| `POST`               | `/admin/content/lessons/:id/video/retry`                  |

Upload is three steps: request a presigned `PUT`, upload straight to storage,
then notify the API, which queues transcoding on the worker. Lesson videos never
pass through the API process.

Student data is never returned with `passwordHash`.

---

## Rate limiting

Two layers.

**nginx** — 30 req/s general, 2 req/s on auth routes. `/api/webhooks/payments`
is exempt: dropping a provider callback would leave a paying student without
access.

**Application** — `RATE_LIMIT_MAX` per `RATE_LIMIT_TTL` globally, tightened on
auth routes, plus a per-identifier login counter in Redis so spreading guesses
across many IPs does not help.

Running an automated suite from one IP needs `AUTH_RATE_LIMIT_MAX` raised; see
[`tests/e2e`](../../tests/e2e/). The API-contract suite talks to the backend
directly to avoid the edge limiter entirely.

---

## Health

| Path                    | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `GET /api/health`       | Liveness — dependency-free                        |
| `GET /api/health/ready` | Readiness — database, Redis, storage individually |
| `GET /healthz`          | Edge liveness (proxy)                             |

```json
{ "status": "ok", "checks": { "database": true, "redis": true, "storage": true } }
```
