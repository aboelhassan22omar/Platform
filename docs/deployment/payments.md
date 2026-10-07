# Payments

How money reaches the teacher, how to switch from the sandbox to real
payments, and how to verify it before a student is ever charged.

---

## Two providers, one interface

### Reviewed wallet and InstaPay transfers

`PAYMENT_PROVIDER=manual` and `PAYMENT_TRANSFER_PHONE=01024066401` enable real
transfers to the recipient's wallet. The student submits the sending phone and
transaction reference from the order page. This submission never grants access.
An administrator checks the actual recipient ledger, enters the received
amount and transaction reference at `/admin/transfers`, and confirms receipt.
Settlement, entitlements and the administrator audit entry commit together.
An amount mismatch or reuse of a settled transaction for another order is rejected.
This is manual receipt verification, not an automatic bank notification.

Automatic receipt verification still requires an official provider integration
and its merchant credentials. Do not enable development sandbox payments to
simulate receipt of a real transfer.

Everything downstream of checkout depends on
[`IPaymentProvider`](../../backend/src/payments/providers/payment-provider.interface.ts),
never on a specific processor. Swapping Paymob for another Egyptian gateway is
a new adapter class plus a config value — not a rewrite of the order pipeline.

| `PAYMENT_PROVIDER` | Adapter              | Real money? |
| ------------------ | -------------------- | ----------- |
| `dev` _(default)_  | `DevSandboxProvider` | **No**      |
| `paymob`           | `PaymobProvider`     | Yes         |

---

## The development sandbox

`PAYMENT_PROVIDER=dev` exists so the complete purchase journey can be exercised
without merchant credentials.

It is **not** a shortcut. It mirrors the real flow exactly:

1. Checkout creates a real order and redirects to `/checkout/sandbox`.
2. Confirming there builds a payload and signs it with HMAC-SHA512.
3. That payload goes through the **same settlement path** a genuine webhook
   takes — signature verification, idempotency, transactional entitlement
   grant.

So what is tested in development is the production code path, not a bypass.

Safeguards:

- The API **refuses to start** with `NODE_ENV=production` and
  `PAYMENT_PROVIDER=dev`, unless `PAYMENT_ALLOW_DEV_IN_PROD=true` is also set
  deliberately.
- The sandbox controller returns `403` unless the dev provider is active.
- Every order carries `payment.isSandbox: true` and an Arabic notice, and the
  checkout page says plainly that no money is taken.
- A student can only confirm **their own** order.

---

## Enabling Paymob

### 1. Collect credentials

From the Paymob dashboard (<https://accept.paymob.com>):

| Variable                       | Where to find it                           |
| ------------------------------ | ------------------------------------------ |
| `PAYMOB_API_KEY`               | Settings → Account Info → API Key          |
| `PAYMOB_HMAC_SECRET`           | Settings → Account Info → HMAC Secret      |
| `PAYMOB_INTEGRATION_ID_CARD`   | Developers → Payment Integrations → card   |
| `PAYMOB_INTEGRATION_ID_WALLET` | Developers → Payment Integrations → wallet |
| `PAYMOB_IFRAME_ID`             | Developers → iframes                       |

```bash
PAYMENT_PROVIDER=paymob
PAYMENT_CURRENCY=EGP
PAYMOB_API_KEY=<your key>
PAYMOB_HMAC_SECRET=<your hmac secret>
PAYMOB_INTEGRATION_ID_CARD=<id>
PAYMOB_INTEGRATION_ID_WALLET=<id>
PAYMOB_IFRAME_ID=<id>
PAYMOB_BASE_URL=https://accept.paymob.com
```

The boot validator refuses to start in production if `PAYMOB_API_KEY`,
`PAYMOB_HMAC_SECRET` or `PAYMOB_INTEGRATION_ID_CARD` is missing. The HMAC
secret is non-negotiable: without it, webhooks cannot be verified, and an
unverified webhook is an open door to free access.

### 2. Configure the callbacks

In Paymob → Developers → Payment Integrations, set both callbacks:

| Callback              | URL                                            |
| --------------------- | ---------------------------------------------- |
| Transaction processed | `https://yourdomain.com/api/webhooks/payments` |
| Transaction response  | `https://yourdomain.com/checkout/return`       |

The **processed** callback is the one that matters. It is the only thing that
grants access.

### 3. Restart

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend
docker compose logs backend | grep -i payment
```

The sandbox warning should no longer appear.

---

## How the flow works

```
Student clicks buy
   │
   ▼
POST /api/checkout
   ├─ prices read FROM THE DATABASE (never from the request)
   ├─ refuses content the student already owns
   ├─ Idempotency-Key returns the original order on a retry
   └─ creates Order(PENDING) + OrderItems with SNAPSHOTTED prices
   │
   ▼
Provider.createCheckout()
   ├─ Paymob: auth token → order → payment key → iframe URL
   └─ Order becomes AWAITING_PAYMENT
   │
   ▼
Student pays on the provider's page
   │
   ├──────────────► browser returns to /checkout/return
   │                 (grants NOTHING — it only polls the order)
   │
   └──────────────► provider POSTs /api/webhooks/payments
                      ├─ HMAC verified, or rejected with 400
                      ├─ recorded in webhook_events (unique per event id)
                      ├─ amount compared against the order total
                      └─ ONE TRANSACTION:
                           order → PAID
                           payment → SUCCEEDED
                           entitlements granted
                           subscription row created
                           notification queued
```

### Why the browser return grants nothing

A student returning from the payment page proves only that a browser navigated
to a URL. It can be typed, bookmarked or shared. Access is granted solely by a
signed, server-to-server webhook.

`/checkout/return` polls the order and shows one of three states: paid, failed,
or _still confirming_ — never a success screen the backend has not agreed with.

### Idempotency, at three levels

1. **Checkout** — `Idempotency-Key` returns the original order, so a
   double-tapped button cannot create two orders.
2. **Webhook** — a unique index on `(provider, eventId)` rejects a replay
   outright.
3. **Settlement** — an already-`PAID` order returns early, and each entitlement
   grant is itself idempotent.

Verified by `tests/e2e/specs/api-contract.spec.ts`.

### Amount verification

```ts
if (event.amountMinor !== order.totalMinor) {
  throw new BadRequestException('قيمة الدفع لا تطابق قيمة الطلب');
}
```

If the provider reports a different amount than the order records, nothing is
granted and the mismatch is logged. Either something was tampered with or the
integration is misconfigured; neither should quietly unlock content.

---

## HMAC verification

Paymob concatenates a fixed, ordered subset of transaction fields and signs it
with HMAC-SHA512. The field order is part of Paymob's specification — reordering
it silently breaks every verification. It is defined once, with a warning, in
`PaymobProvider.HMAC_FIELDS`.

Comparison uses `timingSafeEqual`, so a signature cannot be brute-forced one
byte at a time by measuring response times.

---

## ⚠️ Verify before taking real money

> **The Paymob adapter has been written against Paymob's documented API but has
> NOT been executed against live or sandbox merchant credentials** — none were
> available during this build. Treat it as unverified until you complete this
> checklist.

Work through it on a **Paymob test account** first:

- [ ] A test card completes checkout and lands back on `/checkout/return`
- [ ] The webhook arrives — `webhook_events` has a row with `processedAt` set
- [ ] The order reaches `PAID` and the entitlement exists
- [ ] The lesson is playable immediately afterwards
- [ ] A **declined** card marks the order `FAILED` and grants nothing
- [ ] Replaying the webhook (Paymob dashboard → resend) changes nothing
- [ ] A tampered webhook body is rejected with `400`
- [ ] A mobile-wallet payment works if you intend to offer it
- [ ] Amounts in Paymob match `orders.totalMinor` exactly, in piastres
- [ ] The Arabic receipt/notification wording is correct

Only then switch to live credentials, and make the very first live transaction
a small real purchase that you refund.

---

## Money representation

All amounts are **integer piastres**. 125.50 EGP is `12550`, never `125.5`.

Paymob's `amount_cents` uses the same unit, so no conversion happens at the
boundary — one of the reasons this representation was chosen.

Floating point is never used for money anywhere in the system, and the database
enforces it:

```sql
ALTER TABLE orders ADD CONSTRAINT orders_total_is_subtotal_minus_discount
  CHECK ("totalMinor" = "subtotalMinor" - "discountMinor");
```

A bug in the checkout calculator fails the insert rather than charging the wrong
amount.

---

## Prices change; history does not

`OrderItem` snapshots `titleSnapshot`, `kindSnapshot` and `unitPriceMinor` at
purchase time. When the teacher raises a price, past orders, receipts and
revenue reports keep the amount actually charged.

Products are **deactivated**, never deleted, for the same reason — a deleted
product would orphan the order lines that reference it.

---

## Refunds

Refunds are modelled (`OrderStatus.REFUNDED`, `PaymentStatus.REFUNDED`) but not
automated. To refund today:

1. Issue the refund in the Paymob dashboard.
2. Revoke the entitlement from the admin dashboard — recorded in the audit log
   with the acting admin's name.
3. Update the order status.

Automating this means handling Paymob's refund webhook and deciding a policy
for partially-consumed subscriptions. That policy is a commercial decision for
the teacher, so it has deliberately not been guessed at here.

---

## Troubleshooting

**Webhooks never arrive.** Check the callback URL is publicly reachable over
HTTPS and is not rate-limited. `/api/webhooks/payments` is deliberately exempt
from nginx rate limiting — dropping a provider callback would leave a paying
student without access.

**Every webhook is rejected.** Almost always a wrong `PAYMOB_HMAC_SECRET`, or a
proxy that rewrote the request body. The raw body is preserved by the
`bodyParser.verify` hook in `main.ts`; if you add another body-parsing layer in
front, signatures will break.

**Student paid but has no access.**

```sql
SELECT * FROM webhook_events
WHERE "processedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 10;
```

A row here means the event arrived but failed to process — `error` says why.
An empty result means it never arrived; replay it from the Paymob dashboard.
