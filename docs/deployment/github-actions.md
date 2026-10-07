# Production approval and releases

Repository: `aboelhassan22omar/Platform`. Server: `13.140.153.131`.

A pull request runs parallel checks and builds all four Docker images. A push
to `main` also publishes a complete release to GHCR, tagged with the commit SHA.
After CI and publication succeed, the production job waits for the owner in
Actions → **Platform CI-CD** → **Review deployments** → **production** →
**Approve and deploy**. Only `aboelhassan22omar` may approve, bypass is disabled,
and only `main` may deploy. `Run workflow` can also prepare a release; it still
requires the same deployment review. There is one environment, `production`.

The graph in `deploy.yml` has four stages:

1. CI: lint, type checks, backend tests, asset audit, production Compose
   validation, and a matrix building backend, frontend, worker and MinIO images.
2. Change detection and parallel publication of the release images. Each
   release includes all four images; unchanged layers use the build cache.
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

The owner authorized making this repository public so native required reviewers
are available. SSH credentials live only in the protected production environment;
the repository-level SSH private key was removed. Each release checks that the
owner review, disabled bypass and `main` branch restrictions remain in place.
Repository administrators can change workflows and environment settings, so
they must remain trusted.

Required production environment Actions secrets:

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

First launch also requires DNS, HTTPS, an initial administrator, and uploaded
teaching content. Payments can use Paymob with real provider credentials or
manual wallet transfers. Manual transfers remain pending until an administrator
checks the recipient's actual account statement and approves the exact amount
and transaction reference; submitting a receipt never unlocks a lesson.
Never enable the development payment sandbox as a substitute for real payment
verification.
GHCR authentication uses the workflow's temporary `GITHUB_TOKEN`, passed over
SSH on stdin and removed from the host after the deployment command ends.
