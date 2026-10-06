# Video pipeline

Upload, transcoding, and authorised playback — and an honest account of what
this protects and what it does not.

---

## The path a lesson video takes

```
 Admin browser
      │  ① POST /admin/content/lessons/:id/video/upload-ticket
      ▼
   API ──────── presigned PUT URL (1 hour) ────────┐
      │                                            │
      │  ② PUT the file DIRECTLY to storage ───────┘
      ▼                                     ┌──────────────┐
   Object storage (private bucket)  ◄───────│ Admin browser│
      │                                     └──────────────┘
      │  ③ POST .../video/complete
      ▼
   API ── verifies the object landed ── enqueues BullMQ job
      │
      ▼
   Worker container (ffmpeg)
      │  ④ download → probe → HLS ladder → poster
      ▼
   Object storage: hls/<assetId>/…   (private)
                   posters/<id>.jpg  (public)
      │
      │  ⑤ VideoAsset.status = READY
      ▼
   Student: POST /videos/:id/playback
      │  entitlement checked → short-lived ticket
      ▼
   hls.js streams manifest + segments through the API,
   ticket verified on EVERY request
```

---

## ① / ② Direct-to-storage upload

The browser uploads straight to object storage with a presigned URL. The API
issues the URL and is then out of the way.

This matters because lesson videos are large. Routing a 3 GB upload through the
API process would occupy a Node worker for the whole transfer, consume memory
buffering it, and risk timing out at every proxy hop. Direct upload makes the
size of the file irrelevant to API capacity.

### Presigned URLs must be signed for the _public_ host

A presigned URL embeds the endpoint host in both the URL **and the signature**.
Signing against the internal Docker hostname `minio` produces a URL no browser
can use — it cannot resolve the name, and rewriting the host invalidates the
signature.

So `StorageService` keeps two clients:

| Client          | Endpoint                 | Used for                               |
| --------------- | ------------------------ | -------------------------------------- |
| `client`        | `S3_ENDPOINT` (internal) | Server-side reads/writes, bucket setup |
| `signingClient` | `S3_PUBLIC_ENDPOINT`     | Presigned URLs handed to a browser     |

In development these differ (`minio:9000` vs `localhost:7900`). With a real S3
bucket they are the same and the two clients collapse into one.

---

## ④ Transcoding

Runs in its own container ([`workers/`](../../workers/)) because ffmpeg is by
far the heaviest thing in the stack and must scale independently of the API:

```bash
docker compose up -d --scale worker=3
```

### One ffmpeg pass, several outputs

The ladder is produced in a single invocation with `-var_stream_map`, so the
source is decoded **once** rather than once per rendition — roughly a 3×
saving on a three-rung ladder.

### Never upscale

```ts
const applicable = RENDITIONS.filter((r) => r.height <= source.height);
```

A 480p source yields 360p and 480p. Generating a "720p" rendition from it would
burn CPU to produce a larger file that looks no better.

### Keyframe alignment

```
-g (segment × 25)  -keyint_min (segment × 25)  -sc_threshold 0
```

Forcing a keyframe at every segment boundary is what lets the player switch
rendition cleanly when a student's connection changes. Without it, quality
switches stall.

### Progress is real

The worker parses `out_time_us` from ffmpeg's `-progress` stream and writes it
to `video_jobs.progress`, throttled to changes of 5% or more so a long
transcode does not hammer the database. The admin UI polls that value — the bar
reflects actual encoder position, not a timer.

### Failure handling

Failures are recorded on both `VideoAsset` and `VideoJob` with the error text,
then rethrown so BullMQ applies its exponential backoff (3 attempts). The temp
directory is removed in a `finally`, so a failed job cannot fill the disk.

---

## ⑤ Playback authorisation

```
POST /videos/:lessonId/playback
  ├─ checkLessonAccess()       ← the real gate
  ├─ assert VideoStatus.READY
  ├─ mint a random token, store only its SHA-256 hash
  └─ return { manifestUrl, resumeAtSeconds, expiresIn }
```

The ticket is:

- **random**, not a JWT — it must be revocable
- **hashed at rest**, so a database leak does not hand out live streams
- **bound to one student and one lesson**
- **short-lived** (`PLAYBACK_TOKEN_TTL`, default 300s)

Every manifest and every segment request re-validates it. The manifest is
rewritten on the fly so child playlist URLs carry the same ticket.

Segments stream **through the API** rather than via presigned bucket URLs. That
costs some bandwidth through Node, but keeps the storage layer entirely private
and makes revocation immediate — a presigned URL, once issued, works until it
expires no matter what happens to the student's account.

---

## What this protects — and what it does not

**It does protect against:**

- Reading paid video straight out of the bucket (the bucket is private)
- Hotlinking a manifest into another site
- Sharing a URL that keeps working (tickets expire in minutes)
- Continued access after a subscription lapses, a refund, or a suspension
- Scraping the catalogue for media URLs (none exist until authorised)

**It does NOT protect against:**

- **Screen recording.** A student who can watch can record.
- **Re-streaming.** A determined user can capture segments and rebuild the file.
- **Credential sharing.** Two people using one account both get in.

Preventing those requires **DRM** — Widevine, PlayReady or FairPlay — with a
licence server and, for meaningful protection, hardware-backed key handling.
That is a separate commercial integration with per-stream licensing costs, and
it is **not implemented here**. Anyone claiming signed URLs or HLS alone
"prevent piracy" is mistaken, and the README says so.

Practical mitigations short of DRM, none implemented but all straightforward to
add: concurrent-session limits per account, a visible or forensic watermark
carrying the student's id, and alerting on anomalous download volume.

---

## Scaling video delivery

The current setup streams segments through the API. **That is the right default
for a single host and the wrong answer at scale.**

Rough arithmetic: 500 concurrent students at 720p (~2.8 Mbps) is ~1.4 Gbps
sustained. No single VPS serves that, and no amount of Node tuning changes it.

The production path:

1. Keep the private bucket as the origin.
2. Put a CDN in front of it (CloudFront, Bunny, Cloudflare).
3. Swap ticket verification for **signed CDN URLs or cookies**, issued by the
   same `checkLessonAccess` call that issues tickets today.
4. Segments are then served by the CDN's edge; the API only issues signatures.

The entitlement layer does not change — only the last step of handing out
access does. That boundary was drawn deliberately.

---

## Configuration

| Variable                   | Default                                   | Meaning                               |
| -------------------------- | ----------------------------------------- | ------------------------------------- |
| `HLS_RENDITIONS`           | `360p:800:96,480p:1400:128,720p:2800:128` | `heightP:videoKbps:audioKbps`         |
| `HLS_SEGMENT_SECONDS`      | `6`                                       | Segment length                        |
| `VIDEO_WORKER_CONCURRENCY` | `1`                                       | Simultaneous transcodes per container |
| `MAX_UPLOAD_BYTES`         | `5368709120`                              | 5 GB upload ceiling                   |
| `PLAYBACK_TOKEN_TTL`       | `300`                                     | Ticket lifetime, seconds              |

Raise `VIDEO_WORKER_CONCURRENCY` only with CPU headroom to spare; scaling the
number of worker containers is usually the better lever.

---

## Verified behaviour

The pipeline has been exercised end to end against the running stack: a
generated 20-second 1280×720 source was uploaded through a presigned URL,
transcoded to 360p/480p/720p, its duration probed correctly, and played back
through a ticketed manifest down to a real MPEG-TS segment (verified by its
`0x47` sync byte). Requests without a ticket, and with a forged one, were
refused; the private bucket rejected anonymous listing.

See `tests/e2e/specs/api-contract.spec.ts` for the checks that run on every
suite execution.
