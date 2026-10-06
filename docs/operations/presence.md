# Online-student tracking

What the "متواجدون الآن" number on the admin dashboard actually measures — and
what it does not.

---

## The definition

> A student is counted as **online** if the client sent an authenticated
> heartbeat within `PRESENCE_TTL_SECONDS` (default 120).

That is the whole definition. It is stated in the API response and displayed
verbatim on the dashboard, so nobody has to guess.

---

## What it does not mean

**It is an approximation of activity, not proof of attention.**

Specifically, it does **not** prove that:

- the student is looking at the screen
- the student is watching a lesson
- the student is learning anything

A phone left on a desk with the tab in the foreground keeps counting until the
TTL lapses. A student reading carefully with the tab hidden behind another app
does not count at all.

Reported honestly, this is still a genuinely useful signal: **when are students
actually on the platform?** That answers real questions — when to publish a
lesson, when to schedule a live session, whether a revision push landed.

Reported dishonestly — as "students currently studying" — it would lead the
teacher to bad decisions based on a number that never meant that.

---

## How it works

### The client

`PresenceReporter` sends a heartbeat every `PRESENCE_HEARTBEAT_SECONDS`
(default 45) and is deliberately conservative:

```
only when signed in
  AND document.visibilityState === 'visible'
```

It stops while the tab is hidden and sends one immediately on becoming visible
again. A forgotten background tab therefore drops out of the count within the
TTL rather than inflating it indefinitely.

A failed heartbeat is swallowed: a missed ping is not worth interrupting a
student for.

### The server

Redis holds the live set as a **sorted set** scored by last-seen timestamp:

```
ZADD presence:online <now> <userId>
```

Expiry is then a range query rather than a scan:

```
ZREMRANGEBYSCORE presence:online 0 <now - ttl>
ZRANGE presence:online 0 -1
```

Counting online students is O(log N + M) regardless of total registered users.

### The durable mirror

`presence_records` in Postgres mirrors the last-seen time so the data survives
a Redis flush and can back historical reporting.

Writing to Postgres on every heartbeat would be one write per student per 45
seconds — at 500 concurrent students that is ~11 writes/second of pure
bookkeeping. Instead a Redis key with the TTL as its expiry gates the mirror
write:

```ts
const fresh = await redis.set(`presence:mirrored:${userId}`, '1', 'EX', ttl, 'NX');
if (fresh) {
  /* write to Postgres */
}
```

So the mirror is written at most once per TTL window per student — a ~60×
reduction in database writes for the same information.

---

## Breakdown by grade

`GET /admin/dashboard/online` returns:

```json
{
  "total": 47,
  "byGrade": [
    { "gradeLevel": "SEC_3", "count": 23 },
    { "gradeLevel": "SEC_1", "count": 14 }
  ],
  "definition": "طالب نشط خلال آخر 120 ثانية (تقدير وليس تأكيدًا للمشاهدة الفعلية)"
}
```

The `definition` field exists so the UI can show the caveat next to the number
rather than in documentation nobody opens.

---

## Tuning

| Variable                     | Default | Effect                                 |
| ---------------------------- | ------- | -------------------------------------- |
| `PRESENCE_HEARTBEAT_SECONDS` | `45`    | How often the client pings             |
| `PRESENCE_TTL_SECONDS`       | `120`   | How long a ping keeps someone "online" |

Keep the TTL at roughly **2–3×** the heartbeat. Too tight and a single dropped
request makes an active student flicker offline; too loose and the number lags
reality by minutes.

Raising the heartbeat frequency increases request volume linearly, for a figure
that is an approximation anyway. 45 seconds is a reasonable balance.

---

## Privacy

Presence stores a user id, a timestamp, a coarse route (`lesson:<id>` or
`dashboard`) and a truncated user agent. It does **not** store IP addresses,
and the route is capped at 120 characters.

Redis entries expire naturally. The Postgres mirror is one row per student,
overwritten in place — it does not accumulate a movement history.

The route is kept only so support can answer "where were they when it broke?".
If even that is more than you want to retain, drop the `lastRoute` column; the
count keeps working.

---

## Sizing

The sorted set holds one entry per online student — roughly 100 bytes each. Ten
thousand concurrent students is about 1 MB. Redis is not the constraint here.
