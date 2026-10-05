import { ConfigService } from '@nestjs/config';
import { LiveService } from './live.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { Role } from '../generated/prisma/enums';

jest.mock('../common/storage/storage.service', () => ({ StorageService: class {} }));

describe('Live presenter monitoring', () => {
  const session = {
    id: 'class-1', roomName: 'room-1',
    startedAt: new Date(Date.now() - 300_000),
    hostAbsentSince: new Date(Date.now() - 120_000),
    recordingEnabled: true,
    kickedUserIds: [],
    recordings: [{ status: 'RECORDING', startedAt: new Date() }],
  };

  function setup(error: Error) {
    const prisma = { liveSession: {
      findMany: jest.fn().mockResolvedValue([session]), update: jest.fn(),
    } };
    const service = new LiveService(
      prisma as unknown as PrismaService,
      {} as AuditService, {} as ConfigService, {} as StorageService,
    );
    jest.spyOn(service as any, 'roomService').mockReturnValue({
      listParticipants: jest.fn().mockRejectedValue(error),
    });
    const stop = jest.spyOn(service as any, 'stopRecordings').mockResolvedValue(undefined);
    const finish = jest.spyOn(service as any, 'finish').mockResolvedValue(true);
    return { service, prisma, stop, finish };
  }

  it.each(['network timeout', 'unauthorized'])('keeps the class and recording alive on %s', async (message) => {
    const { service, prisma, stop, finish } = setup(new Error(message));
    await (service as any).watchLiveSessions();
    expect(stop).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
    expect(prisma.liveSession.update).not.toHaveBeenCalled();
  });

  it('closes a confirmed missing room after the presenter grace period', async () => {
    const { service, stop, finish } = setup(Object.assign(new Error('missing room'), { code: 'not_found' }));
    await (service as any).watchLiveSessions();
    expect(stop).toHaveBeenCalledWith(session.id);
    expect(finish).toHaveBeenCalledWith(session.id, 'HOST_LEFT');
  });
});

describe('Live participant moderation', () => {
  const actor = { id: 'host', role: Role.ADMIN, username: 'teacher' } as any;
  const student = { id: 'student', role: Role.STUDENT, username: 'student' } as any;
  function setup() {
    const session = { id: 'class', roomName: 'room', status: 'LIVE', kickedUserIds: [], grade: {} };
    const prisma = {
      liveSession: { findUnique: jest.fn().mockResolvedValue(session), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: Role.STUDENT }) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new LiveService(prisma as any, audit as any, { get: () => 'configured' } as any, {} as any);
    const rooms = { removeParticipant: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(service as any, 'roomService').mockReturnValue(rooms);
    return { service, prisma, session, rooms, audit };
  }
  it('persists a session ban and revokes the participant token', async () => {
    const { service, prisma, rooms, audit } = setup();
    await expect(service.kickParticipant(actor, 'class', 'student')).resolves.toEqual({ kicked: true });
    expect(prisma.liveSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { kickedUserIds: { push: 'student' } } }));
    expect(rooms.removeParticipant).toHaveBeenCalledWith('room', 'student', { revokeTokenTs: expect.any(BigInt) });
    expect(audit.record).toHaveBeenCalled();
  });
  it('does not let students kick other participants', async () => {
    const { service, rooms } = setup();
    await expect(service.kickParticipant(student, 'class', 'other')).rejects.toThrow('غير مسموح');
    expect(rooms.removeParticipant).not.toHaveBeenCalled();
  });
  it('protects staff from being kicked', async () => {
    const { service, prisma, rooms } = setup();
    prisma.user.findUnique.mockResolvedValue({ role: Role.ADMIN });
    await expect(service.kickParticipant(actor, 'class', 'other-host')).rejects.toThrow('تقدر تطرد طالب بس');
    expect(rooms.removeParticipant).not.toHaveBeenCalled();
  });
  it('rejects new tickets and chat from a kicked student', async () => {
    const { service, session } = setup();
    (session.kickedUserIds as string[]).push('student');
    await expect(service.token(student, 'class')).rejects.toThrow('المستر أخرجك');
    await expect(service.postChat(student, 'class', 'hello')).rejects.toThrow('المستر أخرجك');
  });
  it('reports disconnection failures while retaining the ban', async () => {
    const { service, prisma, rooms } = setup();
    rooms.removeParticipant.mockRejectedValue(new Error('timeout'));
    await expect(service.kickParticipant(actor, 'class', 'student')).rejects.toThrow('فصل الاتصال فشل');
    expect(prisma.liveSession.updateMany).toHaveBeenCalled();
  });
});
