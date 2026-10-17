import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { ViewLimitsService } from './view-limits.service';

const setup = (opts: {
  maxViews?: number | null;
  defaultMaxViews?: number;
  durationSeconds?: number;
  viewedSeconds?: number;
  bonusViews?: number;
  /** What the Redis "seen" script answers: 1 = charge this segment. */
  seen?: number;
}) => {
  const progress = { viewedSeconds: opts.viewedSeconds ?? 0, bonusViews: opts.bonusViews ?? 0 };
  const prisma = {
    lesson: {
      findUnique: jest.fn(async () => ({
        maxViews: opts.maxViews ?? null,
        durationSeconds: 0,
        videoAsset: { durationSeconds: opts.durationSeconds ?? 600 },
      })),
    },
    studyDay: { upsert: jest.fn() },
    lessonProgress: {
      findUnique: jest.fn(async () => progress),
      upsert: jest.fn(async ({ update }: { update: { viewedSeconds?: { increment: number } } }) => {
        progress.viewedSeconds += update.viewedSeconds?.increment ?? 0;
        return progress;
      }),
    },
  };
  const redis = { client: { eval: jest.fn(async () => opts.seen ?? 1) } };
  const access = {
    get: jest.fn(async () => ({ maxDevices: 2, defaultMaxViews: opts.defaultMaxViews ?? 0 })),
  };
  const service = new ViewLimitsService(
    prisma as never,
    redis as never,
    access as never,
    new ConfigService({ streaming: { segmentSeconds: 6 } }),
  );
  return { service, prisma, redis, progress };
};

const ticket = { userId: 'student', lessonId: 'lesson' };

describe('Lesson view limits', () => {
  it('is unlimited unless the platform or the lesson sets a number', async () => {
    const { service } = setup({ defaultMaxViews: 0, viewedSeconds: 99_999 });
    const allowance = await service.allowance('student', 'lesson');
    expect(allowance).toMatchObject({ limited: false, exhausted: false, remainingViews: null });
  });

  it('measures views in watch time: 3 views of a 10-minute video is 30 minutes', async () => {
    const { service } = setup({ defaultMaxViews: 3, durationSeconds: 600, viewedSeconds: 900 });
    expect(await service.allowance('student', 'lesson')).toMatchObject({
      limited: true,
      viewsUsed: 1.5,
      remainingSeconds: 900,
      remainingViews: 1.5,
      exhausted: false,
    });
  });

  it("uses the lesson's own number over the default, plus staff-granted views", async () => {
    const { service } = setup({
      defaultMaxViews: 3,
      maxViews: 1,
      bonusViews: 2,
      durationSeconds: 600,
      viewedSeconds: 1_200,
    });
    expect(await service.allowance('student', 'lesson')).toMatchObject({
      remainingSeconds: 600,
      remainingViews: 1,
    });
  });

  it('a lesson set to 0 is unlimited even when the platform default is not', async () => {
    const { service } = setup({ defaultMaxViews: 3, maxViews: 0, viewedSeconds: 50_000 });
    expect((await service.allowance('student', 'lesson')).limited).toBe(false);
  });

  it('charges each new segment once, and ignores playlists', async () => {
    const { service, progress, redis, prisma } = setup({ defaultMaxViews: 3 });
    await service.chargeSegment(ticket, 'v0/seg_004.ts');
    expect(progress.viewedSeconds).toBe(6);
    // The same 6 seconds land on today's study total for the parent report.
    expect(prisma.studyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { watchedSeconds: { increment: 6 } } }),
    );
    await service.chargeSegment(ticket, 'v1/index.m3u8');
    expect(redis.client.eval).toHaveBeenCalledTimes(1);
  });

  it('does not charge a segment fetched again moments later', async () => {
    const { service, prisma } = setup({ defaultMaxViews: 3, seen: 0 });
    await service.chargeSegment(ticket, 'v2/seg_004.ts');
    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it('stops serving once the views are used up', async () => {
    const { service, prisma } = setup({
      defaultMaxViews: 2,
      durationSeconds: 600,
      viewedSeconds: 1_200,
    });
    await expect(service.chargeSegment(ticket, 'v0/seg_010.ts')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.assertCanStart('student', 'lesson')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });

  it('serves uncharged when Redis is down rather than blocking the lesson', async () => {
    const { service, redis, prisma } = setup({ defaultMaxViews: 1 });
    redis.client.eval.mockRejectedValueOnce(new Error('down'));
    await expect(service.chargeSegment(ticket, 'v0/seg_001.ts')).resolves.toBeUndefined();
    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
  });
});
