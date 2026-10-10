import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '../../generated/prisma/enums';
import { KashierProvider } from './kashier.provider';

const API_KEY = 'test-payment-api-key';

const provider = () =>
  new KashierProvider({
    get: (key: string) =>
      key === 'payments'
        ? {
            kashier: {
              merchantId: 'MID-1',
              apiKey: API_KEY,
              secretKey: 'secret',
              mode: 'live',
              walletMethods: 'wallet',
              instapayMethods: '',
            },
          }
        : 'https://amr.example',
  } as unknown as ConfigService);

const webhook = (data: Record<string, unknown>, event = 'pay') => {
  const keys = Object.keys(data).filter((key) => key !== 'signatureKeys');
  const body = { event, data: { ...data, signatureKeys: keys } };
  // Built independently of the provider so the test checks the spec, not itself.
  const query = [...keys]
    .sort()
    .map((key) => `${key}=${encodeURIComponent(String(data[key]))}`)
    .join('&');
  const signature = createHmac('sha256', API_KEY).update(query).digest('hex');
  return { raw: Buffer.from(JSON.stringify(body)), signature };
};

const paid = {
  merchantOrderId: 'AM-1234-ABCD',
  kashierOrderId: 'k-1',
  transactionId: 'tx-1',
  status: 'SUCCESS',
  method: 'wallet',
  amount: '150.50',
  currency: 'EGP',
};

describe('KashierProvider webhooks', () => {
  it('accepts a correctly signed successful payment and maps it to the order', async () => {
    const { raw, signature } = webhook(paid);
    const event = await provider().verifyWebhook(raw, { 'x-kashier-signature': signature });

    expect(event).toMatchObject({
      orderReference: 'AM-1234-ABCD',
      providerRef: 'kashier_AM-1234-ABCD',
      succeeded: true,
      pending: false,
      method: PaymentMethod.WALLET,
      amountCandidatesMinor: [15050],
    });
  });

  it('rejects a tampered amount', async () => {
    const { signature } = webhook(paid);
    const forged = webhook({ ...paid, amount: '1.00' }).raw;
    expect(await provider().verifyWebhook(forged, { 'x-kashier-signature': signature })).toBeNull();
  });

  it('rejects a missing signature', async () => {
    expect(await provider().verifyWebhook(webhook(paid).raw, {})).toBeNull();
  });

  it('treats a pending InstaPay request as neither paid nor failed', async () => {
    const { raw, signature } = webhook({ ...paid, status: 'PENDING', method: 'instapay' });
    const event = await provider().verifyWebhook(raw, { 'x-kashier-signature': signature });
    expect(event).toMatchObject({ succeeded: false, pending: true, method: PaymentMethod.CARD });
  });

  it('never grants from a refund event even when it succeeded', async () => {
    const { raw, signature } = webhook(paid, 'refund');
    const event = await provider().verifyWebhook(raw, { 'x-kashier-signature': signature });
    expect(event).toMatchObject({ succeeded: false, pending: true });
  });

  it('gives distinct event ids to a failure and a later success', async () => {
    const failed = webhook({ ...paid, status: 'FAILURE', transactionId: 'tx-0' });
    const ok = webhook(paid);
    const first = await provider().verifyWebhook(failed.raw, {
      'x-kashier-signature': failed.signature,
    });
    const second = await provider().verifyWebhook(ok.raw, { 'x-kashier-signature': ok.signature });
    expect(first?.eventId).not.toEqual(second?.eventId);
    expect(first?.succeeded).toBe(false);
  });
});

describe('KashierProvider.amountCandidates', () => {
  it.each([
    ['150.50', [15050]],
    ['150.5', [15050]],
    ['150', [15000, 150]],
    [11334, [1133400, 11334]],
    ['abc', []],
    ['-5', []],
  ])('%p -> %p', (input, expected) => {
    expect(KashierProvider.amountCandidates(input)).toEqual(expected);
  });
});
