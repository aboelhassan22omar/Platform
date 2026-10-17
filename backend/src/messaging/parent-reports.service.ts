import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import {
  AssessmentAttemptStatus,
  AssessmentKind,
  EducationSystem,
  GradeLevel,
  MessageKind,
  PublishStatus,
  Role,
  StudentType,
  SubscriptionStatus,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { generateToken } from '../common/utils/reference.util';
import { cairoDayKey, cairoParts, startOfCairoDay } from '../common/utils/cairo-time';
import { OutboxService } from './outbox.service';
import { MessagingSettingsService } from './messaging-settings.service';

/** What the parent's report page shows. Stored as a snapshot per week. */
export interface ParentReportData {
  student: { name: string; grade: string | null };
  period: { from: string; to: string };
  watch: {
    totalSeconds: number;
    previousSeconds: number;
    activeDays: number;
    days: Array<{ date: string; seconds: number }>;
  };
  lessons: { watched: number; completed: string[] };
  exams: Array<{ title: string; kind: AssessmentKind; percentage: number; passed: boolean }>;
  missedHomework: Array<{ title: string; dueAt: string }>;
  lastSeenAt: string | null;
}

const WEEKLY_LOCK = 'lock:weekly-parent-report';

const ar = (n: number) => n.toLocaleString('ar-EG');

/** "٣ ساعات و٢٠ دقيقة", or a plain sentence when nothing was watched. */
export function describeStudyTime(seconds: number): string {
  if (seconds < 60) return 'مذاكرش فيديوهات الأسبوع ده';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  const h = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${ar(hours)} ساعات`;
  const m = minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : `${ar(minutes)} دقيقة`;
  if (!hours) return m;
  return minutes ? `${h} و${m}` : h;
}

const countLessons = (n: number) =>
  n === 0 ? 'مفيش' : n === 1 ? 'حصة واحدة' : n === 2 ? 'حصتين' : `${ar(n)} حصص`;

function describeExams(exams: ParentReportData['exams']): string {
  if (!exams.length) return 'مفيش امتحانات الأسبوع ده';
  const average = Math.round(exams.reduce((sum, exam) => sum + exam.percentage, 0) / exams.length);
  const count =
    exams.length === 1
      ? 'امتحان واحد'
      : exams.length === 2
        ? 'امتحانين'
        : `${ar(exams.length)} امتحانات`;
  return `${count}، متوسط ${ar(average)}٪`;
}

const describeMissed = (n: number) =>
  n === 0 ? 'مفيش، كله اتحل 👏' : n === 1 ? 'واجب واحد' : n === 2 ? 'واجبين' : `${ar(n)} واجبات`;

/**
 * Weekly progress reports for parents: built from what the platform measured
 * (streamed video time, completed lessons, exam attempts, homework), saved as
 * a snapshot behind a secret link, and announced on WhatsApp.
 */
@Injectable()
export class ParentReportsService {
  private readonly logger = new Logger(ParentReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly entitlements: EntitlementsService,
    private readonly outbox: OutboxService,
    private readonly settings: MessagingSettingsService,
    private readonly config: ConfigService,
  ) {}

  /** The 7 Cairo days ending with the day containing `now`. */
  weekWindow(now: Date) {
    return { from: startOfCairoDay(now, -6), to: startOfCairoDay(now, 1) };
  }

  async build(userId: string, from: Date, to: Date): Promise<ParentReportData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        educationSystem: true,
        gradeLevel: true,
        presence: { select: { lastSeenAt: true } },
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('الطالب غير موجود');

    const previousFrom = new Date(from.getTime() - 7 * 86_400_000);
    const [grade, days, previous, completed, watched, attempts, missedHomework] = await Promise.all(
      [
        user.educationSystem && user.gradeLevel
          ? this.prisma.grade.findUnique({
              where: {
                educationSystem_level: {
                  educationSystem: user.educationSystem,
                  level: user.gradeLevel,
                },
              },
              select: { nameAr: true },
            })
          : null,
        this.prisma.studyDay.findMany({
          where: {
            userId,
            day: {
              gte: new Date(`${cairoDayKey(from)}T00:00:00Z`),
              lt: new Date(`${cairoDayKey(to)}T00:00:00Z`),
            },
          },
          select: { day: true, watchedSeconds: true },
        }),
        this.prisma.studyDay.aggregate({
          where: {
            userId,
            day: {
              gte: new Date(`${cairoDayKey(previousFrom)}T00:00:00Z`),
              lt: new Date(`${cairoDayKey(from)}T00:00:00Z`),
            },
          },
          _sum: { watchedSeconds: true },
        }),
        this.prisma.lessonProgress.findMany({
          where: { userId, completedAt: { gte: from, lt: to } },
          orderBy: { completedAt: 'asc' },
          take: 20,
          select: { lesson: { select: { title: true } } },
        }),
        this.prisma.lessonProgress.count({
          where: { userId, lastWatchedAt: { gte: from, lt: to } },
        }),
        this.prisma.assessmentAttempt.findMany({
          where: {
            userId,
            submittedAt: { gte: from, lt: to },
            status: { in: [AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIMED_OUT] },
            // Not graded yet: its percentage would mislead the parent.
            needsGrading: false,
          },
          orderBy: { submittedAt: 'asc' },
          take: 20,
          select: {
            percentage: true,
            passed: true,
            assessment: { select: { title: true, kind: true } },
          },
        }),
        this.missedHomework(userId, user, from, to),
      ],
    );

    const byDay = new Map(
      days.map((row) => [row.day.toISOString().slice(0, 10), row.watchedSeconds]),
    );
    const dayList = Array.from({ length: 7 }, (_, index) => {
      const date = cairoDayKey(startOfCairoDay(from, index));
      return { date, seconds: byDay.get(date) ?? 0 };
    });

    return {
      student: { name: user.fullName, grade: grade?.nameAr ?? null },
      period: { from: from.toISOString(), to: to.toISOString() },
      watch: {
        totalSeconds: dayList.reduce((sum, day) => sum + day.seconds, 0),
        previousSeconds: previous._sum.watchedSeconds ?? 0,
        activeDays: dayList.filter((day) => day.seconds >= 60).length,
        days: dayList,
      },
      lessons: { watched, completed: completed.map((row) => row.lesson.title) },
      exams: attempts.map((attempt) => ({
        title: attempt.assessment.title,
        kind: attempt.assessment.kind,
        percentage: attempt.percentage,
        passed: attempt.passed,
      })),
      missedHomework,
      lastSeenAt: (user.presence?.lastSeenAt ?? user.lastLoginAt)?.toISOString() ?? null,
    };
  }

  /**
   * Homework of the student's grade whose deadline fell in the window, that
   * they could open (free or bought, and the lesson too) and never submitted.
   */
  private async missedHomework(
    userId: string,
    user: { educationSystem: EducationSystem | null; gradeLevel: GradeLevel | null },
    from: Date,
    to: Date,
  ) {
    if (!user.educationSystem || !user.gradeLevel) return [];
    const now = new Date();
    const grade = { educationSystem: user.educationSystem, level: user.gradeLevel };
    const homework = await this.prisma.assessment.findMany({
      where: {
        kind: AssessmentKind.HOMEWORK,
        status: PublishStatus.PUBLISHED,
        dueAt: { gte: from, lt: to.getTime() < now.getTime() ? to : now },
        OR: [
          { lesson: { chapter: { unit: { course: { grade } } } } },
          { unit: { course: { grade } } },
        ],
        attempts: {
          none: {
            userId,
            status: { in: [AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIMED_OUT] },
          },
        },
      },
      orderBy: { dueAt: 'asc' },
      select: {
        id: true,
        title: true,
        dueAt: true,
        isFree: true,
        lessonId: true,
        entitlements: { where: { userId, status: 'ACTIVE' }, select: { id: true }, take: 1 },
      },
    });
    const openable = homework.filter((row) => row.isFree || row.entitlements.length);
    const lessonIds = openable.flatMap((row) => (row.lessonId ? [row.lessonId] : []));
    const accessibleLessons = await this.entitlements.filterAccessibleLessonIds(userId, lessonIds);
    return openable
      .filter((row) => !row.lessonId || accessibleLessons.has(row.lessonId))
      .map((row) => ({ title: row.title, dueAt: row.dueAt!.toISOString() }));
  }

  /** Saves the week's snapshot (one per student per week) and returns it. */
  async snapshot(userId: string, now = new Date()) {
    const { from, to } = this.weekWindow(now);
    const data = await this.build(userId, from, to);
    // Re-running the same week refreshes the numbers but keeps the link.
    const report = await this.prisma.parentReport.upsert({
      where: { userId_weekStart: { userId, weekStart: from } },
      create: {
        userId,
        weekStart: from,
        weekEnd: to,
        token: generateToken(24),
        data: data as unknown as Prisma.InputJsonValue,
      },
      update: { weekEnd: to, data: data as unknown as Prisma.InputJsonValue },
      select: { id: true, token: true, weekStart: true },
    });
    return { ...report, data };
  }

  reportUrl(token: string): string {
    return `${this.config.get<string>('publicSiteUrl')}/reports/${token}`;
  }

  /** Builds this week's report for one student and queues the WhatsApp message. */
  async sendFor(userId: string, opts: { force?: boolean } = {}, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { parentPhone: true, parentReportsEnabled: true },
    });
    if (!user || (!user.parentReportsEnabled && !opts.force)) return { queued: 0, report: null };
    const report = await this.snapshot(userId, now);
    const queued = await this.outbox.enqueue([
      {
        kind: MessageKind.WEEKLY_REPORT,
        userId,
        phone: user.parentPhone,
        params: [
          report.data.student.name,
          describeStudyTime(report.data.watch.totalSeconds),
          countLessons(report.data.lessons.completed.length),
          describeExams(report.data.exams),
          describeMissed(report.data.missedHomework.length),
          this.reportUrl(report.token),
        ],
        // A manual "send now" gets its own key so it is not swallowed by
        // the scheduled one of the same week.
        dedupeKey: opts.force
          ? `weekly:${cairoDayKey(report.weekStart)}:${userId}:manual:${Date.now()}`
          : `weekly:${cairoDayKey(report.weekStart)}:${userId}`,
      },
    ]);
    return { queued, report };
  }

  /** Students whose parents get the weekly report. */
  private async recipients(audience: 'paying' | 'all', cursor: string | undefined, take: number) {
    const now = new Date();
    return this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        parentReportsEnabled: true,
        ...(audience === 'paying'
          ? {
              OR: [
                { studentType: StudentType.CENTER },
                {
                  entitlements: {
                    some: {
                      status: 'ACTIVE',
                      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                    },
                  },
                },
                {
                  subscriptions: {
                    some: { status: SubscriptionStatus.ACTIVE, expiresAt: { gt: now } },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true },
    });
  }

  /**
   * Called every hour; does the work only in the configured weekday and
   * hour (Cairo). Dedupe keys make a second run in the same week a no-op,
   * which is also what lets a run interrupted by a restart finish later.
   */
  async runWeeklyIfDue(now = new Date()): Promise<number> {
    const settings = await this.settings.get();
    if (settings.mode === 'off' || !settings.kinds.WEEKLY_REPORT) return 0;
    const parts = cairoParts(now);
    if (
      parts.weekday !== settings.weeklyReport.weekday ||
      parts.hour < settings.weeklyReport.hour
    ) {
      return 0;
    }
    return this.runWeekly(now);
  }

  async runWeekly(now = new Date()): Promise<number> {
    const settings = await this.settings.get();
    const locked = await this.redis.client
      .set(WEEKLY_LOCK, '1', 'EX', 1800, 'NX')
      .catch(() => null);
    if (locked !== 'OK') return 0;
    let queued = 0;
    try {
      let cursor: string | undefined;
      for (;;) {
        const batch = await this.recipients(settings.weeklyReport.audience, cursor, 100);
        if (!batch.length) break;
        for (const student of batch) {
          try {
            queued += (await this.sendFor(student.id, {}, now)).queued;
          } catch (error) {
            this.logger.error(
              `Weekly report for ${student.id} failed: ${(error as Error).message}`,
            );
          }
        }
        cursor = batch[batch.length - 1].id;
      }
    } finally {
      await this.redis.client.del(WEEKLY_LOCK).catch(() => undefined);
    }
    if (queued) this.logger.log(`Queued ${queued} weekly parent report(s)`);
    return queued;
  }

  /** The parent's view, by secret link. Expires after ~2 months. */
  async byToken(token: string) {
    const report = await this.prisma.parentReport.findUnique({
      where: { token },
      select: { data: true, createdAt: true },
    });
    if (!report || report.createdAt.getTime() < Date.now() - 62 * 86_400_000) {
      throw new NotFoundException('التقرير ده مش موجود أو انتهت صلاحيته');
    }
    return report.data as unknown as ParentReportData;
  }
}
