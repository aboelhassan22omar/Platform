import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { StorageService } from '../common/storage/storage.service';
import { generateToken, hashToken } from '../common/utils';
import { cairoDateOnly } from '../common/utils/cairo-time';
import { EntitlementsService, ACCESS_MESSAGES } from '../entitlements/entitlements.service';
import { AccessSettingsService } from '../settings/access-settings.service';
import { hasPlayableVersion } from './playable';
import { ViewLimitsService } from './view-limits.service';

/** Download tickets carry this prefix; the HLS endpoints refuse them. */
export const OFFLINE_TICKET_PREFIX = 'offline.';
export const OFFLINE_QUEUE = 'video-offline';
/** The packaged MP4 is deleted after this long without a download. */
const UNUSED_FOR_MS = 3 * 86_400_000;
/** Long enough to download an hour-long lesson on a slow connection. */
const TICKET_TTL_MS = 3 * 60 * 60 * 1000;
/** Quality saved on the phone: good on a phone screen, about 650 MB an hour. */
const PREFERRED_QUALITY = ['480p', '360p', '720p', '1080p'];
const LOCK = 'lock:offline-cleanup';

export interface OfflineSyncItem {
  lessonId: string;
  /** Seconds watched offline since the last sync, counted toward the view limit. */
  watchedSeconds: number;
}

/**
 * Lessons saved on a phone by the store apps, to watch with no connection.
 *
 * The video goes to the student's device; the server only packages one MP4
 * per lesson on the first request (a stream copy of the 480p rendition, made
 * by the worker) and deletes it once nobody has downloaded it for a few days.
 * A saved lesson plays offline for `offlineDays`; going online re-checks the
 * student still has access and counts the time watched offline against the
 * lesson's view limit, so a download cannot be used to get around it.
 */
@Injectable()
export class OfflineDownloadsService {
  private readonly logger = new Logger(OfflineDownloadsService.name);
  private readonly queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementsService,
    private readonly viewLimits: ViewLimitsService,
    private readonly access: AccessSettingsService,
    config: ConfigService,
  ) {
    const url = new URL(config.get<string>('redis.url')!);
    this.queue = new Queue(OFFLINE_QUEUE, {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        password: url.password || undefined,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 15_000 },
        removeOnComplete: true,
        removeOnFail: { age: 3600 },
      },
    });
  }

  private async assertDownloadsOn() {
    const settings = await this.access.get();
    if (!settings.offlineDownloads) {
      throw new ForbiddenException({
        message: 'تنزيل الحصص مقفول دلوقتي.',
        code: 'OFFLINE_DISABLED',
      });
    }
    return settings;
  }

  /**
   * Starts (or continues) saving a lesson on the phone. Returns PREPARING
   * while the worker packages it (the app polls), then a short-lived URL the
   * app downloads natively.
   */
  async request(userId: string, lessonId: string, opts: { isStaff: boolean }) {
    const settings = await this.assertDownloadsOn();
    const decision = await this.entitlements.checkLessonAccess(userId, lessonId, opts);
    if (!decision.allowed) throw new ForbiddenException(ACCESS_MESSAGES[decision.reason]);
    if (!opts.isStaff) await this.viewLimits.assertCanStart(userId, lessonId);

    const asset = await this.prisma.videoAsset.findUnique({
      where: { lessonId },
      select: {
        id: true,
        hlsPrefix: true,
        processedAt: true,
        renditions: true,
        durationSeconds: true,
        offlineKey: true,
        offlineSize: true,
        offlineQuality: true,
      },
    });
    if (!asset?.hlsPrefix || !hasPlayableVersion(asset)) {
      throw new NotFoundException('الفيديو لسه بيتجهز، جرّب بعد شوية');
    }

    if (!asset.offlineKey?.startsWith(asset.hlsPrefix)) {
      const quality =
        PREFERRED_QUALITY.find((name) => asset.renditions.includes(name)) ?? asset.renditions[0];
      if (!quality) throw new NotFoundException('الفيديو لسه بيتجهز، جرّب بعد شوية');
      // One job per published version, however many students ask at once.
      const version = createHash('sha1').update(asset.hlsPrefix).digest('hex').slice(0, 12);
      await this.queue.add(
        'prepare',
        { videoAssetId: asset.id, hlsPrefix: asset.hlsPrefix, quality },
        { jobId: `offline-${asset.id}-${version}` },
      );
      return { status: 'PREPARING' as const, retryAfterSeconds: 4 };
    }

    const token = `${OFFLINE_TICKET_PREFIX}${generateToken(32)}`;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.playbackTicket.create({
        data: {
          userId,
          lessonId,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + TICKET_TTL_MS),
        },
      }),
      this.prisma.lessonDownload.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: { userId, lessonId },
        update: { checkedAt: now },
      }),
      this.prisma.videoAsset.update({ where: { id: asset.id }, data: { offlineUsedAt: now } }),
    ]);

    return {
      status: 'READY' as const,
      url: `/api/videos/${encodeURIComponent(lessonId)}/offline/file?ticket=${encodeURIComponent(token)}`,
      sizeBytes: Number(asset.offlineSize ?? 0),
      quality: asset.offlineQuality,
      durationSeconds: asset.durationSeconds ?? 0,
      expiresAt: new Date(now.getTime() + settings.offlineDays * 86_400_000).toISOString(),
    };
  }

  /** The packaged MP4, for a valid download ticket. */
  async file(lessonId: string, token: string) {
    if (!token?.startsWith(OFFLINE_TICKET_PREFIX)) {
      throw new ForbiddenException('رابط التنزيل غير صالح');
    }
    const ticket = await this.prisma.playbackTicket.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { lessonId: true, expiresAt: true },
    });
    if (!ticket || ticket.lessonId !== lessonId || ticket.expiresAt < new Date()) {
      throw new ForbiddenException('رابط التنزيل انتهى، جرّب تنزّل تاني');
    }
    const asset = await this.prisma.videoAsset.findUnique({
      where: { lessonId },
      select: { offlineKey: true, offlineSize: true },
    });
    if (!asset?.offlineKey) throw new NotFoundException('الملف غير موجود');
    const stream = await this.storage.getObjectStream(this.storage.videoBucket, asset.offlineKey);
    return { stream, sizeBytes: Number(asset.offlineSize ?? 0) };
  }

  /**
   * Called by the app when it is online: counts the time watched offline and
   * says, for each saved lesson, whether it may stay on the phone and until
   * when. A lesson the student lost access to is reported so the app deletes it.
   */
  async sync(userId: string, items: OfflineSyncItem[], opts: { isStaff: boolean }) {
    const settings = await this.access.get();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.offlineDays * 86_400_000).toISOString();
    const results: Array<{
      lessonId: string;
      allowed: boolean;
      expiresAt: string | null;
      reason?: string;
    }> = [];

    for (const item of items) {
      const download = await this.prisma.lessonDownload.findUnique({
        where: { userId_lessonId: { userId, lessonId: item.lessonId } },
        select: { id: true },
      });
      if (!download) {
        results.push({
          lessonId: item.lessonId,
          allowed: false,
          expiresAt: null,
          reason: 'UNKNOWN',
        });
        continue;
      }
      if (!opts.isStaff && item.watchedSeconds > 0) {
        await this.chargeOffline(userId, item.lessonId, item.watchedSeconds);
      }
      if (!settings.offlineDownloads) {
        results.push({
          lessonId: item.lessonId,
          allowed: false,
          expiresAt: null,
          reason: 'OFFLINE_DISABLED',
        });
        continue;
      }
      const decision = await this.entitlements.checkLessonAccess(userId, item.lessonId, opts);
      if (!decision.allowed) {
        results.push({
          lessonId: item.lessonId,
          allowed: false,
          expiresAt: null,
          reason: decision.reason,
        });
        continue;
      }
      if (!opts.isStaff) {
        const allowance = await this.viewLimits.allowance(userId, item.lessonId);
        if (allowance.exhausted) {
          results.push({
            lessonId: item.lessonId,
            allowed: false,
            expiresAt: null,
            reason: 'VIEW_LIMIT_REACHED',
          });
          continue;
        }
      }
      await this.prisma.lessonDownload.update({
        where: { id: download.id },
        data: { checkedAt: now },
      });
      results.push({ lessonId: item.lessonId, allowed: true, expiresAt });
    }
    return { offlineDays: settings.offlineDays, items: results };
  }

  /** The app deleted a saved lesson. */
  async forget(userId: string, lessonId: string) {
    await this.prisma.lessonDownload.deleteMany({ where: { userId, lessonId } });
    return { removed: true };
  }

  /** Offline watching counts like streaming: toward the view limit and the parent's report. */
  private async chargeOffline(userId: string, lessonId: string, seconds: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { durationSeconds: true, videoAsset: { select: { durationSeconds: true } } },
    });
    const duration = lesson?.videoAsset?.durationSeconds || lesson?.durationSeconds || 0;
    // A sane ceiling per sync, so a wrong clock cannot wipe out every view at once.
    const charged = Math.min(Math.round(seconds), Math.max(duration, 60) * 3);
    if (charged <= 0) return;
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, viewedSeconds: charged },
      update: { viewedSeconds: { increment: charged } },
    });
    const day = cairoDateOnly(new Date());
    await this.prisma.studyDay.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, watchedSeconds: charged },
      update: { watchedSeconds: { increment: charged } },
    });
  }

  /** Deletes packaged MP4s nobody has downloaded for a few days. */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanup(now = new Date()): Promise<number> {
    const locked = await this.redis.client.set(LOCK, '1', 'EX', 600, 'NX').catch(() => null);
    if (locked !== 'OK') return 0;
    try {
      const stale = await this.prisma.videoAsset.findMany({
        where: {
          offlineKey: { not: null },
          offlineUsedAt: { lt: new Date(now.getTime() - UNUSED_FOR_MS) },
        },
        select: { id: true, offlineKey: true },
        take: 200,
      });
      for (const asset of stale) {
        await this.storage
          .removeObject(this.storage.videoBucket, asset.offlineKey!)
          .catch(() => undefined);
        await this.prisma.videoAsset.updateMany({
          where: { id: asset.id, offlineKey: asset.offlineKey },
          data: { offlineKey: null, offlineSize: null, offlineQuality: null, offlineUsedAt: null },
        });
      }
      if (stale.length) this.logger.log(`Removed ${stale.length} unused offline download file(s)`);
      return stale.length;
    } finally {
      await this.redis.client.del(LOCK).catch(() => undefined);
    }
  }
}
