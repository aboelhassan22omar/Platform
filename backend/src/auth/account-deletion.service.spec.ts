import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccountDeletionService, DELETED_NAME } from './account-deletion.service';

const setup = (user: Record<string, unknown> | null, passwordOk = true) => {
  const wiped: string[] = [];
  const table = (name: string) => ({
    deleteMany: jest.fn(async () => {
      wiped.push(name);
      return { count: 1 };
    }),
  });
  const tx = {
    user: { update: jest.fn(async () => ({})) },
    refreshToken: table('refreshToken'),
    passwordReset: table('passwordReset'),
    userDevice: table('userDevice'),
    pushSubscription: table('pushSubscription'),
    nativePushToken: table('nativePushToken'),
    lessonDownload: table('lessonDownload'),
    notification: table('notification'),
    parentReport: table('parentReport'),
    studyDay: table('studyDay'),
    presenceRecord: table('presenceRecord'),
    outboundMessage: table('outboundMessage'),
  };
  const prisma = {
    user: { findUnique: jest.fn(async () => user) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { record: jest.fn() };
  const passwords = { verify: jest.fn(async () => passwordOk) };
  const service = new AccountDeletionService(prisma as never, passwords as never, audit as never);
  return { service, tx, wiped, audit };
};

describe('Deleting my account', () => {
  const student = { role: 'STUDENT', passwordHash: 'h', deletedAt: null };

  it('wipes the personal details, signs out everywhere and keeps the payment history', async () => {
    const { service, tx, wiped, audit } = setup(student);
    expect(await service.deleteOwnAccount('u1', 'secret', '1.2.3.4')).toEqual({ deleted: true });
    const data = (tx.user.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0]
      .data;
    expect(data).toMatchObject({
      fullName: DELETED_NAME,
      username: 'deleted-u1',
      phone: 'deleted-u1',
      parentPhone: '',
      status: 'SUSPENDED',
      parentReportsEnabled: false,
      tokenVersion: { increment: 1 },
    });
    expect(String(data.passwordHash).startsWith('!')).toBe(true);
    expect(wiped).toEqual(
      expect.arrayContaining([
        'refreshToken',
        'userDevice',
        'pushSubscription',
        'nativePushToken',
        'parentReport',
        'outboundMessage',
      ]),
    );
    expect(Object.keys(tx)).not.toContain('order');
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'user.account.deleted' }),
    );
  });

  it('asks for the right password', async () => {
    const { service, tx } = setup(student, false);
    await expect(service.deleteOwnAccount('u1', 'wrong')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('leaves staff accounts to the owner', async () => {
    const { service } = setup({ ...student, role: 'SUPPORT' });
    await expect(service.deleteOwnAccount('u1', 'secret')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
