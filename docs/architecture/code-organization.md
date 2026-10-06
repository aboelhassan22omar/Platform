# Code organization

Routes compose features; features own their state and rules; shared components and utilities remain independent of feature screens. Public teacher/subject identity is resolved once through `config/platform.config.ts`, with pure defaults in `platform-identity.ts`. Subject profiles and history artwork are separate modules.

## Frontend

- `app`: routing, metadata, server data loading and page composition.
- `features`: account flows, catalog, player, live, administration, legal pages and store.
- `components`: shared controls, layouts and providers.
- `config`: teacher identity, subjects, academic levels and navigation.
- `themes`: history presets and subject-aware theme selection.
- `lib`: reusable API, money, phone and formatting utilities.
- `types`: API contracts.

The admin content screen composes `content-course-tree`, `content-editor`, `content-upload-dialog` and `content-ui`. The store is split into landing, grade grid, product details, checkout and staff managers. Its reducer and snapshot validation have no React dependency, so changes to pricing, stock or order rules can be tested without rendering a page.

## API and worker

`AdminContentController` preserves HTTP routes, DTO validation and role restrictions, and delegates to `ContentCatalogService`, `ContentLessonsService` and `ContentDeletionService`. Each service owns its database transactions, audit records and resource checks. Scheduled publication is validated through one shared helper. Purchased content remains protected from permanent deletion.

Video processing is split into worker startup, environment configuration, infrastructure clients, media commands, storage transfers and the job processor. The job processor owns database states and cleanup; media functions receive transcoding options explicitly.

Seed types, grade metadata, subscription plans and the history curriculum are separate. A new subject starts with empty course scaffolding. Switching branding never rewrites existing educational data.

## Maintenance

`npm run format` applies Prettier. `npm run lint` checks source across the three applications, `npm run typecheck` checks all TypeScript projects, `npm run test:unit` exercises the API and `npm run test:models` exercises pure frontend rules and identity configuration. `npm run check` runs these checks together.

`npm run audit:source` follows static imports from runtime, seed and test entry points to identify unreachable TypeScript modules. Verify dynamic usage before deleting anything it reports. Generated Prisma clients, build artifacts, secrets, database migrations and runtime volumes are outside source cleanup.

`npm run audit:assets` checks public and root images against frontend source and local environment overrides. It reports unused images for review and fails on missing local image references. Runtime uploads are outside this audit; review dynamically assembled paths before removing a reported file.

With the Docker worker running, `npm run test:media` generates a two-second video, probes it, transcodes two HLS renditions without upscaling, extracts its poster and removes the temporary files. It creates no queue jobs or database records.

To verify an independently built chemistry frontend, set `E2E_SUBJECT=chemistry`, `E2E_TEACHER` and `E2E_BASE_URL`, then run `subject-preset.spec.ts` through the E2E workspace. These checks visit public pages, registration, grade products and cart on desktop and phone widths. They are skipped during ordinary history deployments.
