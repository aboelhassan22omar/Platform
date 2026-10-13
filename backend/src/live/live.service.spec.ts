import { ConfigService } from '@nestjs/config';
import { LiveService } from './live.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { Role } from '../generated/prisma/enums';

jest.mock('../common/storage/storage.service', () => ({ StorageService: class {} }));

describe('Live presenter monitoring', () => {
  const session = {
    id: 'class-1',
    roomName: 'room-1',
    startedAt: new Date(Date.now() - 300_000),
    hostAbsentSince: new Date(Date.now() - 120_000),
    recordingEnabled: true,
    kickedUserIds: [],
    recordings: [{ status: 'RECORDING', startedAt: new Date() }],
  };

  function setup(error: Error) {
    const prisma = {
      liveSession: {
        findMany: jest.fn().mockResolvedValue([session]),
        update: jest.fn(),
      },
    };
    const service = new LiveService(
      prisma as unknown as PrismaService,
      {} as AuditService,
      {} as ConfigService,
      {} as StorageService,
    );
    jest.spyOn(service as any, 'roomService').mockReturnValue({
      listParticipants: jest.fn().mockRejectedValue(error),
    });
    const stop = jest.spyOn(service as any, 'stopRecordings').mockResolvedValue(undefined);
    const finish = jest.spyOn(service as any, 'finish').mockResolvedValue(true);
    return { service, prisma, stop, finish };
  }

  it.each(['network timeout', 'unauthorized'])(
    'keeps the class and recording alive on %s',
    async (message) => {
      const { service, prisma, stop, finish } = setup(new Error(message));
      await (service as any).watchLiveSessions();
      expect(stop).not.toHaveBeenCalled();
      expect(finish).not.toHaveBeenCalled();
      expect(prisma.liveSession.update).not.toHaveBeenCalled();
    },
  );

  it('closes a confirmed missing room after the presenter grace period', async () => {
    const { service, stop, finish } = setup(
      Object.assign(new Error('missing room'), { code: 'not_found' }),
    );
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
      liveSession: {
        findUnique: jest.fn().mockResolvedValue(session),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ role: Role.STUDENT }) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new LiveService(
      prisma as any,
      audit as any,
      { get: () => 'configured' } as any,
      {} as any,
    );
    const rooms = { removeParticipant: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(service as any, 'roomService').mockReturnValue(rooms);
    return { service, prisma, session, rooms, audit };
  }
  it('persists a session ban and revokes the participant token', async () => {
    const { service, prisma, rooms, audit } = setup();
    await expect(service.kickParticipant(actor, 'class', 'student')).resolves.toEqual({
      kicked: true,
    });
    expect(prisma.liveSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { kickedUserIds: { push: 'student' } } }),
    );
    expect(rooms.removeParticipant).toHaveBeenCalledWith('room', 'student', {
      revokeTokenTs: expect.any(BigInt),
    });
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
    await expect(service.kickParticipant(actor, 'class', 'other-host')).rejects.toThrow(
      'تقدر تطرد طالب بس',
    );
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
    await expect(service.kickParticipant(actor, 'class', 'student')).rejects.toThrow(
      'فصل الاتصال فشل',
    );
    expect(prisma.liveSession.updateMany).toHaveBeenCalled();
  });
});

describe('Live recording results', () => {
  const recording = {
    id: 'rec',
    egressId: 'EG_1',
    status: 'PROCESSING',
    startedAt: new Date(),
    objectKey: 'live-recordings/s/r.mp4',
  };
  function setup(info: Record<string, unknown>, stored: number | null = null) {
    const prisma = {
      liveRecording: {
        findMany: jest.fn().mockResolvedValue([recording]),
        update: jest.fn(),
      },
    };
    const storage = {
      videoBucket: 'videos',
      statObject: jest.fn(() =>
        stored === null
          ? Promise.reject(new Error('NoSuchKey'))
          : Promise.resolve({ size: stored }),
      ),
    };
    const service = new LiveService(prisma as any, {} as any, {} as any, storage as any);
    jest.spyOn(service as any, 'egressClient').mockReturnValue({
      listEgress: jest.fn().mockResolvedValue([
        {
          status: 3, // EGRESS_COMPLETE
          fileResults: [],
          result: { case: undefined },
          startedAt: 1_000_000_000n,
          endedAt: 61_000_000_000n,
          error: '',
          ...info,
        },
      ]),
    });
    return { service, prisma, storage };
  }
  const data = (prisma: any) => prisma.liveRecording.update.mock.calls[0][0].data;

  it('reads the file from fileResults', async () => {
    const { service, prisma } = setup({
      fileResults: [{ duration: 42_000_000_000n, size: 900n }],
    });
    await (service as any).syncRecordings();
    expect(data(prisma)).toMatchObject({ status: 'READY', durationSeconds: 42, sizeBytes: 900n });
  });

  it('reads the file from the legacy result LiveKit Cloud fills', async () => {
    const { service, prisma } = setup({
      result: { case: 'file', value: { duration: 30_000_000_000n, size: 500n } },
    });
    await (service as any).syncRecordings();
    expect(data(prisma)).toMatchObject({ status: 'READY', durationSeconds: 30, sizeBytes: 500n });
  });

  it('trusts the uploaded file when LiveKit sends no file info', async () => {
    const { service, prisma } = setup({}, 2048);
    await (service as any).syncRecordings();
    expect(data(prisma)).toMatchObject({
      status: 'READY',
      durationSeconds: 60,
      sizeBytes: 2048n,
      error: null,
    });
  });

  it('fails only when nothing reached the store', async () => {
    const { service, prisma } = setup({});
    await (service as any).syncRecordings();
    expect(data(prisma)).toMatchObject({ status: 'FAILED', error: 'التسجيل خلص من غير ملف' });
  });

  it('recovers recordings wrongly marked failed once their file is found', async () => {
    const { service, prisma } = setup({}, 4096);
    prisma.liveRecording.findMany.mockResolvedValue([
      {
        id: 'old',
        objectKey: 'live-recordings/s/old.mp4',
        startedAt: new Date('2026-10-13T22:08:36Z'),
        endedAt: new Date('2026-10-13T22:38:36Z'),
      },
    ]);
    await (service as any).recoverRecordings();
    await (service as any).recoverRecordings();
    expect(prisma.liveRecording.findMany).toHaveBeenCalledTimes(1);
    expect(data(prisma)).toMatchObject({
      status: 'READY',
      durationSeconds: 1800,
      sizeBytes: 4096n,
    });
  });
});
