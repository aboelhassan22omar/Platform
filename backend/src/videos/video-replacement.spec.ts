import { VideoStatus } from '../generated/prisma/enums';
import { hasPlayableVersion } from './playable';
import { VideosService } from './videos.service';

/** Built without the constructor so no BullMQ/Redis connection is opened. */
const build = (asset: Record<string, unknown> | null) => {
  const prisma = {
    videoAsset: {
      findUnique: jest.fn().mockResolvedValue(asset),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    lessonProgress: { findUnique: jest.fn().mockResolvedValue(null) },
    playbackTicket: { create: jest.fn() },
  };
  const service = Object.assign(Object.create(VideosService.prototype) as object, {
    prisma,
    entitlements: {
      checkLessonAccess: jest.fn().mockResolvedValue({ allowed: true, reason: 'PURCHASED' }),
    },
    admission: { acquire: jest.fn().mockResolvedValue({ admitted: true }), enabled: false },
    viewLimits: { assertCanStart: jest.fn().mockResolvedValue({ limited: false }) },
    config: { get: jest.fn().mockReturnValue(600) },
    storage: {
      publicUrl: (key: string | null) => key,
      removeObject: jest.fn().mockResolvedValue(undefined),
      getObjectStream: jest.fn().mockResolvedValue('stream'),
      videoBucket: 'videos',
    },
  });
  return { service: service as unknown as VideosService, prisma };
};

const published = {
  id: 'asset',
  hlsPrefix: 'hls/asset/',
  processedAt: new Date(),
  masterPlaylist: 'master.m3u8',
  durationSeconds: 60,
  posterKey: null,
  renditions: ['720p'],
};

describe('Replacing a lesson video', () => {
  it('treats only a finished transcode as playable', () => {
    expect(hasPlayableVersion({ hlsPrefix: 'hls/a/', processedAt: new Date() })).toBe(true);
    expect(hasPlayableVersion({ hlsPrefix: null, processedAt: null })).toBe(false);
    expect(hasPlayableVersion({ hlsPrefix: 'hls/a/', processedAt: null })).toBe(false);
    expect(hasPlayableVersion(null)).toBe(false);
  });

  it.each([VideoStatus.AWAITING_UPLOAD, VideoStatus.PROCESSING, VideoStatus.FAILED])(
    'keeps serving the published version while the replacement is %s',
    async (status) => {
      const { service } = build({ ...published, status });
      await expect(service.issuePlaybackTicket('student', 'lesson')).resolves.toMatchObject({
        status: 'ADMITTED',
      });
      await expect(service.streamObject('lesson', '720p/seg_000.ts')).resolves.toMatchObject({
        stream: 'stream',
      });
    },
  );

  it('still says "preparing" for a first upload that is not ready', async () => {
    const { service } = build({ ...published, hlsPrefix: null, processedAt: null });
    await expect(service.issuePlaybackTicket('student', 'lesson')).rejects.toThrow('بيتجهز');
  });

  it('restores an abandoned replacement instead of deleting the published video', async () => {
    const { service, prisma } = build(null);
    prisma.videoAsset.findMany.mockResolvedValue([
      { id: 'replaced', sourceKey: 'sources/r.mp4', hlsPrefix: 'hls/r/', processedAt: new Date() },
      { id: 'never', sourceKey: 'sources/n.mp4', hlsPrefix: null, processedAt: null },
    ]);
    await service.purgeAbandonedUploads();
    expect(prisma.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['replaced'] } },
      data: { status: VideoStatus.READY, sourceKey: null, errorMessage: null },
    });
    expect(prisma.videoAsset.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['never'] } },
    });
  });
});
