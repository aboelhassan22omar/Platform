import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper over a single ioredis connection. Used for presence tracking,
 * auth throttling counters and short-lived caches. BullMQ opens its own
 * connections (it requires `maxRetriesPerRequest: null`).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('redis.url')!, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Redis connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Increments a counter and sets its TTL on first use.
   * Returns the running count — used by the auth rate limiter.
   */
  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const results = await this.client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
    const count = results?.[0]?.[1];
    return typeof count === 'number' ? count : 0;
  }

  /** Atomically records a failure and starts a fixed lock at the threshold. */
  async recordFailedLogin(
    attemptsKey: string,
    lockKey: string,
    maxAttempts: number,
    windowSeconds: number,
    lockSeconds: number,
  ): Promise<{ attempts: number; retryAfterSeconds: number }> {
    const result = (await this.client.eval(
      `local locked = redis.call('TTL', KEYS[2])
       if locked > 0 then return {0, locked} end
       local attempts = redis.call('INCR', KEYS[1])
       if attempts == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
       if attempts >= tonumber(ARGV[1]) then
         redis.call('SET', KEYS[2], '1', 'EX', ARGV[3], 'NX')
         redis.call('DEL', KEYS[1])
         return {attempts, tonumber(ARGV[3])}
       end
       return {attempts, 0}`,
      2,
      attemptsKey,
      lockKey,
      maxAttempts,
      windowSeconds,
      lockSeconds,
    )) as [number, number];

    return { attempts: Number(result[0]), retryAfterSeconds: Number(result[1]) };
  }
}
