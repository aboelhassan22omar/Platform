import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import webpush from 'web-push';
import { Prisma } from '../generated/prisma/client';
import { NativePlatform } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import type { AppConfig } from '../config/configuration';
import { NativePushService, type NativeResult } from './native-push.service';

const KEYS_SETTING = 'push.vapid';
const LOCK = 'lock:push-dispatch';
/** A notification older than this is no longer news: it is not pushed. */
const FRESH_MS = 60 * 60 * 1000;

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Phone notifications: Web Push for the browser and the installed site, and
 * FCM / APNs for the store apps (see NativePushService).
 *
 * Nothing in the platform has to call this to notify: every in-app
 * notification is picked up a few seconds after it is created and pushed to
 * the student's phones. One place, so a new kind of notification is pushed
 * automatically.
 *
 * VAPID keys come from the environment; without them a pair is generated once
 * and kept in site settings, so push works with no setup.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private keys: VapidKeys | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly native: NativePushService,
  ) {}

  async vapidKeys(): Promise<VapidKeys> {
    if (this.keys) return this.keys;
    const env = this.config.get<AppConfig['push']>('push')!;
    if (env.publicKey && env.privateKey) {
      this.keys = { publicKey: env.publicKey, privateKey: env.privateKey };
    } else {
      const row = await this.prisma.siteSetting.findUnique({ where: { key: KEYS_SETTING } });
      let stored = row?.value as unknown as VapidKeys | undefined;
      if (!stored?.publicKey) {
        const generated = webpush.generateVAPIDKeys();
        stored = { publicKey: generated.publicKey, privateKey: generated.privateKey };
        // createMany + skipDuplicates: two instances starting together keep one pair.
        await this.prisma.siteSetting.createMany({
          data: [{ key: KEYS_SETTING, value: stored as unknown as Prisma.InputJsonValue }],
          skipDuplicates: true,
        });
        const saved = await this.prisma.siteSetting.findUniqueOrThrow({
          where: { key: KEYS_SETTING },
        });
        stored = saved.value as unknown as VapidKeys;
      }
      this.keys = stored;
    }
    webpush.setVapidDetails(env.subject, this.keys.publicKey, this.keys.privateKey);
    return this.keys;
  }

  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    const data = {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 255),
      lastUsedAt: new Date(),
    };
    // A shared phone that signs in as another student moves to that student.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { endpoint: subscription.endpoint, ...data },
      update: data,
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { subscribed: false };
  }

  /** The store app on a phone; the same token moves to whoever signs in on it. */
  async subscribeNative(userId: string, platform: NativePlatform, token: string) {
    await this.prisma.nativePushToken.upsert({
      where: { token },
      create: { token, platform, userId },
      update: { userId, platform, lastUsedAt: new Date() },
    });
    return { subscribed: true };
  }

  async unsubscribeNative(userId: string, token: string) {
    await this.prisma.nativePushToken.deleteMany({ where: { userId, token } });
    return { subscribed: false };
  }

  async count(userId: string) {
    const [browsers, apps] = await Promise.all([
      this.prisma.pushSubscription.count({ where: { userId } }),
      this.prisma.nativePushToken.count({ where: { userId } }),
    ]);
    return browsers + apps;
  }

  @Interval('push-dispatch', 10_000)
  async tick(): Promise<void> {
    const locked = await this.redis.client.set(LOCK, '1', 'EX', 60, 'NX').catch(() => null);
    if (locked !== 'OK') return;
    try {
      await this.dispatch();
    } catch (error) {
      this.logger.error(`Push dispatch failed: ${(error as Error).message}`);
    } finally {
      await this.redis.client.del(LOCK).catch(() => undefined);
    }
  }

  /** Sends every fresh, unsent notification to its user's phones. */
  async dispatch(now = new Date()): Promise<number> {
    const freshSince = new Date(now.getTime() - FRESH_MS);
    await this.prisma.notification.updateMany({
      where: { pushedAt: null, createdAt: { lt: freshSince } },
      data: { pushedAt: now },
    });
    const pending = await this.prisma.notification.findMany({
      where: { pushedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, userId: true, title: true, body: true, href: true },
    });
    if (!pending.length) return 0;
    await this.prisma.notification.updateMany({
      where: { id: { in: pending.map((row) => row.id) } },
      data: { pushedAt: now },
    });

    const userIds = [...new Set(pending.map((row) => row.userId))];
    const [subscriptions, apps] = await Promise.all([
      this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
      this.prisma.nativePushToken.findMany({ where: { userId: { in: userIds } } }),
    ]);
    if (!subscriptions.length && !apps.length) return 0;
    if (subscriptions.length) await this.vapidKeys();

    let sent = 0;
    const usedApps: string[] = [];
    for (const notification of pending) {
      const message = {
        title: notification.title,
        body: notification.body,
        url: notification.href ?? '/dashboard/notifications',
        tag: notification.id,
      };
      for (const app of apps.filter((row) => row.userId === notification.userId)) {
        const result: NativeResult =
          app.platform === NativePlatform.IOS
            ? await this.native.sendIos(app.token, message)
            : await this.native.sendAndroid(app.token, message);
        if (result === 'sent') {
          sent += 1;
          usedApps.push(app.id);
        } else if (result === 'gone') {
          await this.prisma.nativePushToken
            .delete({ where: { id: app.id } })
            .catch(() => undefined);
        }
      }
      const targets = subscriptions.filter((row) => row.userId === notification.userId);
      const payload = JSON.stringify(message);
      for (const target of targets) {
        try {
          await webpush.sendNotification(
            { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
            payload,
            { TTL: 6 * 60 * 60, urgency: 'normal' },
          );
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // Gone or unknown: the app was uninstalled or permission withdrawn.
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: target.id } })
              .catch(() => undefined);
          } else {
            this.logger.warn(`Push to ${target.id} failed: ${status ?? (error as Error).message}`);
          }
        }
      }
    }
    if (sent) {
      await this.prisma.pushSubscription.updateMany({
        where: { id: { in: subscriptions.map((row) => row.id) } },
        data: { lastUsedAt: now },
      });
    }
    if (usedApps.length) {
      await this.prisma.nativePushToken.updateMany({
        where: { id: { in: usedApps } },
        data: { lastUsedAt: now },
      });
    }
    return sent;
  }
}
