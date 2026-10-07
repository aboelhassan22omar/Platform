# Production approval and releases

Repository: `aboelhassan22omar/Platform`. Server: `13.140.153.131`.

A push or pull request runs CI only. To publish, the repository owner opens
Actions → **Production (owner approval required)** → **Run workflow**, chooses
`main` and types `DEPLOY`. The workflow rejects other users and branches,
reruns verification for that exact commit and then deploys it over pinned SSH.
Do not trigger the production workflow without the owner's approval.

This manual gate works with private repositories without paid environment
reviewers. Repository administrators can change workflows and secrets, so they
must remain trusted. Native required reviewers for private repositories need
a supporting GitHub plan.

Required repository Actions secrets:

- `PRODUCTION_HOST`: server IP
- `PRODUCTION_USER`: deployment SSH user
- `PRODUCTION_SSH_KEY`: dedicated private deployment key, never the root password
- `PRODUCTION_KNOWN_HOSTS`: host key verified during server setup

Production configuration lives only at `/opt/amr-platform/shared/.env`, mode
600. Source releases are under `/opt/amr-platform/releases/<commit SHA>`.
Host nginx owns HTTPS; the application edge binds `127.0.0.1:17080`, and the
object storage API binds `127.0.0.1:17900`. Databases have no host ports.
Use a dedicated storage hostname for presigned browser uploads and preserve
its Host header when proxying to MinIO.

Deployment builds before changing services, backs up an existing database,
applies migrations through Compose, checks readiness and only then records
the active release. Database migrations are not automatically reversible.
Backups here are local; configure an external backup destination separately.

First launch also requires DNS, HTTPS, real payment-provider credentials,
an initial administrator, and uploaded teaching content. Never enable the
development payment sandbox as a substitute for real payment verification.
