import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AccessSettingsService } from '../settings/access-settings.service';
import { cairoDateOnly } from '../common/utils/cairo-time';

/** A segment fetched again within this window is not charged a second time. */
const REWATCH_AFTER_MS = 15 * 60 * 1000;
const SEEN_TTL_SECONDS = 24 * 60 * 60;

/**
 * Marks a segment as streamed. Returns 1 when it should be charged: never
 * streamed before, or long enough ago that fetching it again is a rewatch
 * rather than a quality switch, a seek back, or a page refresh.
 */
const MARK_SEEN = `
local last = redis.call('HGET', KEYS[1], ARGV[1])
local now = tonumber(ARGV[2])
if last and now - tonumber(last) < tonumber(ARGV[3]) then return 0 end
redis.call('HSET', KEYS[1], ARGV[1], now)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
return 1
`;

export const VIEW_LIMIT_MESSAGE =
  'خلصت مرات المشاهدة المتاحة للحصة دي. لو محتاج تشوفها تاني كلّم الدعم يزوّدولك مشاهدة.';

export interface ViewAllowance {
  /** False when no limit applies (unlimited, or the video length is unknown). */
  limited: boolean;
  /** Views the lesson allows (platform default or the lesson's own number). */
  maxViews: number;
  /** Extra views staff granted this student. */
  bonusViews: number;
  durationSeconds: number;
  viewedSeconds: number;
  /** Streamed time still allowed; 0 when exhausted, null when unlimited. */
  remainingSeconds: number | null;
  /** Rounded to one decimal, for display. */
  viewsUsed: number;
  remainingViews: number | null;
  exhausted: boolean;
}

/**
 * How many times a student may watch a lesson.
 *
 * Counted on the server from the HLS segments actually streamed, never from
 * what the player reports: one view is the video's length in streamed time.
 * Skipping ahead costs nothing, a refresh or a quality switch is not charged
 * twice, and watching again from the start uses up a view. Staff tickets are
 * never counted.
 */
@Injectable()
export class ViewLimitsService {
  private readonly logger = new Logger(ViewLimitsService.name);
  private readonly segmentSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly access: AccessSettingsService,
    config: ConfigService,
  ) {
    this.segmentSeconds = config.get<number>('streaming.segmentSeconds') ?? 6;
  }

  async allowance(userId: string, lessonId: string): Promise<ViewAllowance> {
    const [lesson, progress, settings] = await Promise.all([
      this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: {
          maxViews: true,
          durationSeconds: true,
          videoAsset: { select: { durationSeconds: true } },
        },
      }),
      this.prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
        select: { viewedSeconds: true, bonusViews: true },
      }),
      this.access.get(),
    ]);
    if (!lesson) throw new NotFoundException('الحصة غير موجودة');
    return this.compute({
      maxViews: lesson.maxViews ?? settings.defaultMaxViews,
      durationSeconds: lesson.videoAsset?.durationSeconds || lesson.durationSeconds,
      viewedSeconds: progress?.viewedSeconds ?? 0,
      bonusViews: progress?.bonusViews ?? 0,
    });
  }

  compute(input: {
    maxViews: number;
    durationSeconds: number;
    viewedSeconds: number;
    bonusViews: number;
  }): ViewAllowance {
    const { maxViews, durationSeconds, viewedSeconds, bonusViews } = input;
    const viewsUsed = durationSeconds ? Math.round((viewedSeconds / durationSeconds) * 10) / 10 : 0;
    if (!maxViews || !durationSeconds) {
      return {
        limited: false,
        maxViews,
        bonusViews,
        durationSeconds,
        viewedSeconds,
        remainingSeconds: null,
        viewsUsed,
        remainingViews: null,
        exhausted: false,
      };
    }
    const allowedSeconds = (maxViews + bonusViews) * durationSeconds;
    const remainingSeconds = Math.max(0, allowedSeconds - viewedSeconds);
    return {
      limited: true,
      maxViews,
      bonusViews,
      durationSeconds,
      viewedSeconds,
      remainingSeconds,
      viewsUsed,
      remainingViews: Math.floor((remainingSeconds / durationSeconds) * 10) / 10,
      exhausted: remainingSeconds <= 0,
    };
  }

  /** Refuses a new playback ticket once the lesson's views are used up. */
  async assertCanStart(userId: string, lessonId: string): Promise<ViewAllowance> {
    const allowance = await this.allowance(userId, lessonId);
    if (allowance.exhausted) {
      throw new ForbiddenException({ message: VIEW_LIMIT_MESSAGE, code: 'VIEW_LIMIT_REACHED' });
    }
    return allowance;
  }

  /**
   * Charges one streamed segment to the student. Throws once the allowance is
   * spent, which stops playback at the next segment. If Redis is unreachable
   * the segment is served uncharged: blocking lessons is worse than missing a
   * few seconds of accounting.
   */
  async chargeSegment(ticket: { userId: string; lessonId: string }, relativePath: string) {
    const match = /seg_(\d+)\.ts$/.exec(relativePath);
    if (!match) return;

    let charge: boolean;
    try {
      charge =
        (await this.redis.client.eval(
          MARK_SEEN,
          1,
          `views:seen:${ticket.userId}:${ticket.lessonId}`,
          match[1],
          Date.now(),
          REWATCH_AFTER_MS,
          SEEN_TTL_SECONDS,
        )) === 1;
    } catch (error) {
      this.logger.error(`View accounting skipped: ${(error as Error).message}`);
      return;
    }
    if (!charge) return;

    const allowance = await this.allowance(ticket.userId, ticket.lessonId);
    if (allowance.exhausted) {
      throw new ForbiddenException({ message: VIEW_LIMIT_MESSAGE, code: 'VIEW_LIMIT_REACHED' });
    }
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: ticket.userId, lessonId: ticket.lessonId } },
      create: {
        userId: ticket.userId,
        lessonId: ticket.lessonId,
        viewedSeconds: this.segmentSeconds,
      },
      update: { viewedSeconds: { increment: this.segmentSeconds } },
    });
    // Daily totals feed the parent's weekly report.
    const day = cairoDateOnly(new Date());
    await this.prisma.studyDay.upsert({
      where: { userId_day: { userId: ticket.userId, day } },
      create: { userId: ticket.userId, day, watchedSeconds: this.segmentSeconds },
      update: { watchedSeconds: { increment: this.segmentSeconds } },
    });
  }

  /** Staff give a student extra views of one lesson. */
  async grantBonus(userId: string, lessonId: string, views: number) {
    const row = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, bonusViews: views },
      update: { bonusViews: { increment: views } },
      select: { bonusViews: true },
    });
    return row.bonusViews;
  }

  /** Every lesson the student has streamed, with what is left of each. */
  async usageForStudent(userId: string) {
    const [rows, settings] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId, OR: [{ viewedSeconds: { gt: 0 } }, { bonusViews: { gt: 0 } }] },
        orderBy: { lastWatchedAt: 'desc' },
        take: 200,
        select: {
          lessonId: true,
          viewedSeconds: true,
          bonusViews: true,
          lastWatchedAt: true,
          lesson: {
            select: {
              title: true,
              maxViews: true,
              durationSeconds: true,
              videoAsset: { select: { durationSeconds: true } },
            },
          },
        },
      }),
      this.access.get(),
    ]);
    return rows.map((row) => ({
      lessonId: row.lessonId,
      title: row.lesson.title,
      lastWatchedAt: row.lastWatchedAt,
      ...this.compute({
        maxViews: row.lesson.maxViews ?? settings.defaultMaxViews,
        durationSeconds: row.lesson.videoAsset?.durationSeconds || row.lesson.durationSeconds,
        viewedSeconds: row.viewedSeconds,
        bonusViews: row.bonusViews,
      }),
    }));
  }
}
