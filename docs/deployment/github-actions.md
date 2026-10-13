# Production approval and releases

Repository: `aboelhassan22omar/Platform`. Server: `13.140.153.131`.

A pull request runs **CI only** (`ci.yml`): lint, type checks, backend and
frontend tests, asset audit, production Compose validation, then a container
build of every image. Nothing is published or deployed from a pull request.

A merge into `main` runs the **Production pipeline** (`deploy.yml`):

1. **Stage 1 - CI**: the same checks a pull request runs.
2. **Stage 2 - Detect changed services**: diff against the `production` git
   tag (the last successful deploy). `backend/` → backend, `frontend/` →
   frontend, `workers/` or `backend/prisma` → worker, `docker/minio/` → MinIO;
   compose files, `docker/nginx|scripts|postgres` and the deploy script count
   as configuration. With no tag yet, everything is deployed.
3. **CD - Publish**: only the changed images are built and pushed to GHCR,
   tagged with the commit SHA. Unchanged services show as skipped.
4. **Stage 3 - Deploy production (approval required)**: waits for the owner in
   Actions → **Production pipeline** → **Review deployments** → **production**
   → **Approve and deploy**. The server updates only the changed services and
   keeps the running image for the rest (`/opt/amr-platform/service-tags.env`),
   after a database backup and migrations, then checks readiness and the
   public site. If nothing deployable changed, this stage is skipped.
5. **Stage 4 - Record**: moves the `production` tag to the commit and stores
   the approver, updated services and workflow URL as an artifact.

Only `aboelhassan22omar` may approve, bypass is disabled, and only `main` may
deploy; every run verifies these rules. **Run workflow** with **deploy_all**
rebuilds and redeploys every service (for example after changing a repository
variable used as a build arg). There is one environment, `production`.

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

**Production diagnostics** (manual, owner-approved) prints a read-only report:
container state, video
assets and transcode jobs, worker logs, and a browser-style upload through the
public storage host.

Production configuration lives only at `/opt/amr-platform/shared/.env`, mode
600. Source releases are under `/opt/amr-platform/releases/<commit SHA>`.
Host nginx owns HTTPS; the application edge binds `127.0.0.1:17080`, and the
object storage API binds `127.0.0.1:17900`. Databases have no host ports.
Use a dedicated storage hostname for presigned browser uploads and preserve
its Host header when proxying to MinIO.
Set `TRUSTED_HOST_PROXY` to the gateway of `amr-production_backplane` before
deploying. Only that address may supply the client IP to the container nginx;
limits then apply to each visitor instead of all users sharing the host proxy.
Automatic seeding runs only on an empty content database, preserving imported
teaching content and administrator pricing on later deployments.

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
