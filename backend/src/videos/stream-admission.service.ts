import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import type { AppConfig } from '../config/configuration';

const ACTIVE = 'stream:active'; // zset userId -> lease expiry (ms)
const ENDS = 'stream:ends'; // hash userId -> estimated finish (ms)
const PAUSED = 'stream:paused'; // hash userId -> paused since (ms)
const QUEUE = 'stream:queue'; // zset userId -> joined at (ms), FIFO order
const SEEN = 'stream:queue:seen'; // zset userId -> last poll (ms)

/**
 * One atomic step of the admission state machine.
 *
 * Drops expired viewers and abandoned waiters, renews an existing slot, and
 * otherwise admits the caller only if a slot is free AND nobody who has been
 * waiting longer would be overtaken. Returns {1, 0} when admitted, {0, rank}
 * when queued, and {-1, length} when even the waiting room is full.
 */
const ACQUIRE = `
local now = tonumber(ARGV[1])
local user = ARGV[2]
local max = tonumber(ARGV[3])
local leaseUntil = tonumber(ARGV[4])
local staleBefore = tonumber(ARGV[5])
local queueMax = tonumber(ARGV[6])
local endAt = ARGV[7]

local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now)
for _, member in ipairs(expired) do
  redis.call('ZREM', KEYS[1], member)
  redis.call('HDEL', KEYS[2], member)
  redis.call('HDEL', KEYS[5], member)
end
local stale = redis.call('ZRANGEBYSCORE', KEYS[4], '-inf', staleBefore)
for _, member in ipairs(stale) do
  redis.call('ZREM', KEYS[3], member)
  redis.call('ZREM', KEYS[4], member)
end

local function admit()
  redis.call('ZADD', KEYS[1], leaseUntil, user)
  redis.call('HSET', KEYS[2], user, endAt)
  redis.call('ZREM', KEYS[3], user)
  redis.call('ZREM', KEYS[4], user)
  return {1, 0}
end

if redis.call('ZSCORE', KEYS[1], user) then return admit() end

local free = max - redis.call('ZCARD', KEYS[1])
if free > 0 then
  local rank = redis.call('ZRANK', KEYS[3], user)
  if rank then
    if rank < free then return admit() end
  elseif redis.call('ZCARD', KEYS[3]) < free then
    return admit()
  end
end

if not redis.call('ZSCORE', KEYS[3], user) then
  local waiting = redis.call('ZCARD', KEYS[3])
  if waiting >= queueMax then return {-1, waiting} end
  redis.call('ZADD', KEYS[3], now, user)
end
redis.call('ZADD', KEYS[4], now, user)
return {0, redis.call('ZRANK', KEYS[3], user) + 1}
`;

/** Renews a lease only while it is still live; a lapsed one must re-queue. */
const TOUCH = `
local score = redis.call('ZSCORE', KEYS[1], ARGV[2])
if score and tonumber(score) > tonumber(ARGV[1]) then
  redis.call('ZADD', KEYS[1], ARGV[3], ARGV[2])
  return 1
end
return 0
`;

export type AdmissionResult =
  | { admitted: true }
  | {
      admitted: false;
      /** 1-based place in line; 0 when the waiting room itself is full. */
      position: number;
      etaSeconds: number;
      retryAfterSeconds: number;
      capacity: number;
    };

/**
 * Admission control for recorded-lesson streaming.
 *
 * Segments stream through the API, so the number of simultaneous viewers is
 * what saturates the host's bandwidth and CPU. Instead of letting viewer N+1
 * degrade playback for everyone, they wait in a fair FIFO queue with an honest
 * position and an estimated wait, and are admitted automatically.
 *
 * Slots are leases: the player renews them while it is open, so a closed tab
 * frees its slot within one lease even if the release beacon never arrives.
 * State lives in Redis, so the limit holds across every API instance.
 *
 * If Redis is unreachable the platform fails OPEN — students keep watching
 * and the outage is logged — because blocking every lesson is worse than
 * briefly exceeding the soft limit.
 */
@Injectable()
export class StreamAdmissionService {
  private readonly logger = new Logger(StreamAdmissionService.name);
  private readonly cfg: AppConfig['streaming'];

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.cfg = config.get<AppConfig['streaming']>('streaming')!;
  }

  get enabled(): boolean {
    return this.cfg.maxConcurrent > 0;
  }

  get heartbeatSeconds(): number {
    return this.cfg.heartbeatSeconds;
  }

  /**
   * Admits or queues a student. `remainingSeconds` is how much of the lesson
   * is left to watch, which feeds the wait estimate shown to others.
   */
  async acquire(userId: string, remainingSeconds: number): Promise<AdmissionResult> {
    if (!this.enabled) return { admitted: true };
    const now = Date.now();
    try {
      const [state, value] = (await this.redis.client.eval(
        ACQUIRE,
        5,
        ACTIVE,
        ENDS,
        QUEUE,
        SEEN,
        PAUSED,
        now,
        userId,
        this.cfg.maxConcurrent,
        now + this.cfg.leaseSeconds * 1000,
        now - this.cfg.queuePollSeconds * 3 * 1000,
        this.cfg.queueMax,
        this.estimatedEnd(now, remainingSeconds),
      )) as [number, number];

      if (state === 1) return { admitted: true };
      const position = state === 0 ? value : 0;
      return {
        admitted: false,
        position,
        etaSeconds: await this.estimateWait(now, Math.max(position, 1)),
        // Jitter spreads the polling of a long queue instead of synchronising it.
        retryAfterSeconds: this.cfg.queuePollSeconds + Math.floor(Math.random() * 4),
        capacity: this.cfg.maxConcurrent,
      };
    } catch (error) {
      this.logger.error(`Admission check failed open: ${(error as Error).message}`);
      return { admitted: true };
    }
  }

  /**
   * Called by the player's heartbeat. A playing viewer keeps their slot; a
   * paused one keeps it for the grace period, then lets it lapse so a waiting
   * student can start. Returns false when the slot is gone.
   */
  async heartbeat(
    userId: string,
    input: { positionSeconds: number; durationSeconds: number; playing: boolean },
  ): Promise<AdmissionResult> {
    if (!this.enabled) return { admitted: true };
    const now = Date.now();
    try {
      if (input.playing) {
        await this.redis.client.hdel(PAUSED, userId);
      } else {
        await this.redis.client.hsetnx(PAUSED, userId, String(now));
        const since = Number(await this.redis.client.hget(PAUSED, userId));
        if (now - since > this.cfg.pauseGraceSeconds * 1000) {
          // Do not renew; report the slot as gone so the player can say so.
          const active = await this.redis.client.zscore(ACTIVE, userId);
          return active && Number(active) > now ? { admitted: true } : this.lapsed();
        }
      }
      const remaining = Math.max(0, input.durationSeconds - input.positionSeconds);
      return await this.acquire(userId, remaining);
    } catch (error) {
      this.logger.error(`Heartbeat failed open: ${(error as Error).message}`);
      return { admitted: true };
    }
  }

  /**
   * Cheap per-segment check. Renews a live lease; a viewer whose lease lapsed
   * (long pause, sleeping laptop) must go back through acquire, which respects
   * the queue, rather than silently reclaiming a slot.
   */
  async touch(userId: string): Promise<boolean> {
    if (!this.enabled) return true;
    const now = Date.now();
    try {
      const renewed = await this.redis.client.eval(
        TOUCH,
        1,
        ACTIVE,
        now,
        userId,
        now + this.cfg.leaseSeconds * 1000,
      );
      if (renewed === 1) return true;
      return (await this.acquire(userId, 0)).admitted;
    } catch (error) {
      this.logger.error(`Segment admission failed open: ${(error as Error).message}`);
      return true;
    }
  }

  /** The player closed: free the slot now instead of waiting for the lease. */
  async release(userId: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.redis.client
        .multi()
        .zrem(ACTIVE, userId)
        .hdel(ENDS, userId)
        .hdel(PAUSED, userId)
        .zrem(QUEUE, userId)
        .zrem(SEEN, userId)
        .exec();
    } catch (error) {
      this.logger.error(`Release failed: ${(error as Error).message}`);
    }
  }

  /** Live snapshot for the admin dashboard. */
  async snapshot() {
    if (!this.enabled) return { enabled: false, capacity: 0, active: 0, waiting: 0 };
    const now = Date.now();
    const [active, waiting] = await Promise.all([
      this.redis.client.zcount(ACTIVE, now, '+inf'),
      this.redis.client.zcard(QUEUE),
    ]);
    return { enabled: true, capacity: this.cfg.maxConcurrent, active, waiting };
  }

  /** A paused viewer whose grace ran out; they re-queue when they press play. */
  private lapsed(): AdmissionResult {
    return {
      admitted: false,
      position: 0,
      etaSeconds: 0,
      retryAfterSeconds: 0,
      capacity: this.cfg.maxConcurrent,
    };
  }

  /**
   * Viewers are assumed to finish what is left of their lesson. Clamped so a
   * missing duration or a bogus position cannot produce a wild estimate.
   */
  private estimatedEnd(now: number, remainingSeconds: number): number {
    const seconds = Math.min(Math.max(remainingSeconds || 0, 120), 3 * 60 * 60);
    return now + seconds * 1000;
  }

  /**
   * Waiter at `position` gets a slot when enough current viewers finish.
   * Slot k (1-based) frees at the k-th earliest estimated finish; positions
   * beyond the capacity wait an extra average session per full round.
   */
  private async estimateWait(now: number, position: number): Promise<number> {
    const ends = (await this.redis.client.hvals(ENDS))
      .map(Number)
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!ends.length) return 30;

    const remaining = ends.map((end) => Math.max(0, end - now) / 1000);
    const average = remaining.reduce((sum, value) => sum + value, 0) / remaining.length;
    const index = (position - 1) % this.cfg.maxConcurrent;
    const rounds = Math.floor((position - 1) / this.cfg.maxConcurrent);
    const first = remaining[Math.min(index, remaining.length - 1)];
    const estimate = first + rounds * Math.max(average, 600);
    // Round up to whole minutes past the first one; never promise under 30s.
    return Math.max(30, estimate < 60 ? Math.ceil(estimate) : Math.ceil(estimate / 60) * 60);
  }
}
