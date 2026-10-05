# WhatsApp registration and password recovery

The transport is adapted from `D:/SuperAgent/identity/infrastructure/whatsapp/gateways.py`.
SuperAgent replies to an inbound WhatsApp message. This platform sends an OTP immediately
after a registration or recovery request, using an approved Meta **AUTHENTICATION** template
with a **COPY_CODE** button. Plain text cannot reliably initiate these conversations.

Server configuration (root `.env`, ignored by Git):

```
PHONE_VERIFICATION=whatsapp
WHATSAPP_PHONE_NUMBER_ID=<Meta phone number ID, not a phone number>
WHATSAPP_TOKEN=<System User token with whatsapp_business_messaging>
WHATSAPP_GRAPH_VERSION=v25.0
WHATSAPP_OTP_TEMPLATE=<approved authentication template name>
WHATSAPP_OTP_LANGUAGE=ar
```

Use the exact language approved for the template. The same six-digit OTP is supplied
to its body parameter and URL button parameter at index 0. Credentials imported from
SuperAgent remain server-side. Missing configuration or provider failure returns an
Arabic error; no developer OTP or fallback token is exposed.

## Flow

- `POST /api/auth/register`: validates the student details and sends an OTP. Returns
  `challengeId`, `expiresIn` and `resendAfterSeconds`; creates no user/session yet.
- `POST /api/auth/register/verify`: accepts `{challengeId, code}`, creates the student
  with `phoneVerifiedAt`, and issues the existing HTTP-only session cookies.
- `POST /api/auth/password/reset/request`: accepts `{phone}` and returns a challenge.
  Unknown and suspended accounts receive the same response shape without a message.
- `POST /api/auth/password/reset/verify`: verifies `{challengeId, code}` and returns
  a random reset grant `{token, expiresIn}`. The password form is shown only now.
- `POST /api/auth/password/reset/confirm`: accepts `{token, newPassword}`, writes the
  Argon2 password hash to PostgreSQL, invalidates other reset grants and revokes all sessions.
- `POST /api/auth/otp/resend`: accepts `{challengeId}` and issues a replacement challenge.

Codes expire after five minutes; five incorrect guesses invalidate a challenge. Redis
atomically consumes a successful code. A resend invalidates the old challenge, is limited
to once per minute, and each phone is limited to five sends per hour across both purposes.
Pending registration stores a password hash, never its plaintext. Reset grants are also
hashed and are single use even when two confirmations arrive concurrently.

## Verification without messaging real people

```
npm --workspace backend test -- --runInBand
Get-Content -Raw backend/test/otp.integration.cjs | docker compose exec -T backend node
npm --workspace tests/e2e test -- specs/whatsapp-otp.spec.ts --project=desktop-chrome --project=mobile-360
```

The integration test uses real PostgreSQL, Redis, Argon2 and JWT and records the WhatsApp
transport in-process. It verifies registration, expiry, replay protection, rate limits,
resends, actual database password changes and rejection of old passwords and sessions,
then removes its fixtures. The browser tests cover the three UI steps, Arabic digits,
wrong codes, delivery errors, resend cooldown and password confirmation.

Other student/API suites use `backend/test/otp-fixture.cjs` in a local Docker subprocess
to prepare a recorded OTP and verify it through the real HTTP endpoint. This helper
requires sandbox payments and a localhost site URL. No public test endpoint or OTP bypass
is added to the platform. As before, larger API suites require a raised auth rate limit
in their dedicated test environment.

After updating credentials/template settings, recreate the backend so it receives them:

```
docker compose up -d backend
docker compose exec -T proxy nginx -s reload
```

Meta accepting a message ID confirms API submission, not handset receipt. Final delivery
needs a real receiving WhatsApp number and an approved template available to this account.
