import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { OrdersService } from '../payments/orders.service';
import { VideosService } from '../videos/videos.service';
import { PrismaService } from './prisma/prisma.service';
import { PublishStatus } from '../generated/prisma/enums';

/**
 * Scheduled housekeeping.
 *
 * None of these jobs are load-bearing for correctness — access checks already
 * treat a past expiry as no access. They keep derived state (status columns,
 * counts shown to the admin) honest and stop unbounded tables growing.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly orders: OrdersService,
    private readonly videos: VideosService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireAccess(): Promise<void> {
    const [entitlements, subscriptions] = await Promise.all([
      this.entitlements.expireLapsed(),
      this.orders.expireLapsedSubscriptions(),
    ]);
    if (entitlements || subscriptions) {
      this.logger.log(
        `Expired ${entitlements} entitlement(s) and ${subscriptions} subscription(s)`,
      );
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async purgeTickets(): Promise<void> {
    const [tickets, uploads] = await Promise.all([
      this.videos.purgeExpiredTickets(),
      this.videos.purgeAbandonedUploads(),
    ]);
    if (tickets) this.logger.debug(`Purged ${tickets} expired playback ticket(s)`);
    if (uploads) this.logger.log(`Purged ${uploads} abandoned video upload(s)`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledContent(): Promise<void> {
    const now = new Date();
    const where = { status: PublishStatus.SCHEDULED, scheduledAt: { lte: now } } as const;
    const [courses, units, chapters, lessons, assessments] = await this.prisma.$transaction([
      this.prisma.course.updateMany({ where, data: { status: PublishStatus.PUBLISHED, publishedAt: now } }),
      this.prisma.unit.updateMany({ where, data: { status: PublishStatus.PUBLISHED } }),
      this.prisma.chapter.updateMany({ where, data: { status: PublishStatus.PUBLISHED } }),
      this.prisma.lesson.updateMany({ where, data: { status: PublishStatus.PUBLISHED, publishedAt: now } }),
      this.prisma.assessment.updateMany({
        where: { status: PublishStatus.SCHEDULED, availableFrom: { lte: now } },
        data: { status: PublishStatus.PUBLISHED },
      }),
    ]);
    const count = courses.count + units.count + chapters.count + lessons.count + assessments.count;
    if (count) this.logger.log(`Published ${count} scheduled content item(s)`);
  }

  /** Revoked and expired refresh tokens are useless after their expiry date. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeTokens(): Promise<void> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } },
    });
    if (count) this.logger.log(`Purged ${count} expired refresh token(s)`);
  }
}
