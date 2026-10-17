import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ManualTransfersController } from './manual-transfers.controller';
import { ManualTransferProvider } from './providers/manual-transfer.provider';

describe('Manual transfers', () => {
  const tx = {
    payment: { update: jest.fn() },
    notification: { create: jest.fn() },
  };
  const prisma = {
    order: { findFirst: jest.fn(), findUnique: jest.fn() },
    payment: { updateMany: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const orders = { settleOrder: jest.fn() };
  const config = { get: jest.fn(() => 'manual') };
  const storage = {
    videoBucket: 'private',
    presignUpload: jest.fn(async (_b: string, key: string) => ({ url: `https://s3/${key}` })),
    presignDownload: jest.fn(async () => 'https://s3/signed-receipt'),
    statObject: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const settings = { get: jest.fn(), set: jest.fn() };
  const messages = { paymentConfirmed: jest.fn(async () => 1) };
  const controller = new ManualTransfersController(
    prisma as never,
    orders as never,
    config as never,
    storage as never,
    audit as never,
    settings as never,
    messages as never,
  );
  const student = { id: 'student-1' } as never;
  const admin = { id: 'admin-1' } as never;
  const req = { ip: '127.0.0.1' } as never;
  const proof = { senderPhone: '01024066401', transactionReference: 'tx-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('manual');
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    storage.statObject.mockResolvedValue({ size: 1000 });
  });

  it('rejects all unauthenticated provider callbacks', async () => {
    expect(await new ManualTransferProvider().verifyWebhook()).toBeNull();
  });

  it('records the sender number but never settles the order', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order1' });
    await expect(controller.submit(student, 'AM-1', proof)).resolves.toEqual({ submitted: true });
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { reference: 'AM-1', userId: 'student-1', status: 'AWAITING_PAYMENT' },
    });
    const saved = prisma.payment.updateMany.mock.calls[0][0].data.providerPayload;
    expect(saved).toMatchObject({ senderPhone: '01024066401', transactionReference: 'tx-1' });
    expect(saved.review).toBeUndefined();
    expect(orders.settleOrder).not.toHaveBeenCalled();
  });

  it('refuses other students’ orders', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(controller.submit(student, 'AM-2', proof)).rejects.toThrow(NotFoundException);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('approval settles the full order amount with the approver, and notifies the student', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      reference: 'AM-1',
      userId: 'student-1',
      status: 'AWAITING_PAYMENT',
      totalMinor: 12000,
      payments: [{ method: 'WALLET', providerPayload: proof }],
    });
    await controller.approve(admin, 'order-1');
    expect(orders.settleOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        approvedBy: 'admin-1',
        amountMinor: 12000,
        providerRef: 'manual_AM-1',
        succeeded: true,
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'student-1', href: '/dashboard/lessons' }),
    });
  });

  it('rejection keeps the order open, records the reason, audits and notifies', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      reference: 'AM-1',
      userId: 'student-1',
      status: 'AWAITING_PAYMENT',
      payments: [{ id: 'pay-1', providerPayload: proof }],
    });
    await controller.reject(admin, 'order-1', { reason: 'الصورة مش واضحة' }, req);
    const payload = tx.payment.update.mock.calls[0][0].data.providerPayload;
    expect(payload.review).toMatchObject({
      status: 'rejected',
      reason: 'الصورة مش واضحة',
      by: 'admin-1',
    });
    expect(payload.senderPhone).toBe('01024066401');
    expect(orders.settleOrder).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'payment.transfer.rejected' }),
    );
    expect(tx.notification.create).toHaveBeenCalled();
  });

  it('refuses cancelled orders and works only while manual transfers are enabled', async () => {
    prisma.order.findUnique.mockResolvedValue({ status: 'CANCELLED', payments: [] });
    await expect(controller.approve(admin, 'order-1')).rejects.toThrow(BadRequestException);
    config.get.mockReturnValue('paymob');
    await expect(controller.submit(student, 'AM-1', proof)).rejects.toThrow(BadRequestException);
  });

  it('lists transfers with their state and a short-lived screenshot link', async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        orderId: 'o1',
        amountMinor: 9000,
        method: 'CARD',
        createdAt: new Date(),
        providerPayload: proof,
        order: { reference: 'AM-1', user: { fullName: 'S' }, items: [{ titleSnapshot: 'L1' }] },
      },
      {
        orderId: 'o2',
        amountMinor: 9000,
        method: 'WALLET',
        createdAt: new Date(),
        providerPayload: null,
        order: { reference: 'AM-2', user: { fullName: 'S' }, items: [] },
      },
    ]);
    const list = await controller.list();
    expect(list[0]).toMatchObject({
      state: 'submitted',
      method: 'INSTAPAY',
      senderPhone: '01024066401',
      receiptUrl: null,
      items: ['L1'],
    });
    expect(list[1]).toMatchObject({ state: 'waiting', method: 'VODAFONE_CASH', receiptUrl: null });
  });
});

describe('transfer state', () => {
  it('treats legacy proofs (number + id, no screenshot) as needing review', () => {
    const { transferState } = jest.requireActual('./transfer-state');
    expect(transferState(null)).toBe('waiting');
    expect(transferState({ senderPhone: '01024066401', transactionReference: 'tx' })).toBe(
      'submitted',
    );
    expect(transferState({ receiptKey: 'k', senderPhone: '0' })).toBe('submitted');
    expect(
      transferState({
        receiptKey: 'k',
        review: { status: 'rejected', reason: 'x', at: '', by: '' },
      }),
    ).toBe('rejected');
  });
});
