import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AssessmentAttemptStatus,
  AssessmentKind,
  EducationSystem,
  GradeLevel,
  LiveSessionStatus,
  MessageKind,
  PublishStatus,
  Role,
  SubscriptionStatus,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { formatCairoDateTime, formatCairoDay, formatCairoTime } from '../common/utils/cairo-time';
import { OutboxService } from './outbox.service';
import { ParentReportsService } from './parent-reports.service';

/**
 * Turns platform events into WhatsApp messages. Each job is safe to run on
 * several API instances and to repeat: the "already done" marker (announcedAt,
 * reminderSentAt) is claimed with a conditional update, and every message has
 * a dedupe key.
 */
@Injectable()
export class MessageProducersService {
  private readonly logger = new Logger(MessageProducersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly reports: ParentReportsService,
    private readonly entitlements: EntitlementsService,
    private readonly config: ConfigService,
  ) {}

  private get site(): string {
    return this.config.get<string>('publicSiteUrl')!;
  }

  private gradeStudents(educationSystem: EducationSystem, level: GradeLevel) {
    return this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        educationSystem,
        gradeLevel: level,
      },
      select: { id: true, phone: true },
    });
  }

  private async run(name: string, job: () => Promise<number>) {
    try {
      const queued = await job();
      if (queued) this.logger.log(`${name}: queued ${queued} message(s)`);
    } catch (error) {
      this.logger.error(`${name} failed: ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async everyFiveMinutes(): Promise<void> {
    await this.run('new lessons', () => this.announceNewLessons());
    await this.run('live reminders', () => this.remindLives());
  }

  @Cron(CronExpression.EVERY_HOUR)
  async hourly(): Promise<void> {
    await this.run('homework due', () => this.remindHomework());
    await this.run('subscriptions expiring', () => this.remindExpiringSubscriptions());
    await this.run('weekly parent reports', () => this.reports.runWeeklyIfDue());
  }

  /** A lesson is announced once it is published, its course is out and its video plays. */
  async announceNewLessons(now = new Date()): Promise<number> {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        status: PublishStatus.PUBLISHED,
        // Not publishedAt: a lesson created as published never gets one.
        announcedAt: null,
        chapter: { unit: { course: { status: PublishStatus.PUBLISHED } } },
        videoAsset: { processedAt: { not: null }, hlsPrefix: { not: null } },
      },
      take: 20,
      select: {
        id: true,
        title: true,
        chapter: {
          select: {
            unit: {
              select: {
                course: {
                  select: {
                    title: true,
                    grade: { select: { educationSystem: true, level: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    let queued = 0;
    for (const lesson of lessons) {
      const claimed = await this.prisma.lesson.updateMany({
        where: { id: lesson.id, announcedAt: null },
        data: { announcedAt: now },
      });
      if (!claimed.count) continue;
      const course = lesson.chapter.unit.course;
      const students = await this.gradeStudents(course.grade.educationSystem, course.grade.level);
      queued += await this.outbox.enqueue(
        students.map((student) => ({
          kind: MessageKind.NEW_LESSON,
          userId: student.id,
          phone: student.phone,
          params: [lesson.title, course.title, `${this.site}/lessons/${lesson.id}`],
          dedupeKey: `lesson:${lesson.id}:${student.id}`,
        })),
      );
    }
    return queued;
  }

  /** Lives starting within the hour, reminded once. */
  async remindLives(now = new Date()): Promise<number> {
    const sessions = await this.prisma.liveSession.findMany({
      where: {
        status: LiveSessionStatus.SCHEDULED,
        reminderSentAt: null,
        scheduledAt: { gt: now, lte: new Date(now.getTime() + 61 * 60_000) },
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        grade: { select: { educationSystem: true, level: true } },
      },
    });

    let queued = 0;
    for (const session of sessions) {
      const claimed = await this.prisma.liveSession.updateMany({
        where: { id: session.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (!claimed.count) continue;
      const students = await this.gradeStudents(session.grade.educationSystem, session.grade.level);
      queued += await this.outbox.enqueue(
        students.map((student) => ({
          kind: MessageKind.LIVE_REMINDER,
          userId: student.id,
          phone: student.phone,
          params: [
            session.title,
            formatCairoTime(session.scheduledAt),
            `${this.site}/live/${session.id}`,
          ],
          dedupeKey: `live:${session.id}:${student.id}`,
          expiresAt: session.scheduledAt,
        })),
      );
    }
    return queued;
  }

  /** Homework due within a day, for students who can open it and have not handed it in. */
  async remindHomework(now = new Date()): Promise<number> {
    const homework = await this.prisma.assessment.findMany({
      where: {
        kind: AssessmentKind.HOMEWORK,
        status: PublishStatus.PUBLISHED,
        dueAt: { gt: now, lte: new Date(now.getTime() + 24 * 3_600_000) },
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        isFree: true,
        lessonId: true,
        lesson: {
          select: {
            chapter: {
              select: {
                unit: {
                  select: {
                    course: {
                      select: { grade: { select: { educationSystem: true, level: true } } },
                    },
                  },
                },
              },
            },
          },
        },
        unit: {
          select: {
            course: { select: { grade: { select: { educationSystem: true, level: true } } } },
          },
        },
      },
    });

    let queued = 0;
    for (const item of homework) {
      const grade = item.lesson?.chapter.unit.course.grade ?? item.unit?.course.grade;
      if (!grade) continue;
      const [students, submitted, owners] = await Promise.all([
        this.gradeStudents(grade.educationSystem, grade.level),
        this.prisma.assessmentAttempt.findMany({
          where: {
            assessmentId: item.id,
            status: { in: [AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIMED_OUT] },
          },
          select: { userId: true },
          distinct: ['userId'],
        }),
        item.isFree
          ? Promise.resolve(null)
          : this.prisma.entitlement.findMany({
              where: { assessmentId: item.id, status: 'ACTIVE' },
              select: { userId: true },
            }),
      ]);
      const done = new Set(submitted.map((row) => row.userId));
      const allowed = owners ? new Set(owners.map((row) => row.userId)) : null;

      const recipients = [];
      for (const student of students) {
        if (done.has(student.id) || (allowed && !allowed.has(student.id))) continue;
        if (item.lessonId) {
          const open = await this.entitlements.filterAccessibleLessonIds(student.id, [
            item.lessonId,
          ]);
          if (!open.size) continue;
        }
        recipients.push(student);
      }
      queued += await this.outbox.enqueue(
        recipients.map((student) => ({
          kind: MessageKind.HOMEWORK_DUE,
          userId: student.id,
          phone: student.phone,
          params: [
            item.title,
            formatCairoDateTime(item.dueAt!),
            `${this.site}/dashboard/assessments/${item.id}`,
          ],
          dedupeKey: `homework:${item.id}:${student.id}`,
          expiresAt: item.dueAt!,
        })),
      );
    }
    return queued;
  }

  /** Active subscriptions ending within three days. */
  async remindExpiringSubscriptions(now = new Date()): Promise<number> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: now, lte: new Date(now.getTime() + 3 * 86_400_000) },
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        expiresAt: true,
        user: { select: { id: true, phone: true } },
        plan: { select: { title: true, grade: { select: { slug: true } } } },
      },
    });
    return this.outbox.enqueue(
      subscriptions.map((subscription) => ({
        kind: MessageKind.SUBSCRIPTION_EXPIRING,
        userId: subscription.user.id,
        phone: subscription.user.phone,
        params: [
          subscription.plan.title,
          formatCairoDay(subscription.expiresAt),
          `${this.site}/grades/${subscription.plan.grade.slug}`,
        ],
        dedupeKey: `subscription:${subscription.id}:expiring`,
        expiresAt: subscription.expiresAt,
      })),
    );
  }

  /** Tells the student their transfer was approved. */
  async paymentConfirmed(order: {
    id: string;
    reference: string;
    userId: string;
    purpose: 'PURCHASE' | 'WALLET_TOPUP';
  }): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { phone: true },
    });
    if (!user) return 0;
    const topUp = order.purpose === 'WALLET_TOPUP';
    return this.outbox.enqueue([
      {
        kind: MessageKind.PAYMENT_CONFIRMED,
        userId: order.userId,
        phone: user.phone,
        params: [
          order.reference,
          topUp ? 'الرصيد اتضاف لمحفظتك' : 'المحتوى اتفتح لك',
          `${this.site}${topUp ? '/dashboard/wallet' : '/dashboard/lessons'}`,
        ],
        dedupeKey: `payment:${order.id}`,
      },
    ]);
  }
}
