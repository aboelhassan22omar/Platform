# Brand assets

Drop the teacher's **authorised** official assets here:

| File | Purpose |
|---|---|
| `logo.svg` | Primary logo — header, footer, auth pages |
| `logo-mark.svg` | Square mark — mobile header, favicon source |
| `portrait.webp` | Teacher portrait — About page |
| `favicon.ico` | Browser tab |

Then point the `brand` site setting at them:

```sql
UPDATE site_settings
SET value = jsonb_set(
  jsonb_set(value, '{logoUrl}', '"/brand/logo.svg"'),
  '{portraitUrl}', '"/brand/portrait.webp"')
WHERE key = 'brand';
```

Rebuild the frontend image afterwards.

---

**Before uploading anything, confirm the teacher holds the rights to it.**
A photograph usually belongs to the photographer, and a graphic to the
designer, unless a contract says otherwise.

This directory ships empty on purpose. The Facebook page supplied for brand
research is behind a login wall, so no logo, photography or brand colours could
be examined — and nothing was invented, generated or scraped in their place.

See `docs/operations/brand-assets.md` for the full account.
