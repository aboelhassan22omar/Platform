import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentMethod, PaymentProvider } from '../../generated/prisma/enums';
import type { AppConfig } from '../../config/configuration';
import type {
  CheckoutContext,
  CheckoutSession,
  IPaymentProvider,
  VerifiedWebhook,
} from './payment-provider.interface';

const SESSION_URLS = {
  test: 'https://test-api.kashier.io/v3/payment/sessions',
  live: 'https://api.kashier.io/v3/payment/sessions',
} as const;

/**
 * Kashier hosted payment sessions — mobile wallets (Vodafone Cash and the
 * other Egyptian wallets) and InstaPay, settled automatically by webhook.
 *
 * Flow:
 *   1. POST /v3/payment/sessions with our order reference -> sessionUrl
 *   2. The student pays on Kashier's page.
 *   3. Kashier POSTs the transaction to /api/webhooks/payments, signed with
 *      HMAC-SHA256 over the sorted `signatureKeys` using the Payment API key.
 *      A verified SUCCESS unlocks the order inside the same transaction that
 *      marks it paid — nobody approves anything by hand.
 *
 * The browser returning to merchantRedirect grants nothing; only the signed
 * webhook does.
 *
 * REQUIRED CONFIGURATION: KASHIER_MERCHANT_ID, KASHIER_API_KEY,
 * KASHIER_SECRET_KEY, KASHIER_MODE=live. See docs/deployment/payments.md.
 */
@Injectable()
export class KashierProvider implements IPaymentProvider {
  readonly key = PaymentProvider.KASHIER;
  readonly isSandbox: boolean;

  private readonly logger = new Logger(KashierProvider.name);
  private readonly cfg: AppConfig['payments']['kashier'];
  private readonly siteUrl: string;

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['payments']>('payments')!.kashier;
    this.siteUrl = config.get<string>('publicSiteUrl')!;
    this.isSandbox = this.cfg.mode !== 'live';
  }

  /** One order maps to one Payment row, whichever attempt finally succeeds. */
  static providerRefFor(reference: string): string {
    return `kashier_${reference}`;
  }

  // --------------------------------------------------------------------------
  // Checkout
  // --------------------------------------------------------------------------

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutSession> {
    if (!this.cfg.merchantId || !this.cfg.apiKey || !this.cfg.secretKey) {
      throw new ServiceUnavailableException('بوابة الدفع غير مهيأة حالياً، حاول بعد شوية');
    }

    // CARD is the channel the checkout dialog reserves for InstaPay.
    const allowedMethods =
      ctx.method === PaymentMethod.WALLET ? this.cfg.walletMethods : this.cfg.instapayMethods;

    const response = await fetch(SESSION_URLS[this.cfg.mode], {
      method: 'POST',
      headers: {
        Authorization: this.cfg.secretKey,
        'api-key': this.cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantId: this.cfg.merchantId,
        order: ctx.reference,
        amount: (ctx.amountMinor / 100).toFixed(2),
        currency: ctx.currency,
        paymentType: 'credit',
        type: 'one-time',
        ...(allowedMethods.trim() ? { allowedMethods: allowedMethods.trim() } : {}),
        expireAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        maxFailureAttempts: 3,
        merchantRedirect: ctx.returnUrl,
        failureRedirect: false,
        serverWebhook: `${this.siteUrl}/api/webhooks/payments`,
        display: 'ar',
        description: `طلب ${ctx.reference}`,
        manualCapture: false,
        interactionSource: 'ECOMMERCE',
        enable3DS: true,
        customer: {
          email: `${ctx.customer.id}@students.amr-mahrous.local`,
          reference: ctx.customer.id,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch((error: Error) => {
      this.logger.error(`Kashier session request failed: ${error.message}`);
      throw new ServiceUnavailableException('تعذر الاتصال ببوابة الدفع، حاول تاني');
    });

    const text = await response.text();
    let data: { sessionUrl?: string; _id?: string } = {};
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      // Logged below with the status; the body is never echoed to the client.
    }

    if (!response.ok || !data.sessionUrl) {
      // Never log the request — it carries the secret and API keys.
      this.logger.error(`Kashier session rejected: ${response.status} ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException('تعذر الاتصال ببوابة الدفع، حاول تاني');
    }

    return {
      redirectUrl: data.sessionUrl,
      providerRef: KashierProvider.providerRefFor(ctx.reference),
      isSandbox: this.isSandbox,
      metadata: { sessionId: data._id },
    };
  }

  // --------------------------------------------------------------------------
  // Webhook verification
  // --------------------------------------------------------------------------

  async verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, unknown>,
  ): Promise<VerifiedWebhook | null> {
    if (!this.cfg.apiKey) {
      this.logger.error('KASHIER_API_KEY is not set — refusing to trust webhook');
      return null;
    }

    let payload: { event?: string; data?: Record<string, unknown> };
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
    } catch {
      return null;
    }

    const data = payload.data;
    const keys = data?.signatureKeys;
    if (!data || !Array.isArray(keys) || keys.length === 0) return null;

    const provided = String(headers['x-kashier-signature'] ?? '').toLowerCase();
    const expected = KashierProvider.sign(data, keys as string[], this.cfg.apiKey);
    if (!provided || !this.safeEqual(provided, expected)) {
      // Key names only: enough to diagnose a format change, never the values.
      this.logger.warn(
        `Rejected Kashier webhook: ${provided ? 'signature mismatch' : 'missing x-kashier-signature'} (signed keys: ${[...(keys as string[])].sort().join(',')})`,
      );
      return null;
    }

    const event = String(payload.event ?? '');
    const status = String(data.status ?? '').toUpperCase();
    const reference = data.merchantOrderId ? String(data.merchantOrderId) : undefined;
    const transactionId = String(data.transactionId ?? data.kashierOrderId ?? '');
    // Only a completed "pay" changes an order. Refunds, voids and the rest are
    // recorded for reconciliation but never grant or revoke from here.
    const isPay = event === 'pay' || event === '';

    return {
      eventId: `${transactionId || reference}:${event}:${status}`,
      eventType: `kashier.${event || 'unknown'}`,
      providerRef: reference ? KashierProvider.providerRefFor(reference) : transactionId,
      orderReference: reference,
      succeeded: isPay && status === 'SUCCESS',
      pending: !isPay || status === 'PENDING',
      amountCandidatesMinor: KashierProvider.amountCandidates(data.amount),
      method: this.resolveMethod(String(data.method ?? '')),
      failureReason:
        status === 'FAILURE'
          ? String(data.transactionResponseMessage ?? 'فشلت عملية الدفع')
          : undefined,
      raw: payload,
    };
  }

  /**
   * HMAC-SHA256 over the signatureKeys fields serialised exactly as Kashier's
   * reference code does with `query-string`'s `stringify`: keys sorted, strict
   * RFC 3986 encoding (so `*` in a masked card becomes `%2A`), `null` as a bare
   * key, `undefined` omitted and arrays as repeated keys. Plain
   * `encodeURIComponent` leaves `!'()*` unescaped and produced a different
   * signature for real payments, so they were never settled.
   */
  static sign(data: Record<string, unknown>, keys: string[], apiKey: string): string {
    return createHmac('sha256', apiKey)
      .update(KashierProvider.signaturePayload(data, keys))
      .digest('hex');
  }

  static signaturePayload(data: Record<string, unknown>, keys: string[]): string {
    const strict = (value: string) =>
      encodeURIComponent(value).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      );
    const pair = (key: string, value: unknown) =>
      value === null ? strict(key) : `${strict(key)}=${strict(String(value))}`;
    return [...new Set(keys)]
      .sort()
      .flatMap((key) => {
        const value = data[key];
        if (value === undefined) return [];
        if (Array.isArray(value))
          return value.filter((item) => item !== undefined).map((item) => pair(key, item));
        return [pair(key, value)];
      })
      .join('&');
  }

  /**
   * Sessions are created in pounds ("150.00"), and webhook amounts arrive the
   * same way. A bare integer is also accepted as piastres so a documentation
   * ambiguity can never block a genuine payment.
   */
  static amountCandidates(amount: unknown): number[] {
    const text = String(amount ?? '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return [];
    const [whole, fraction = ''] = text.split('.');
    const fromPounds = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
    return text.includes('.') ? [fromPounds] : [fromPounds, Number(whole)];
  }

  private resolveMethod(method: string): PaymentMethod {
    const value = method.toLowerCase();
    if (value.includes('wallet')) return PaymentMethod.WALLET;
    if (value.includes('fawry') || value.includes('kiosk')) return PaymentMethod.KIOSK;
    // InstaPay settles under the CARD channel, matching the checkout dialog.
    return PaymentMethod.CARD;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
