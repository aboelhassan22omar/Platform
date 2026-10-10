import Redis from 'ioredis';
import type { ConfigService } from '@nestjs/config';
import type { RedisService } from '../common/redis/redis.service';
import { StreamAdmissionService } from './stream-admission.service';

/**
 * Runs the real Lua scripts against a real Redis. Set STREAM_TEST_REDIS_URL
 * (a throwaway database — keys are flushed) to run; skipped otherwise.
 */
const url = process.env.STREAM_TEST_REDIS_URL;
const suite = url ? describe : describe.skip;

suite('StreamAdmissionService (Redis)', () => {
  let client: Redis;

  const service = (overrides: Partial<Record<string, number>> = {}) =>
    new StreamAdmissionService(
      { client } as unknown as RedisService,
      {
        get: () => ({
          maxConcurrent: 3,
          leaseSeconds: 75,
          heartbeatSeconds: 25,
          pauseGraceSeconds: 600,
          queuePollSeconds: 10,
          queueMax: 2,
          ...overrides,
        }),
      } as unknown as ConfigService,
    );

  beforeAll(() => {
    client = new Redis(url!);
  });
  beforeEach(async () => {
    await client.flushdb();
  });
  afterAll(async () => {
    await client.quit();
  });

  it('admits up to the limit, then queues the fourth viewer with an estimate', async () => {
    const admission = service();
    for (const user of ['a', 'b', 'c']) {
      expect(await admission.acquire(user, 1800)).toEqual({ admitted: true });
    }
    const fourth = await admission.acquire('d', 1800);
    expect(fourth).toMatchObject({ admitted: false, position: 1, capacity: 3 });
    if (!fourth.admitted) {
      // Everyone has ~30 minutes left, so the first seat frees in ~30 minutes.
      expect(fourth.etaSeconds).toBeGreaterThanOrEqual(29 * 60);
      expect(fourth.etaSeconds).toBeLessThanOrEqual(31 * 60);
    }
  });

  it('renews a seated viewer instead of counting them twice', async () => {
    const admission = service();
    await admission.acquire('a', 600);
    expect(await admission.acquire('a', 600)).toEqual({ admitted: true });
    expect((await admission.snapshot()).active).toBe(1);
  });

  it('serves the queue in order when a seat frees', async () => {
    const admission = service({ maxConcurrent: 1 });
    await admission.acquire('a', 600);
    expect(await admission.acquire('b', 600)).toMatchObject({ position: 1 });
    expect(await admission.acquire('c', 600)).toMatchObject({ position: 2 });

    await admission.release('a');
    // c polls first but must not overtake b.
    expect(await admission.acquire('c', 600)).toMatchObject({ admitted: false, position: 2 });
    expect(await admission.acquire('b', 600)).toEqual({ admitted: true });
  });

  it('caps the waiting room', async () => {
    const admission = service({ maxConcurrent: 1, queueMax: 1 });
    await admission.acquire('a', 600);
    await admission.acquire('b', 600);
    expect(await admission.acquire('c', 600)).toMatchObject({ admitted: false, position: 0 });
  });

  it('frees the seat of a viewer whose lease lapsed', async () => {
    const admission = service({ maxConcurrent: 1 });
    await admission.acquire('a', 600);
    await client.zadd('stream:active', Date.now() - 1, 'a');
    expect(await admission.acquire('b', 600)).toEqual({ admitted: true });
    // The lapsed viewer cannot reclaim a seat from a segment request.
    expect(await admission.touch('a')).toBe(false);
  });

  it('lets a paused viewer keep the seat only for the grace period', async () => {
    const admission = service({ maxConcurrent: 1 });
    await admission.acquire('a', 600);
    const paused = { positionSeconds: 10, durationSeconds: 600, playing: false };
    expect(await admission.heartbeat('a', paused)).toEqual({ admitted: true });

    await client.hset('stream:paused', 'a', String(Date.now() - 601_000));
    await client.zadd('stream:active', Date.now() - 1, 'a');
    expect(await admission.heartbeat('a', paused)).toMatchObject({ admitted: false });
  });

  it('is a no-op when the limit is disabled', async () => {
    const admission = service({ maxConcurrent: 0 });
    for (let i = 0; i < 50; i += 1) {
      expect(await admission.acquire(`u${i}`, 600)).toEqual({ admitted: true });
    }
    expect(await client.zcard('stream:active')).toBe(0);
  });
});
