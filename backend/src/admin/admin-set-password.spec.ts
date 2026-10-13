import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { AdminStudentsController } from './admin-students.controller';

describe('Admin sets a password for a support request', () => {
  const build = (target: { id: string; role: Role } | null) => {
    const tx = {
      user: { update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(target) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const audit = { record: jest.fn() };
    const passwords = { hash: jest.fn().mockResolvedValue('new-hash') };
    const controller = new AdminStudentsController(
      prisma as never,
      audit as never,
      {} as never,
      passwords as never,
    );
    return { controller, tx, audit, passwords };
  };
  const actor = (role: Role) => ({ id: 'actor', role }) as never;
  const req = { ip: '127.0.0.1' } as never;
  const dto = { newPassword: 'fresh-pass-1' };

  it('sets the hash, signs the student out everywhere and audits it', async () => {
    const { controller, tx, audit, passwords } = build({ id: 'student', role: Role.STUDENT });
    await expect(
      controller.setPassword(actor(Role.ADMIN), 'student', dto, req),
    ).resolves.toMatchObject({ ok: true });
    expect(passwords.hash).toHaveBeenCalledWith('fresh-pass-1');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'student' },
      data: { passwordHash: 'new-hash', tokenVersion: { increment: 1 } },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'student', revokedAt: null } }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'user.password.set_by_admin', targetUserId: 'student' }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('fresh-pass-1');
  });

  it('lets an admin reset staff below them, and a super admin reset an admin', async () => {
    await expect(
      build({ id: 'support', role: Role.SUPPORT }).controller.setPassword(
        actor(Role.ADMIN),
        'support',
        dto,
        req,
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      build({ id: 'admin2', role: Role.ADMIN }).controller.setPassword(
        actor(Role.SUPER_ADMIN),
        'admin2',
        dto,
        req,
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it('refuses equal or higher accounts, the actor themself, and unknown ids', async () => {
    const peer = build({ id: 'admin2', role: Role.ADMIN });
    await expect(
      peer.controller.setPassword(actor(Role.ADMIN), 'admin2', dto, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(peer.tx.user.update).not.toHaveBeenCalled();
    await expect(
      build({ id: 'boss', role: Role.SUPER_ADMIN }).controller.setPassword(
        actor(Role.ADMIN),
        'boss',
        dto,
        req,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      build({ id: 'actor', role: Role.ADMIN }).controller.setPassword(
        actor(Role.ADMIN),
        'actor',
        dto,
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build(null).controller.setPassword(actor(Role.ADMIN), 'ghost', dto, req),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
