import { ProgressService } from './progress.service';

/** Progress row state before the request, and what the player reports now. */
const record = async (
  existing: {
    positionSeconds: number;
    durationSeconds: number;
    completed?: boolean;
    secondsAgo: number;
  } | null,
  report: { positionSeconds: number; durationSeconds: number; watchedSeconds: number },
  canonicalDuration = 90,
) => {
  const upsert = jest.fn(async (args: { create: Record<string, unknown> }) => args.create);
  const prisma = {
    videoAsset: { findUnique: jest.fn().mockResolvedValue({ durationSeconds: canonicalDuration }) },
    lessonProgress: {
      findUnique: jest.fn().mockResolvedValue(
        existing && {
          positionSeconds: existing.positionSeconds,
          durationSeconds: existing.durationSeconds,
          completed: existing.completed ?? false,
          lastWatchedAt: new Date(Date.now() - existing.secondsAgo * 1000),
        },
      ),
      upsert,
    },
  };
  const entitlements = { checkLessonAccess: jest.fn().mockResolvedValue({ allowed: true }) };
  const service = new ProgressService(prisma as never, entitlements as never);
  await service.record('student', 'lesson', report);
  const call = upsert.mock.calls[0][0] as unknown as {
    create: { positionSeconds: number; percent: number; completed: boolean };
    update: { positionSeconds: number; completed: boolean };
  };
  return existing
    ? { ...call.update, percent: (call.update as never as { percent: number }).percent }
    : call.create;
};

describe('Lesson completion', () => {
  it('reaches the last second when the student watches to the end (the old off-by-one)', async () => {
    // Real capture: last sync before the end at 75 s, then 14 whole seconds +
    // a fraction watched, the player reporting the end of a 90 s video.
    const result = await record(
      { positionSeconds: 75, durationSeconds: 90, secondsAgo: 8 },
      { positionSeconds: 90, durationSeconds: 90, watchedSeconds: 14 },
    );
    expect(result).toMatchObject({ positionSeconds: 90, percent: 100, completed: true });
  });

  it('completes a short video watched to the end (59/60 used to round to 98%)', async () => {
    const result = await record(
      { positionSeconds: 45, durationSeconds: 60, secondsAgo: 15 },
      { positionSeconds: 60, durationSeconds: 60, watchedSeconds: 14 },
      60,
    );
    expect(result).toMatchObject({ positionSeconds: 60, completed: true });
  });

  it('still refuses a jump to the end that was not watched', async () => {
    const result = await record(
      { positionSeconds: 10, durationSeconds: 90, secondsAgo: 5 },
      { positionSeconds: 90, durationSeconds: 90, watchedSeconds: 5 },
    );
    expect(result.completed).toBe(false);
    expect(result.positionSeconds).toBe(15);
  });

  it('still refuses a forged watchedSeconds that elapsed time cannot support', async () => {
    const result = await record(
      { positionSeconds: 30, durationSeconds: 90, secondsAgo: 2 },
      { positionSeconds: 90, durationSeconds: 90, watchedSeconds: 60 },
    );
    expect(result.completed).toBe(false);
    expect(result.positionSeconds).toBeLessThan(90);
  });
});
