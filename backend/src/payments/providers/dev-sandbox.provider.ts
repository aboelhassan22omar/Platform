import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PaymentMethod, PaymentProvider } from '../../generated/prisma/enums';
import type {
  CheckoutContext,
  CheckoutSession,
  IPaymentProvider,
  VerifiedWebhook,
} from './payment-provider.interface';

/**
 * Development payment adapter.
 *
 * NO REAL MONEY MOVES THROUGH THIS CLASS. It exists so the full purchase →
 * entitlement → playback journey can be exercised end-to-end without merchant
 * credentials. It mirrors the real flow exactly: it redirects to a confirm
 * page, and access is granted only by a signed webhook processed server-side —
 * never by the browser returning from the redirect.
 *
 * `validateEnv` refuses to boot with this provider when NODE_ENV=production
 * unless PAYMENT_ALLOW_DEV_IN_PROD is deliberately set.
 */
@Injectable()
export class DevSandboxProvider implements IPaymentProvider {
  readonly key = PaymentProvider.DEV_SANDBOX;
  readonly isSandbox = true;

  private readonly logger = new Logger(DevSandboxProvider.name);
  private readonly secret: string;
  private readonly siteUrl: string;

  constructor(config: ConfigService) {
    // Reuses the playback secret purely to sign sandbox callbacks; it never
    // touches a real provider.
    this.secret = config.get<string>('playback.secret')!;
    this.siteUrl = config.get<string>('publicSiteUrl')!;
  }

  async createCheckout(ctx: CheckoutContext): Promise<CheckoutSession> {
    const providerRef = `dev_${randomUUID()}`;
    this.logger.warn(
      `[SANDBOX] Checkout for order ${ctx.reference} (${ctx.amountMinor} minor units). No real payment.`,
    );

    const url = new URL('/checkout/sandbox', this.siteUrl);
    url.searchParams.set('ref', ctx.reference);
    url.searchParams.set('providerRef', providerRef);
    url.searchParams.set('amount', String(ctx.amountMinor));
    url.searchParams.set('method', ctx.method);

    return {
      redirectUrl: url.toString(),
      providerRef,
      isSandbox: true,
      metadata: { notice: 'Sandbox checkout — no real payment is processed.' },
    };
  }

  /** Signature the sandbox confirm endpoint produces, mirroring Paymob's HMAC. */
  sign(payload: string): string {
    return createHmac('sha512', this.secret).update(payload).digest('hex');
  }

  async verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, unknown>,
  ): Promise<VerifiedWebhook | null> {
    const provided = String(headers['x-sandbox-signature'] ?? '');
    const expected = this.sign(rawBody.toString('utf8'));

    if (!provided || !this.safeEqual(provided, expected)) {
      this.logger.warn('[SANDBOX] Rejected webhook with an invalid signature');
      return null;
    }

    const body = JSON.parse(rawBody.toString('utf8')) as {
      eventId?: string;
      providerRef?: string;
      reference?: string;
      success?: boolean;
      amountMinor?: number;
    };

    if (!body.providerRef || !body.reference) return null;

    return {
      eventId: body.eventId ?? `dev_evt_${body.providerRef}`,
      eventType: 'sandbox.payment',
      providerRef: body.providerRef,
      orderReference: body.reference,
      succeeded: body.success !== false,
      amountMinor: body.amountMinor,
      method: PaymentMethod.DEV,
      failureReason: body.success === false ? 'رفض تجريبي' : undefined,
      raw: body,
    };
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
