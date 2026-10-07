import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ManualTransfersController } from './manual-transfers.controller';
import { ManualTransferProvider } from './providers/manual-transfer.provider';

describe('Manual transfer review', () => {
  const prisma = {
    order: { findFirst: jest.fn(), findUnique: jest.fn() },
    payment: { updateMany: jest.fn() },
  };
  const orders = { settleOrder: jest.fn() };
  const config = { get: jest.fn(() => 'manual') };
  const controller = new ManualTransfersController(
    prisma as never,
    orders as never,
    config as never,
  );
  const user = { id: 'student-1' } as never;
  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('manual');
  });
  it('rejects all unauthenticated provider callbacks', async () => {
    expect(await new ManualTransferProvider().verifyWebhook()).toBeNull();
  });
  it('submitting transfer details never settles an order', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    await controller.submit(user, 'AM-1', {
      senderPhone: '01024066401',
      transactionReference: 'tx-1',
    });
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { reference: 'AM-1', userId: 'student-1', status: 'AWAITING_PAYMENT' },
    });
    expect(orders.settleOrder).not.toHaveBeenCalled();
  });
  it('does not accept a missing or other students order', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(
      controller.submit(user, 'AM-2', { senderPhone: '01024066401', transactionReference: 'tx-2' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });
  it('refuses to open content when the received amount differs', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'AWAITING_PAYMENT',
      totalMinor: 12000,
    });
    await expect(
      controller.approve(user, 'order-1', {
        receivedAmountMinor: 11900,
        transactionReference: 'tx-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(orders.settleOrder).not.toHaveBeenCalled();
  });
  it('passes the verified amount and approver into transactional settlement', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      reference: 'AM-1',
      status: 'AWAITING_PAYMENT',
      totalMinor: 12000,
    });
    await controller.approve({ id: 'admin-1' } as never, 'order-1', {
      receivedAmountMinor: 12000,
      transactionReference: 'tx-1',
    });
    expect(orders.settleOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        approvedBy: 'admin-1',
        amountMinor: 12000,
        providerRef: 'manual_tx-1',
      }),
    );
  });
  it('refuses cancelled orders and disabled transfer review', async () => {
    prisma.order.findUnique.mockResolvedValue({ status: 'CANCELLED', totalMinor: 12000 });
    await expect(
      controller.approve(user, 'order-1', {
        receivedAmountMinor: 12000,
        transactionReference: 'tx-1',
      }),
    ).rejects.toThrow(BadRequestException);
    config.get.mockReturnValue('paymob');
    await expect(
      controller.submit(user, 'AM-1', { senderPhone: '01024066401', transactionReference: 'tx-1' }),
    ).rejects.toThrow(BadRequestException);
  });
});
