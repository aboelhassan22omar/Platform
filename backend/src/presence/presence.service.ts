import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const PRESENCE_KEY = 'presence:online';
const ROUTE_KEY = 'presence:route';

/**
 * Online-student tracking.
 *
 * DEFINITION: a student is "online" if an authenticated heartbeat arrived
 * within PRESENCE_TTL_SECONDS. That is an approximation of activity — it does
 * NOT prove anyone is watching the screen, and a backgrounded tab keeps
 * counting until the TTL lapses. The admin UI labels it accordingly.
 *
 * Redis holds the live set (a sorted set keyed by last-seen timestamp, so
 * expiry is a range query). Postgres keeps a durable mirror so the data
 * survives a Redis flush.
 */
@Injectable()
export class PresenceService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlSeconds = config.get<number>('presence.ttlSeconds')!;
  }

  async heartbeat(userId: string, route?: string, userAgent?: string): Promise<void> {
    const now = Date.now();
    const pipeline = this.redis.client.multi();
    pipeline.zadd(PRESENCE_KEY, now, userId);
    if (route) pipeline.hset(ROUTE_KEY, userId, route.slice(0, 120));
    await pipeline.exec();

    // The durable mirror is written at most once per TTL window, not on every
    // heartbeat — this is the difference between a few writes a minute and a
    // write per student per 45 seconds.
    const mirrorKey = `presence:mirrored:${userId}`;
    const fresh = await this.redis.client.set(mirrorKey, '1', 'EX', this.ttlSeconds, 'NX');
    if (fresh) {
      await this.prisma.presenceRecord
        .upsert({
          where: { userId },
          create: {
            userId,
            lastSeenAt: new Date(now),
            lastRoute: route?.slice(0, 120),
            userAgent: userAgent?.slice(0, 255),
          },
          update: {
            lastSeenAt: new Date(now),
            lastRoute: route?.slice(0, 120),
          },
        })
        .catch(() => undefined);
    }
  }

  async goOffline(userId: string): Promise<void> {
    await this.redis.client.zrem(PRESENCE_KEY, userId);
    await this.redis.client.hdel(ROUTE_KEY, userId);
  }

  /** Drops entries older than the TTL and returns the live user ids. */
  private async liveUserIds(): Promise<string[]> {
    const cutoff = Date.now() - this.ttlSeconds * 1000;
    await this.redis.client.zremrangebyscore(PRESENCE_KEY, 0, cutoff);
    return this.redis.client.zrange(PRESENCE_KEY, 0, -1);
  }

  async onlineCount(): Promise<number> {
    return (await this.liveUserIds()).length;
  }

  /** Online totals broken down by grade, for the admin dashboard. */
  async onlineBreakdown() {
    const ids = await this.liveUserIds();
    if (!ids.length) {
      return { total: 0, byGrade: [] as Array<{ gradeLevel: string; count: number }> };
    }

    const rows = await this.prisma.user.groupBy({
      by: ['gradeLevel'],
      where: { id: { in: ids }, gradeLevel: { not: null } },
      _count: true,
    });

    return {
      total: ids.length,
      byGrade: rows.map((row) => ({
        gradeLevel: row.gradeLevel as string,
        count: row._count,
      })),
      definition: `طالب نشط خلال آخر ${this.ttlSeconds} ثانية (تقدير وليس تأكيدًا للمشاهدة الفعلية)`,
    };
  }

  async recentlyActive(limit = 20) {
    const ids = await this.liveUserIds();
    if (!ids.length) return [];

    const routes = await this.redis.client.hgetall(ROUTE_KEY);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids.slice(-limit) } },
      select: { id: true, fullName: true, username: true, gradeLevel: true },
    });

    return users.map((user) => ({ ...user, route: routes[user.id] ?? null }));
  }
}
