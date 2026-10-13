# Payments

How money reaches the teacher, how to switch from the sandbox to real
payments, and how to verify it before a student is ever charged.

---

## Two providers, one interface

### Reviewed wallet and InstaPay transfers

`PAYMENT_PROVIDER=manual` enables real transfers by **InstaPay** or **Vodafone
Cash**. `PAYMENT_TRANSFER_PHONE` is only the first-run default: the receiving
numbers, the WhatsApp number for proofs, the InstaPay payment link
(`https://ipn.eg/...`), the InstaPay address and the recipient name are edited
in the payments log → "بيانات التحويل" (stored in `site_settings`, audited).

The order page shows the student the number (copy), a QR code (the InstaPay
link, or the Vodafone Cash `*9*7*number*amount#` dial code) and a one-tap
button that opens InstaPay or dials the transfer. After paying, the student
types the number they paid from and roughly when, and taps a button that opens
**WhatsApp to the platform's number** (`whatsappPhone`, editable, default
`PAYMENT_TRANSFER_PHONE`) with a ready message: order number, amount, method,
sender number and time. They attach the screenshot there. This never grants
access.

Every pending transfer order is listed at the top of the **payments log**
(`/admin/payments`), including orders where the student only used WhatsApp.
The administrator matches the WhatsApp screenshot, checks the receiving
wallet, then:

- **Approves**: the order settles, the requested content unlocks immediately,
  the student is notified, and the approval is audited.
- **Rejects with a reason**: the order stays open, the student sees the reason
  and a notification, and can resend.

This is manual receipt verification, not an automatic bank notification.

Automatic receipt verification still requires an official provider integration
and its merchant credentials. Do not enable development sandbox payments to
simulate receipt of a real transfer.

Everything downstream of checkout depends on
[`IPaymentProvider`](../../backend/src/payments/providers/payment-provider.interface.ts),
never on a specific processor. Swapping Paymob for another Egyptian gateway is
a new adapter class plus a config value — not a rewrite of the order pipeline.

| `PAYMENT_PROVIDER` | Adapter                  | Real money? |
| ------------------ | ------------------------ | ----------- | ------------------------ |
| `PAYMENT_PROVIDER` | Adapter                  | Real money? | Unlocks                  |
| ------------------ | ------------------------ | ----------- | ------------------------ |
| `dev` _(default)_  | `DevSandboxProvider`     | **No**      | sandbox webhook          |
| `kashier`          | `KashierProvider`        | Yes         | **automatically**        |
| `paymob`           | `PaymobProvider`         | Yes         | automatically            |
| `manual`           | `ManualTransferProvider` | Yes         | by an administrator      |

---

## Enabling Kashier (wallets + InstaPay, automatic unlock)

A transfer to a personal Vodafone Cash or InstaPay number cannot be detected by
software — neither service offers individuals an API or notification. Automatic
unlocking therefore goes through a licensed gateway: the student pays the
merchant account on Kashier's page, Kashier calls the platform with a signed
webhook, and the order is settled and its lessons granted in one transaction.
Nobody approves anything.

1. Open a Kashier merchant account and enable **Mobile wallets** and
   **InstaPay** on it (InstaPay is enabled by Kashier per account).
2. From **Integrations**, copy the merchant ID, Payment API key and secret key.
3. Set on the server:

   ```bash
   PAYMENT_PROVIDER=kashier
   KASHIER_MERCHANT_ID=MID-xxxx-xxxx
   KASHIER_API_KEY=<payment API key — also verifies webhooks>
   KASHIER_SECRET_KEY=<secret key>
   KASHIER_MODE=live
   KASHIER_WALLET_METHODS=wallet
   KASHIER_INSTAPAY_METHODS=
   ```

   Each checkout button maps to `allowedMethods`. An empty value shows every
   method enabled on the account; once Kashier confirms the exact InstaPay key
   for hosted sessions, put it in `KASHIER_INSTAPAY_METHODS` so that button
   opens straight on InstaPay.

4. Restart the backend. The webhook URL is sent with every session
   (`https://<site>/api/webhooks/payments`), so nothing has to be registered.

Verification: `x-kashier-signature` must equal HMAC-SHA256, keyed with the
Payment API key, over the alphabetically sorted `signatureKeys` as
`key=value` pairs joined by `&` with URL-encoded values. A `PENDING` InstaPay
request is recorded but neither grants nor fails the order; refunds and voids
never grant. The webhook amount must match the order total.

Kashier's sandbox only exercises card and wallet. Make one small live wallet
payment and one InstaPay payment before announcing the change.

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
