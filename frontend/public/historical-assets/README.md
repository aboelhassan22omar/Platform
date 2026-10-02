# Historical artwork

Optional decorative imagery for course covers and grade heroes: maps, archival
documents, monuments, historical illustrations.

**Only place assets here that are properly licensed** — public domain, or
licensed to the teacher. Museum and archive collections often permit
non-commercial use only, which this platform is not.

Good public-domain sources:

- Rijksmuseum, Met Museum and NYPL open-access collections
- Library of Congress Prints & Photographs
- Works whose copyright has expired under Egyptian law

The five grade heroes currently use **original inline SVG motifs** (see
`frontend/src/components/decor/motifs.tsx`) rather than images: no extra
network request, they take the grade's accent colour, and they scale to any
viewport. Anything added here supplements them rather than replacing them.
