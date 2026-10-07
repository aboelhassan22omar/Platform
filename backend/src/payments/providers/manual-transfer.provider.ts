import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentProvider } from '../../generated/prisma/enums';
import type { CheckoutContext, IPaymentProvider } from './payment-provider.interface';

/** A real bank/wallet transfer requires review against the recipient ledger. */
@Injectable()
export class ManualTransferProvider implements IPaymentProvider {
  readonly key = PaymentProvider.MANUAL;
  readonly isSandbox = false;
  async createCheckout(ctx: CheckoutContext) {
    return {
      redirectUrl: ctx.returnUrl,
      providerRef: `transfer_${randomUUID()}`,
      isSandbox: false,
    };
  }
  async verifyWebhook() {
    return null;
  }
}
