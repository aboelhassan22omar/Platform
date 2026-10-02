import { Injectable } from '@nestjs/common';
import {
  EntitlementStatus,
  OrderStatus,
  PublishStatus,
  Role,
  SubscriptionStatus,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Business reporting for the admin dashboard.
 *
 * Every number here is computed from live tables. Revenue counts only orders
 * that actually reached PAID — nothing is estimated, projected or padded.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  /** KPI cards on the dashboard landing screen. */
  async overview() {
    const now = new Date();

    const [
      totalStudents,
      activeStudents,
      suspendedStudents,
      bySystem,
      byGrade,
      activeSubscriptions,
      activeEntitlements,
      totalLessons,
      publishedLessons,
      publishedCourses,
      paidOrders,
      revenue,
      online,
      newThisWeek,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.user.count({ where: { role: Role.STUDENT, status: UserStatus.ACTIVE } }),
      this.prisma.user.count({
        where: { role: Role.STUDENT, status: UserStatus.SUSPENDED },
      }),
      this.prisma.user.groupBy({
        by: ['educationSystem'],
        where: { role: Role.STUDENT, educationSystem: { not: null } },
        _count: true,
      }),
      this.prisma.user.groupBy({
        by: ['gradeLevel'],
        where: { role: Role.STUDENT, gradeLevel: { not: null } },
        _count: true,
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, expiresAt: { gt: now } },
      }),
      this.prisma.entitlement.count({
        where: {
          status: EntitlementStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.lesson.count(),
      this.prisma.lesson.count({ where: { status: PublishStatus.PUBLISHED } }),
      this.prisma.course.count({ where: { status: PublishStatus.PUBLISHED } }),
      this.prisma.order.count({ where: { status: OrderStatus.PAID } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID },
        _sum: { totalMinor: true },
      }),
      this.presence.onlineBreakdown(),
      this.prisma.user.count({
        where: {
          role: Role.STUDENT,
          createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
      }),
    ]);

    return {
      students: {
        total: totalStudents,
        active: activeStudents,
        suspended: suspendedStudents,
        newThisWeek,
        bySystem: bySystem.map((row) => ({
          educationSystem: row.educationSystem,
          count: row._count,
        })),
        byGrade: this.normaliseGradeCounts(byGrade),
      },
      online,
      content: {
        totalLessons,
        publishedLessons,
        publishedCourses,
      },
      commerce: {
        paidOrders,
        // Minor units (piastres). The UI divides by 100 for display.
        revenueMinor: revenue._sum.totalMinor ?? 0,
        activeSubscriptions,
        activeEntitlements,
      },
    };
  }

  /**
   * Always returns all five grades, including those with zero students, so
   * the distribution chart keeps a stable shape.
   */
  private normaliseGradeCounts(rows: Array<{ gradeLevel: string | null; _count: number }>) {
    const labels: Record<string, string> = {
      SEC_1: 'أولى ثانوي',
      SEC_2: 'تانية ثانوي',
      SEC_3: 'تالتة ثانوي',
      BACC_1: 'أولى بكالوريا',
      BACC_2: 'تانية بكالوريا',
    };

    const counts = new Map(rows.map((row) => [row.gradeLevel, row._count]));
    return Object.entries(labels).map(([level, nameAr]) => ({
      gradeLevel: level,
      nameAr,
      count: counts.get(level) ?? 0,
    }));
  }

  /** Registrations per day, for the growth chart. */
  async registrationsOverTime(range: DateRange) {
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM "users"
      WHERE "role" = 'STUDENT'
        AND "createdAt" >= ${range.from}
        AND "createdAt" < ${range.to}
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((row) => ({ date: row.day, count: Number(row.count) }));
  }

  /** Paid orders and revenue per day. */
  async salesOverTime(range: DateRange) {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; orders: bigint; revenue: bigint }>
    >`
      SELECT date_trunc('day', "paidAt") AS day,
             COUNT(*)::bigint AS orders,
             COALESCE(SUM("totalMinor"), 0)::bigint AS revenue
      FROM "orders"
      WHERE "status" = 'PAID'
        AND "paidAt" >= ${range.from}
        AND "paidAt" < ${range.to}
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((row) => ({
      date: row.day,
      orders: Number(row.orders),
      revenueMinor: Number(row.revenue),
    }));
  }

  /** Best-selling courses, ranked by paid order lines. */
  async popularCourses(limit = 8) {
    const rows = await this.prisma.$queryRaw<
      Array<{ courseId: string; title: string; sales: bigint; revenue: bigint }>
    >`
      SELECT c."id" AS "courseId",
             c."title" AS title,
             COUNT(oi."id")::bigint AS sales,
             COALESCE(SUM(oi."totalMinor"), 0)::bigint AS revenue
      FROM "order_items" oi
      JOIN "orders" o    ON o."id" = oi."orderId" AND o."status" = 'PAID'
      JOIN "products" p  ON p."id" = oi."productId"
      LEFT JOIN "lessons" l  ON l."id" = p."lessonId"
      LEFT JOIN "chapters" ch ON ch."id" = COALESCE(p."chapterId", l."chapterId")
      LEFT JOIN "units" u     ON u."id" = ch."unitId"
      JOIN "courses" c   ON c."id" = COALESCE(p."courseId", u."courseId")
      GROUP BY c."id", c."title"
      ORDER BY sales DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      courseId: row.courseId,
      title: row.title,
      sales: Number(row.sales),
      revenueMinor: Number(row.revenue),
    }));
  }

  /**
   * Lesson engagement.
   *
   * `completionRate` is measured only over students who actually started the
   * lesson — it is not a share of everyone entitled to it, which would be a
   * different and much less useful number.
   */
  async lessonEngagement(limit = 15) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        lessonId: string;
        title: string;
        starters: bigint;
        finishers: bigint;
        avgPercent: number | null;
      }>
    >`
      SELECT l."id" AS "lessonId",
             l."title" AS title,
             COUNT(lp."id")::bigint AS starters,
             COUNT(lp."id") FILTER (WHERE lp."completed")::bigint AS finishers,
             AVG(lp."percent")::float AS "avgPercent"
      FROM "lessons" l
      JOIN "lesson_progress" lp ON lp."lessonId" = l."id"
      GROUP BY l."id", l."title"
      HAVING COUNT(lp."id") > 0
      ORDER BY starters DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      lessonId: row.lessonId,
      title: row.title,
      starters: Number(row.starters),
      finishers: Number(row.finishers),
      completionRate:
        Number(row.starters) > 0
          ? Math.round((Number(row.finishers) / Number(row.starters)) * 100)
          : 0,
      averagePercent: Math.round(row.avgPercent ?? 0),
    }));
  }

  async recentOrders(limit = 10) {
    return this.prisma.order.findMany({
      where: { status: OrderStatus.PAID },
      orderBy: { paidAt: 'desc' },
      take: limit,
      select: {
        id: true,
        reference: true,
        totalMinor: true,
        paidAt: true,
        user: { select: { id: true, fullName: true, gradeLevel: true } },
        items: { select: { titleSnapshot: true, kindSnapshot: true } },
      },
    });
  }
}
