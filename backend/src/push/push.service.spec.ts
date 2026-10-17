import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    generateVAPIDKeys: jest.fn(() => ({ publicKey: 'pub', privateKey: 'priv' })),
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}));

const send = webpush.sendNotification as jest.Mock;

const setup = () => {
  const prisma = {
    siteSetting: { findUnique: jest.fn(), createMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    notification: {
      updateMany: jest.fn(),
      findMany: jest.fn(async () => [
        {
          id: 'n1',
          userId: 'u1',
          title: 'رصيدك اتشحن',
          body: 'اتضاف ١٠٠ جنيه',
          href: '/dashboard/wallet',
        },
        { id: 'n2', userId: 'u2', title: 'بدون جهاز', body: 'x', href: null },
      ]),
    },
    pushSubscription: {
      findMany: jest.fn(async () => [
        { id: 's1', userId: 'u1', endpoint: 'https://push/1', p256dh: 'k', auth: 'a' },
        { id: 's2', userId: 'u1', endpoint: 'https://push/2', p256dh: 'k', auth: 'a' },
      ]),
      delete: jest.fn(async () => ({})),
      updateMany: jest.fn(),
    },
  };
  const service = new PushService(
    prisma as never,
    {} as never,
    new ConfigService({ push: { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.c' } }),
  );
  return { service, prisma };
};

describe('Phone notifications', () => {
  beforeEach(() => send.mockReset());

  it("pushes every fresh notification to all of its user's phones and marks them sent", async () => {
    const { service, prisma } = setup();
    send.mockResolvedValue({});
    expect(await service.dispatch()).toBe(2);
    const payload = JSON.parse(send.mock.calls[0][1] as string);
    expect(payload).toMatchObject({ title: 'رصيدك اتشحن', url: '/dashboard/wallet' });
    // Stale ones are skipped, and the batch is marked before sending (no double push).
    expect(prisma.notification.updateMany).toHaveBeenCalledTimes(2);
  });

  it('forgets a phone whose app was uninstalled', async () => {
    const { service, prisma } = setup();
    send
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValue({});
    await service.dispatch();
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
