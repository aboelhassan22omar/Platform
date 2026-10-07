# Production approval and releases

Repository: `aboelhassan22omar/Platform`. Server: `13.140.153.131`.

A pull request runs parallel checks and builds all three Docker images. A push
to `main` also publishes a complete release to GHCR, tagged with the commit SHA.
To deploy, the repository owner opens Actions → **Platform CI-CD** →
**Run workflow**, chooses `main` and types `DEPLOY`. The workflow rejects other
users and branches, verifies that exact commit and deploys over pinned SSH.
Do not trigger the production workflow without the owner's approval.

The graph in `deploy.yml` has four stages:

1. CI: lint, type checks, backend tests, asset audit, production Compose
   validation, and a matrix building backend, frontend and worker images.
2. Change detection and parallel publication of the release images. Each
   release includes all three images; unchanged layers use the build cache.
3. Owner-approved production deployment, database backup, migrations and
   checks of database, Redis and storage readiness.
4. A deployment record with the commit, approver and workflow URL. The server
   also records the current SHA only after readiness succeeds.

Set the repository variable `PRODUCTION_SITE_URL` to the confirmed HTTPS
origin before building the release; it defaults to `https://amr.aurexis.cc`.
Contact build args use `PRODUCTION_CONTACT_PHONE` and
`PRODUCTION_CONTACT_PHONE_LABEL`, defaulting to the requested `01024066401`.
Brand overrides can be added to the workflow build args before publishing a
teacher-specific release.

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

Deployment pulls the tested images before changing services, backs up an existing database,
applies migrations through Compose, checks readiness and only then records
the active release. Database migrations are not automatically reversible.
Backups here are local; configure an external backup destination separately.

First launch also requires DNS, HTTPS, real payment-provider credentials,
an initial administrator, and uploaded teaching content. Never enable the
development payment sandbox as a substitute for real payment verification.
GHCR authentication uses the workflow's temporary `GITHUB_TOKEN`, passed over
SSH on stdin and removed from the host after the deployment command ends.
