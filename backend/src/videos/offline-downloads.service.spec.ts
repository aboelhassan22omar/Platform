import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OFFLINE_TICKET_PREFIX, OfflineDownloadsService } from './offline-downloads.service';

const add = jest.fn();
jest.mock('bullmq', () => ({ Queue: jest.fn().mockImplementation(() => ({ add })) }));

const PREFIX = 'hls/asset1.job1/';

const setup = (
  opts: { offlineKey?: string | null; downloadsOn?: boolean; allowed?: boolean } = {},
) => {
  const asset = {
    id: 'asset1',
    hlsPrefix: PREFIX,
    processedAt: new Date(),
    renditions: ['360p', '480p', '720p'],
    durationSeconds: 1200,
    offlineKey: opts.offlineKey === undefined ? `${PREFIX}offline-480p.mp4` : opts.offlineKey,
    offlineSize: BigInt(150_000_000),
    offlineQuality: '480p',
  };
  const prisma = {
    videoAsset: {
      findUnique: jest.fn(async () => asset),
      update: jest.fn(),
      findMany: jest.fn(async () => [{ id: 'old', offlineKey: 'hls/old/offline-480p.mp4' }]),
      updateMany: jest.fn(),
    },
    playbackTicket: { create: jest.fn(), findUnique: jest.fn() },
    lessonDownload: {
      upsert: jest.fn(),
      findUnique: jest.fn(async () => ({ id: 'd1' })),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    lesson: { findUnique: jest.fn(async () => ({ durationSeconds: 1200, videoAsset: null })) },
    lessonProgress: { upsert: jest.fn() },
    studyDay: { upsert: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
  const entitlements = {
    checkLessonAccess: jest.fn(async () => ({
      allowed: opts.allowed ?? true,
      reason: opts.allowed === false ? 'EXPIRED' : 'SUBSCRIPTION',
    })),
  };
  const viewLimits = {
    assertCanStart: jest.fn(),
    allowance: jest.fn(async () => ({ exhausted: false })),
  };
  const access = {
    get: jest.fn(async () => ({
      maxDevices: 2,
      defaultMaxViews: 0,
      offlineDownloads: opts.downloadsOn ?? true,
      offlineDays: 7,
    })),
  };
  const storage = {
    videoBucket: 'videos',
    removeObject: jest.fn(async () => undefined),
    getObjectStream: jest.fn(async () => 'stream'),
  };
  const redis = { client: { set: jest.fn(async () => 'OK'), del: jest.fn(async () => 1) } };
  const service = new OfflineDownloadsService(
    prisma as never,
    redis as never,
    storage as never,
    entitlements as never,
    viewLimits as never,
    access as never,
    new ConfigService({ redis: { url: 'redis://localhost:6379' } }),
  );
  return { service, prisma, storage, viewLimits };
};

describe('Lessons saved on the phone', () => {
  beforeEach(() => add.mockReset());

  it('is refused when the owner turned downloads off', async () => {
    const { service } = setup({ downloadsOn: false });
    await expect(service.request('u1', 'l1', { isStaff: false })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('asks the worker to package the 480p version once, then reports progress', async () => {
    const { service } = setup({ offlineKey: null });
    expect(await service.request('u1', 'l1', { isStaff: false })).toMatchObject({
      status: 'PREPARING',
    });
    expect(add).toHaveBeenCalledWith(
      'prepare',
      { videoAssetId: 'asset1', hlsPrefix: PREFIX, quality: '480p' },
      expect.objectContaining({ jobId: expect.stringMatching(/^offline-asset1-/) }),
    );
  });

  it('packages again when the file belongs to a replaced video', async () => {
    const { service } = setup({ offlineKey: 'hls/asset1.old/offline-480p.mp4' });
    expect((await service.request('u1', 'l1', { isStaff: false })).status).toBe('PREPARING');
  });

  it('hands out a short-lived download link and remembers the download', async () => {
    const { service, prisma, viewLimits } = setup();
    const result = await service.request('u1', 'l1', { isStaff: false });
    expect(result).toMatchObject({ status: 'READY', sizeBytes: 150_000_000, quality: '480p' });
    if (result.status !== 'READY') throw new Error('not ready');
    expect(result.url).toContain(`ticket=${encodeURIComponent(OFFLINE_TICKET_PREFIX)}`);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(viewLimits.assertCanStart).toHaveBeenCalledWith('u1', 'l1');
    expect(prisma.lessonDownload.upsert).toHaveBeenCalled();
  });

  it('serves the file only for a download ticket', async () => {
    const { service } = setup();
    await expect(service.file('l1', 'staff.abc')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('counts offline watching and tells the app to delete a lesson the student lost', async () => {
    const { service, prisma } = setup({ allowed: false });
    const result = await service.sync('u1', [{ lessonId: 'l1', watchedSeconds: 600 }], {
      isStaff: false,
    });
    expect(prisma.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { viewedSeconds: { increment: 600 } } }),
    );
    expect(result.items[0]).toMatchObject({ lessonId: 'l1', allowed: false, reason: 'EXPIRED' });
  });

  it('caps what one sync can charge, so a broken clock cannot wipe out every view', async () => {
    const { service, prisma } = setup();
    await service.sync('u1', [{ lessonId: 'l1', watchedSeconds: 500_000 }], { isStaff: false });
    expect(prisma.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { viewedSeconds: { increment: 3600 } } }),
    );
  });

  it('renews a lesson the student still has', async () => {
    const { service } = setup();
    const result = await service.sync('u1', [{ lessonId: 'l1', watchedSeconds: 0 }], {
      isStaff: false,
    });
    expect(result.items[0].allowed).toBe(true);
    expect(result.offlineDays).toBe(7);
  });

  it('deletes packaged files nobody downloaded for days', async () => {
    const { service, storage, prisma } = setup();
    expect(await service.cleanup()).toBe(1);
    expect(storage.removeObject).toHaveBeenCalledWith('videos', 'hls/old/offline-480p.mp4');
    expect(prisma.videoAsset.updateMany).toHaveBeenCalled();
  });
});
