# Brand assets

Where the teacher's official logo, photography and artwork go — and why none
of them ship with this build.

---

## Why the platform ships without brand assets

The brief asked for the teacher's public brand to be researched and used as the
basis for the visual identity. Here is exactly what happened.

**What was attempted:** the supplied Facebook page was fetched and additional
public sources were searched.

**What was found:** the page name, **"MR Amr Mahrous - أ/عمرو محروس"**. Nothing
else — the page content sits behind a login wall, so no profile photo, cover
image, promotional graphics, logo or brand colours could be examined. Searches
for the teacher across other public sources returned results for different
people with similar names, none of them a history teacher.

**What was therefore NOT done:**

- No logo was invented and presented as his.
- No AI-generated portrait was created and passed off as a photograph of him.
- No image was scraped from Facebook and embedded. Being publicly *visible* is
  not the same as being licensed for commercial reuse, and the platform must not
  ship with imagery whose rights are unclear.
- No brand colours were claimed to be "his".

**What was done instead:** an original design direction was developed from the
subject matter — deep midnight navy, warm ivory, aged gold and bronze, drawn
from archival and museum design rather than from any existing material. Every
place an official asset belongs is built, wired and waiting.

This is a limitation, and it is recorded in the README rather than glossed over.

---

## What the teacher needs to supply

| Asset | Format | Size | Used on |
|---|---|---|---|
| Primary logo | SVG preferred, else PNG with transparency | ≥ 512px | Header, footer, auth pages |
| Logo mark | SVG / PNG | ≥ 256px square | Mobile header, favicon |
| Portrait | JPG / WebP | ≥ 1200 × 1600 | About page, homepage hero |
| Teaching photos | JPG / WebP | ≥ 1600px wide | About page, course covers |
| Course thumbnails | JPG / WebP, 16:9 | 1280 × 720 | Course and lesson cards |
| Favicon | ICO / PNG | 32×32, 180×180 | Browser tab, iOS home screen |

**Before uploading anything, confirm the teacher holds the rights to it.** A
photograph taken by a hired photographer usually belongs to the photographer
unless the contract says otherwise. A graphic made by a designer is the same.
This matters commercially, not just legally.

---

## Where assets go

### Static brand files

```
frontend/public/brand/
├── logo.svg              # primary logo
├── logo-mark.svg         # square mark
├── portrait.webp         # teacher portrait
└── favicon.ico
```

Referenced as `/brand/logo.svg`. Anything in `public/` is served as-is and
cached hard, so use content-hashed names if you replace a file often.

### Editable text and links

Brand copy lives in the `site_settings` table so it can change without a
redeploy:

```sql
SELECT value FROM site_settings WHERE key = 'brand';
```

```json
{
  "teacherName": "عمرو محروس",
  "teacherTitle": "مدرس التاريخ",
  "platformName": "منصة عمرو محروس التعليمية",
  "tagline": "ابدأ رحلة التاريخ",
  "logoUrl": null,
  "portraitUrl": null
}
```

Set `logoUrl` to `/brand/logo.svg` once the file exists, and `portraitUrl`
likewise. The components already read these and fall back to the current
placeholder when they are `null`.

### Course and lesson images

These are **uploaded**, not committed — they change often and are per-course.
They go to the public object-storage bucket and are referenced by key:

```
thumbnails/courses/<courseId>.webp
thumbnails/lessons/<lessonId>.webp
```

Upload them from the admin dashboard; `StorageService.publicUrl()` resolves the
key to a URL.

> Only **non-sensitive** images belong in the public bucket. It is
> world-readable by design. Lesson video never goes near it.

---

## Placeholders currently in use

Each one is deliberate and visibly a placeholder, not a fake:

| Where | Current state |
|---|---|
| Header / footer logo | The letter **ع** in a gold-bordered tile |
| About page portrait | A framed slot reading *"مكان صورة الأستاذ الرسمية"* |
| About page biography | A note saying the profile copy is still being prepared |
| Contact details | A note saying they will be added from the dashboard |
| Course covers | The grade's themed gradient |
| Homepage statistics | **None.** No student counts, ratings or testimonials appear anywhere, because none were supplied. Inventing them would be a marketing claim the teacher cannot stand behind. |

The **ع** monogram is a reasonable long-term mark if the teacher likes it — it
is original, works at any size, and reads clearly in both scripts. But it is a
placeholder until he says otherwise.

---

## Swapping in real assets

1. Drop files into `frontend/public/brand/`.
2. Update the `brand` site setting with their paths.
3. Rebuild the frontend image:
   `docker compose build frontend && docker compose up -d frontend`
4. Check the header, footer, `/about` and `/login` on a phone as well as a
   desktop.

No component changes are needed. That was the point of routing everything
through the asset slots and the settings row.

---

## Design direction, for whoever takes it further

If a designer produces a proper identity later, these are the constraints the
current system assumes:

- **Palette:** midnight navy `#121c33` ground, ivory `#fdfbf7` surface, gold
  `#c8952a` accent. Each of the five grades then re-points the accent only —
  see `frontend/src/themes/registry.ts`.
- **Type:** Cairo for body, Tajawal for display. Both cover Arabic properly and
  are self-hosted, so there is no layout shift when they load.
- **Logo:** must work on both a dark navy and a light ivory ground, and must
  stay legible at 40px for the mobile header.
- **Photography:** warm, high-contrast, shallow depth of field suits the
  existing surfaces. Avoid busy backgrounds — the cards crop to 16:9.

Whatever replaces the placeholders should keep the five grade identities
distinguishable, since students navigate partly by colour.
