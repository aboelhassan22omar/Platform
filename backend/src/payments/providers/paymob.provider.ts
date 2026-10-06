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

/**
 * Paymob (accept.paymob.com) — the most widely used card + mobile-wallet
 * processor in Egypt.
 *
 * Implements the classic three-step Accept flow:
 *   1. POST /api/auth/tokens            -> auth token
 *   2. POST /api/ecommerce/orders       -> Paymob order id
 *   3. POST /api/acceptance/payment_keys-> payment key, used to open the iframe
 *
 * Webhooks are verified with the HMAC that Paymob computes over a fixed,
 * ordered subset of the transaction fields. The field order below is part of
 * Paymob's specification — changing it silently breaks verification.
 *
 * REQUIRED CONFIGURATION (see .env.example and docs/deployment/payments.md):
 *   PAYMOB_API_KEY, PAYMOB_HMAC_SECRET, PAYMOB_INTEGRATION_ID_CARD,
 *   PAYMOB_INTEGRATION_ID_WALLET, PAYMOB_IFRAME_ID
 *
 * This adapter has been written against Paymob's documented API but has NOT
 * been executed against live or sandbox merchant credentials in this build —
 * none were available. Run the checklist in docs/deployment/payments.md
 * against a Paymob test account before taking real payments.
 */
@Injectable()
export class PaymobProvider implements IPaymentProvider {
  readonly key = PaymentProvider.PAYMOB;
  readonly isSandbox = false;

  private readonly logger = new Logger(PaymobProvider.name);
  private readonly cfg: AppConfig['payments']['paymob'];
  private readonly siteUrl: string;

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['payments']>('payments')!.paymob;
    this.siteUrl = config.get<string>('publicSiteUrl')!;
  }

  // --------------------------------------------------------------------------
  // Checkout
  // --------------------------------------------------------------------------

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutSession> {
    if (!this.cfg.apiKey) {
      throw new ServiceUnavailableException('بوابة الدفع غير مهيأة حالياً، حاول بعد شوية');
    }

    const authToken = await this.authenticate();
    const paymobOrderId = await this.createOrder(authToken, ctx);
    const integrationId =
      ctx.method === PaymentMethod.WALLET
        ? this.cfg.integrationIdWallet
        : this.cfg.integrationIdCard;

    if (!integrationId) {
      throw new ServiceUnavailableException('وسيلة الدفع دي مش متاحة حالياً');
    }

    const paymentKey = await this.createPaymentKey(authToken, paymobOrderId, integrationId, ctx);

    return {
      redirectUrl: `${this.cfg.baseUrl}/api/acceptance/iframes/${this.cfg.iframeId}?payment_token=${paymentKey}`,
      providerRef: String(paymobOrderId),
      isSandbox: false,
      metadata: { paymobOrderId },
    };
  }

  private async authenticate(): Promise<string> {
    const data = await this.post<{ token: string }>('/api/auth/tokens', {
      api_key: this.cfg.apiKey,
    });
    return data.token;
  }

  private async createOrder(authToken: string, ctx: CheckoutContext): Promise<number> {
    const data = await this.post<{ id: number }>('/api/ecommerce/orders', {
      auth_token: authToken,
      delivery_needed: false,
      // Paymob amounts are in piastres — the same minor unit we store.
      amount_cents: ctx.amountMinor,
      currency: ctx.currency,
      // Our own reference, echoed back on the webhook so we can find the order.
      merchant_order_id: ctx.reference,
      items: [],
    });
    return data.id;
  }

  private async createPaymentKey(
    authToken: string,
    paymobOrderId: number,
    integrationId: string,
    ctx: CheckoutContext,
  ): Promise<string> {
    const [firstName, ...rest] = ctx.customer.fullName.split(' ');

    const data = await this.post<{ token: string }>('/api/acceptance/payment_keys', {
      auth_token: authToken,
      amount_cents: ctx.amountMinor,
      expiration: 3600,
      order_id: paymobOrderId,
      currency: ctx.currency,
      integration_id: Number(integrationId),
      billing_data: {
        // Paymob rejects empty strings; "NA" is its documented placeholder.
        first_name: firstName || 'NA',
        last_name: rest.join(' ') || 'NA',
        phone_number: ctx.customer.phone,
        email: `${ctx.customer.id}@students.amr-mahrous.local`,
        apartment: 'NA',
        floor: 'NA',
        street: 'NA',
        building: 'NA',
        shipping_method: 'NA',
        postal_code: 'NA',
        city: 'NA',
        country: 'EG',
        state: 'NA',
      },
    });

    return data.token;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      // Never log the request body — it carries the API key and billing data.
      this.logger.error(`Paymob ${path} failed: ${response.status} ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException('تعذر الاتصال ببوابة الدفع، حاول تاني');
    }

    return (await response.json()) as T;
  }

  // --------------------------------------------------------------------------
  // Webhook verification
  // --------------------------------------------------------------------------

  /**
   * Fields Paymob concatenates (in this exact order) before HMAC-SHA512.
   * Defined by Paymob; do not reorder.
   */
  private static readonly HMAC_FIELDS = [
    'amount_cents',
    'created_at',
    'currency',
    'error_occured',
    'has_parent_transaction',
    'id',
    'integration_id',
    'is_3d_secure',
    'is_auth',
    'is_capture',
    'is_refunded',
    'is_standalone_payment',
    'is_voided',
    'order.id',
    'owner',
    'pending',
    'source_data.pan',
    'source_data.sub_type',
    'source_data.type',
    'success',
  ] as const;

  async verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, unknown>,
  ): Promise<VerifiedWebhook | null> {
    if (!this.cfg.hmacSecret) {
      this.logger.error('PAYMOB_HMAC_SECRET is not set — refusing to trust webhook');
      return null;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }

    const obj = (payload.obj ?? payload) as Record<string, unknown>;

    // Paymob sends the HMAC as a query parameter; the controller forwards it
    // through the headers bag so this method stays transport-agnostic.
    const provided = String(headers['x-paymob-hmac'] ?? headers['hmac'] ?? '');
    const concatenated = PaymobProvider.HMAC_FIELDS.map((field) =>
      String(this.readPath(obj, field) ?? ''),
    ).join('');

    const expected = createHmac('sha512', this.cfg.hmacSecret).update(concatenated).digest('hex');

    if (!provided || !this.safeEqual(provided.toLowerCase(), expected.toLowerCase())) {
      this.logger.warn('Rejected Paymob webhook: HMAC mismatch');
      return null;
    }

    const success = obj.success === true || obj.success === 'true';
    const order = obj.order as Record<string, unknown> | undefined;

    return {
      eventId: String(obj.id),
      eventType: String(payload.type ?? 'TRANSACTION'),
      providerRef: String(order?.id ?? obj.order_id ?? obj.id),
      orderReference: order?.merchant_order_id ? String(order.merchant_order_id) : undefined,
      succeeded: success,
      amountMinor: Number(obj.amount_cents ?? 0),
      method: this.resolveMethod(obj),
      failureReason: success ? undefined : String(obj.data_message ?? 'فشلت عملية الدفع'),
      raw: payload,
    };
  }

  private resolveMethod(obj: Record<string, unknown>): PaymentMethod {
    const source = obj.source_data as Record<string, unknown> | undefined;
    const type = String(source?.type ?? '').toLowerCase();
    if (type.includes('wallet')) return PaymentMethod.WALLET;
    if (type.includes('kiosk') || type.includes('cash')) return PaymentMethod.KIOSK;
    return PaymentMethod.CARD;
  }

  /** Resolves dotted paths like `order.id` and `source_data.pan`. */
  private readPath(obj: Record<string, unknown>, path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (acc, key) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
        obj,
      );
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
