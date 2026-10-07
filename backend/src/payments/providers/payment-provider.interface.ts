import type { PaymentMethod, PaymentProvider } from '../../generated/prisma/enums';

export interface CheckoutContext {
  orderId: string;
  reference: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  customer: {
    id: string;
    fullName: string;
    phone: string;
  };
  returnUrl: string;
}

export interface CheckoutSession {
  /** Where the browser should be sent to pay. */
  redirectUrl: string;
  /** Provider-side identifier, stored on the Payment row. */
  providerRef: string;
  /**
   * True when no real money moves. The UI must say so plainly rather than
   * implying a genuine transaction took place.
   */
  isSandbox: boolean;
  metadata?: Record<string, unknown>;
}

export interface VerifiedWebhook {
  /** Stable per-event id. Used for the idempotency unique constraint. */
  eventId: string;
  eventType: string;
  providerRef: string;
  orderReference?: string;
  succeeded: boolean;
  amountMinor?: number;
  method?: PaymentMethod;
  failureReason?: string;
  raw: unknown;
  approvedBy?: string;
}

/**
 * Contract every payment provider adapter implements, so swapping Paymob for
 * another Egyptian processor is a new class plus a config value — not a
 * rewrite of the order pipeline.
 */
export interface IPaymentProvider {
  readonly key: PaymentProvider;
  readonly isSandbox: boolean;
  createCheckout(ctx: CheckoutContext): Promise<CheckoutSession>;
  /**
   * Verifies authenticity (HMAC / signature) and normalises the payload.
   * MUST return null when verification fails — the caller treats null as
   * "reject with 400" and never grants anything.
   */
  verifyWebhook(rawBody: Buffer, headers: Record<string, unknown>): Promise<VerifiedWebhook | null>;
}
