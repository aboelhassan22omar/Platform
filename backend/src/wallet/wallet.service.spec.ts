import { InsufficientBalanceError, WalletService } from './wallet.service';

/** A tiny in-memory users table that honours the conditional decrement. */
const setup = (balance: number, role = 'STUDENT') => {
  const state = { balance };
  const tx = {
    user: {
      update: jest.fn(async ({ data }: { data: { walletBalanceMinor: { increment: number } } }) => {
        state.balance += data.walletBalanceMinor.increment;
        return { walletBalanceMinor: state.balance };
      }),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { walletBalanceMinor: { gte: number } };
          data: { walletBalanceMinor: { decrement: number } };
        }) => {
          if (state.balance < where.walletBalanceMinor.gte) return { count: 0 };
          state.balance -= data.walletBalanceMinor.decrement;
          return { count: 1 };
        },
      ),
      findUniqueOrThrow: jest.fn(async () => ({ walletBalanceMinor: state.balance })),
      findUnique: jest.fn(async () => ({ role, walletBalanceMinor: state.balance })),
    },
    walletTransaction: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'tx',
        ...data,
      })),
    },
    notification: { create: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn() };
  const service = new WalletService(prisma as never, audit as never);
  return { service, tx, state, audit };
};

describe('Platform wallet', () => {
  it('credits the balance and records the balance after the change', async () => {
    const { service, tx, state } = setup(5_000);
    await service.credit(tx as never, { userId: 'u', amountMinor: 10_000, type: 'TOPUP' });
    expect(state.balance).toBe(15_000);
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'TOPUP',
        amountMinor: 10_000,
        balanceAfterMinor: 15_000,
      }),
    });
  });

  it('spends the balance as a negative statement line', async () => {
    const { service, tx, state } = setup(20_000);
    await service.debit(tx as never, {
      userId: 'u',
      amountMinor: 15_000,
      type: 'PURCHASE',
      orderId: 'order',
    });
    expect(state.balance).toBe(5_000);
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amountMinor: -15_000, balanceAfterMinor: 5_000 }),
    });
  });

  it('refuses to spend more than the balance and reports the shortfall', async () => {
    const { service, tx, state } = setup(4_000);
    const attempt = service.debit(tx as never, {
      userId: 'u',
      amountMinor: 15_000,
      type: 'PURCHASE',
    });
    await expect(attempt).rejects.toBeInstanceOf(InsufficientBalanceError);
    await attempt.catch((error: InsufficientBalanceError) => {
      expect(error.getResponse()).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
      expect(error.shortfallMinor).toBe(11_000);
      expect(error.message).toContain('١١٠');
    });
    expect(state.balance).toBe(4_000);
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('lets staff add and remove balance with a reason, audited and notified', async () => {
    const { service, state, audit, tx } = setup(0);
    await service.adjustByStaff({
      actorId: 'admin',
      userId: 'u',
      amountMinor: 20_000,
      note: 'كاش في السنتر',
    });
    await service.adjustByStaff({
      actorId: 'admin',
      userId: 'u',
      amountMinor: -5_000,
      note: 'تصحيح',
    });
    expect(state.balance).toBe(15_000);
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    await expect(
      service.adjustByStaff({ actorId: 'admin', userId: 'u', amountMinor: -50_000, note: 'كتير' }),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('only adjusts student accounts', async () => {
    const { service } = setup(0, 'ADMIN');
    await expect(
      service.adjustByStaff({ actorId: 'admin', userId: 'u', amountMinor: 1_000, note: 'test' }),
    ).rejects.toThrow('الطالب غير موجود');
  });
});
