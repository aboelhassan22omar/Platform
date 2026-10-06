import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  EntitlementScope,
  EntitlementSource,
  EntitlementStatus,
  ProductKind,
  PublishStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { isLessonFreeFor } from '../common/utils/lesson-pricing';

/** Why a student can (or cannot) watch a given lesson. */
export type AccessReason =
  | 'FREE_PREVIEW'
  | 'LESSON_PURCHASE'
  | 'CHAPTER_BUNDLE'
  | 'COURSE_PURCHASE'
  | 'SUBSCRIPTION'
  | 'STAFF'
  | 'WRONG_GRADE'
  | 'NOT_PUBLISHED'
  | 'NO_ENTITLEMENT'
  | 'EXPIRED';

export interface AccessDecision {
  allowed: boolean;
  reason: AccessReason;
  /** The entitlement that granted access, when there was one. */
  entitlementId?: string;
  expiresAt?: Date | null;
}

/** Arabic explanation shown to the student for each outcome. */
export const ACCESS_MESSAGES: Record<AccessReason, string> = {
  FREE_PREVIEW: 'الحصة دي متاحة مجاناً',
  LESSON_PURCHASE: 'إنت مشتري الحصة دي',
  CHAPTER_BUNDLE: 'الحصة دي ضمن باقة الفصل اللي مشتريها',
  COURSE_PURCHASE: 'الحصة دي ضمن الكورس اللي مشتريه',
  SUBSCRIPTION: 'الحصة دي ضمن اشتراكك',
  STAFF: 'وصول إداري',
  WRONG_GRADE: 'الحصة دي مش متاحة لصفك الدراسي',
  NOT_PUBLISHED: 'الحصة دي لسه مش منشورة',
  NO_ENTITLEMENT: 'لازم تشتري الحصة أو تشترك عشان تتفرج',
  EXPIRED: 'انتهت صلاحية اشتراكك، جدّده عشان تكمل',
};

type Tx = Prisma.TransactionClient | PrismaService;

/**
 * The single authority on "can this student watch this lesson".
 *
 * Nothing in the frontend grants access. Every playback request, every
 * "my lessons" listing and every progress write funnels through here.
 *
 * Access is granted by any ONE of:
 *   - the lesson is marked as a free preview
 *   - an ACTIVE, unexpired LESSON entitlement for that lesson
 *   - an ACTIVE, unexpired CHAPTER entitlement for its chapter
 *   - an ACTIVE, unexpired COURSE entitlement for its course
 *   - an ACTIVE, unexpired GRADE_MONTHLY / GRADE_YEARLY entitlement covering
 *     the grade+year the lesson's course belongs to
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // Access checks
  // --------------------------------------------------------------------------

  /**
   * Authoritative per-lesson check. Staff bypass entitlements so the admin can
   * preview content, and that bypass is reported honestly in the reason.
   */
  async checkLessonAccess(
    userId: string,
    lessonId: string,
    opts: { isStaff?: boolean } = {},
  ): Promise<AccessDecision> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        status: true,
        isFreePreview: true,
        centerPriceMinor: true,
        chapterId: true,
        chapter: {
          select: {
            unit: {
              select: {
                course: {
                  select: {
                    id: true,
                    gradeId: true,
                    academicYearId: true,
                    status: true,
                    grade: { select: { educationSystem: true, level: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) return { allowed: false, reason: 'NOT_PUBLISHED' };

    if (opts.isStaff) return { allowed: true, reason: 'STAFF' };

    const course = lesson.chapter.unit.course;
    const published =
      lesson.status === PublishStatus.PUBLISHED && course.status === PublishStatus.PUBLISHED;

    if (!published) return { allowed: false, reason: 'NOT_PUBLISHED' };

    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { educationSystem: true, gradeLevel: true, studentType: true },
    });
    if (
      !student ||
      student.educationSystem !== course.grade.educationSystem ||
      student.gradeLevel !== course.grade.level
    ) {
      return { allowed: false, reason: 'WRONG_GRADE' };
    }
    if (isLessonFreeFor(lesson, student.studentType))
      return { allowed: true, reason: 'FREE_PREVIEW' };

    const now = new Date();

    // One query covers all four granting scopes.
    //
    // The two OR groups MUST be combined under AND. Putting both at the top
    // level would leave the second silently overwriting the first — which
    // would drop the expiry check and let a lapsed subscription keep working.
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        AND: [
          // Still within its access window.
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          // Covers this lesson, one way or another.
          {
            OR: [
              { scope: EntitlementScope.LESSON, lessonId: lesson.id },
              { scope: EntitlementScope.CHAPTER, chapterId: lesson.chapterId },
              { scope: EntitlementScope.COURSE, courseId: course.id },
              {
                scope: {
                  in: [EntitlementScope.GRADE_MONTHLY, EntitlementScope.GRADE_YEARLY],
                },
                gradeId: course.gradeId,
                academicYearId: course.academicYearId,
              },
            ],
          },
        ],
      },
      select: { id: true, scope: true, expiresAt: true },
      // Prefer perpetual grants so the reported expiry is the most generous one.
      orderBy: [{ expiresAt: { sort: 'desc', nulls: 'first' } }],
    });

    if (entitlement) {
      const reason: AccessReason =
        entitlement.scope === EntitlementScope.LESSON
          ? 'LESSON_PURCHASE'
          : entitlement.scope === EntitlementScope.CHAPTER
            ? 'CHAPTER_BUNDLE'
            : entitlement.scope === EntitlementScope.COURSE
              ? 'COURSE_PURCHASE'
              : 'SUBSCRIPTION';

      return {
        allowed: true,
        reason,
        entitlementId: entitlement.id,
        expiresAt: entitlement.expiresAt,
      };
    }

    // Distinguish "never had it" from "had it and it lapsed" — the student sees
    // a renew prompt rather than a buy prompt.
    const lapsed = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        AND: [
          {
            OR: [
              { lessonId: lesson.id },
              { chapterId: lesson.chapterId },
              { courseId: course.id },
              { gradeId: course.gradeId, academicYearId: course.academicYearId },
            ],
          },
          {
            OR: [{ status: EntitlementStatus.EXPIRED }, { expiresAt: { lte: now } }],
          },
        ],
      },
      select: { id: true },
    });

    return { allowed: false, reason: lapsed ? 'EXPIRED' : 'NO_ENTITLEMENT' };
  }

  /**
   * Bulk variant for lesson lists. Runs two queries regardless of list size,
   * instead of one per lesson.
   */
  async filterAccessibleLessonIds(
    userId: string,
    lessonIds: string[],
    opts: { isStaff?: boolean } = {},
  ): Promise<Set<string>> {
    if (!lessonIds.length) return new Set();

    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: {
        id: true,
        isFreePreview: true,
        centerPriceMinor: true,
        status: true,
        chapterId: true,
        chapter: {
          select: {
            unit: {
              select: {
                course: {
                  select: {
                    id: true,
                    gradeId: true,
                    academicYearId: true,
                    grade: { select: { educationSystem: true, level: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (opts.isStaff) return new Set(lessons.map((l) => l.id));

    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { educationSystem: true, gradeLevel: true, studentType: true },
    });
    if (!student?.educationSystem || !student.gradeLevel) return new Set();

    const now = new Date();
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        userId,
        status: EntitlementStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        scope: true,
        lessonId: true,
        chapterId: true,
        courseId: true,
        gradeId: true,
        academicYearId: true,
      },
    });

    const ownedLessons = new Set(entitlements.map((e) => e.lessonId).filter(Boolean));
    const ownedChapters = new Set(entitlements.map((e) => e.chapterId).filter(Boolean));
    const ownedCourses = new Set(entitlements.map((e) => e.courseId).filter(Boolean));
    const ownedGrades = new Set(
      entitlements
        .filter((e) => e.gradeId && e.academicYearId)
        .map((e) => `${e.gradeId}:${e.academicYearId}`),
    );

    const accessible = new Set<string>();
    for (const lesson of lessons) {
      const course = lesson.chapter.unit.course;
      const isStudentGrade =
        course.grade.educationSystem === student.educationSystem &&
        course.grade.level === student.gradeLevel;
      const viaGrade = ownedGrades.has(`${course.gradeId}:${course.academicYearId}`);
      if (
        isStudentGrade &&
        (isLessonFreeFor(lesson, student.studentType) ||
          ownedLessons.has(lesson.id) ||
          ownedChapters.has(lesson.chapterId) ||
          ownedCourses.has(course.id) ||
          viaGrade)
      ) {
        accessible.add(lesson.id);
      }
    }

    return accessible;
  }

  // --------------------------------------------------------------------------
  // Granting
  // --------------------------------------------------------------------------

  /**
   * Grants the entitlement a product implies.
   *
   * Idempotent by construction, in two layers:
   *   1. it looks for an existing live entitlement for the same target and
   *      extends it rather than inserting a second one;
   *   2. the partial unique indexes added in the init migration reject a
   *      duplicate insert even if two webhooks race past step 1.
   *
   * Must be called inside the same transaction that marks the order paid, so
   * an order can never be PAID without its entitlements existing.
   */
  async grantForProduct(
    tx: Tx,
    params: {
      userId: string;
      product: {
        kind: ProductKind;
        lessonId: string | null;
        chapterId: string | null;
        courseId: string | null;
        planId: string | null;
        assessmentId?: string | null;
      };
      orderId?: string;
      source?: EntitlementSource;
      grantedById?: string;
    },
  ): Promise<{ entitlementId: string; created: boolean }> {
    const { userId, product, orderId } = params;
    const source = params.source ?? EntitlementSource.PURCHASE;

    // --- Perpetual, target-scoped grants ------------------------------------
    if (product.kind === ProductKind.LESSON && product.lessonId) {
      return this.upsertPerpetual(tx, {
        userId,
        scope: EntitlementScope.LESSON,
        where: { lessonId: product.lessonId },
        orderId,
        source,
        grantedById: params.grantedById,
      });
    }

    if (product.kind === ProductKind.CHAPTER_BUNDLE && product.chapterId) {
      return this.upsertPerpetual(tx, {
        userId,
        scope: EntitlementScope.CHAPTER,
        where: { chapterId: product.chapterId },
        orderId,
        source,
        grantedById: params.grantedById,
      });
    }

    if (product.kind === ProductKind.COURSE && product.courseId) {
      return this.upsertPerpetual(tx, {
        userId,
        scope: EntitlementScope.COURSE,
        where: { courseId: product.courseId },
        orderId,
        source,
        grantedById: params.grantedById,
      });
    }

    if (product.kind === ProductKind.ASSESSMENT && product.assessmentId) {
      return this.upsertPerpetual(tx, {
        userId,
        scope: EntitlementScope.ASSESSMENT,
        where: { assessmentId: product.assessmentId },
        orderId,
        source,
        grantedById: params.grantedById,
      });
    }

    // --- Time-boxed, grade-wide grants (subscriptions) ----------------------
    if (
      (product.kind === ProductKind.MONTHLY_PLAN || product.kind === ProductKind.YEARLY_PLAN) &&
      product.planId
    ) {
      const plan = await tx.plan.findUniqueOrThrow({
        where: { id: product.planId },
        select: {
          id: true,
          gradeId: true,
          academicYearId: true,
          durationDays: true,
          accessUntil: true,
          kind: true,
        },
      });

      const scope =
        plan.kind === ProductKind.YEARLY_PLAN
          ? EntitlementScope.GRADE_YEARLY
          : EntitlementScope.GRADE_MONTHLY;

      const existing = await tx.entitlement.findFirst({
        where: {
          userId,
          scope,
          gradeId: plan.gradeId,
          academicYearId: plan.academicYearId,
          status: EntitlementStatus.ACTIVE,
        },
        select: { id: true, expiresAt: true },
      });

      // Renewing extends from the current expiry, not from now, so a student
      // who renews early does not lose the days they already paid for.
      const base =
        existing?.expiresAt && existing.expiresAt > new Date() ? existing.expiresAt : new Date();

      const expiresAt = plan.accessUntil
        ? plan.accessUntil
        : new Date(base.getTime() + (plan.durationDays ?? 30) * 24 * 60 * 60 * 1000);

      if (existing) {
        await tx.entitlement.update({
          where: { id: existing.id },
          data: { expiresAt, ...(orderId ? { orderId } : {}) },
        });
        return { entitlementId: existing.id, created: false };
      }

      const created = await tx.entitlement.create({
        data: {
          userId,
          scope,
          source,
          gradeId: plan.gradeId,
          academicYearId: plan.academicYearId,
          orderId,
          expiresAt,
          grantedById: params.grantedById,
        },
        select: { id: true },
      });
      return { entitlementId: created.id, created: true };
    }

    throw new Error(`Product ${product.kind} has no target to grant an entitlement for.`);
  }

  /** Shared path for the three perpetual scopes. */
  private async upsertPerpetual(
    tx: Tx,
    params: {
      userId: string;
      scope: EntitlementScope;
      where: { lessonId?: string; chapterId?: string; courseId?: string; assessmentId?: string };
      orderId?: string;
      source: EntitlementSource;
      grantedById?: string;
    },
  ): Promise<{ entitlementId: string; created: boolean }> {
    const existing = await tx.entitlement.findFirst({
      where: {
        userId: params.userId,
        scope: params.scope,
        status: EntitlementStatus.ACTIVE,
        ...params.where,
      },
      select: { id: true },
    });

    // Already owned — buying twice must not create a second entitlement.
    if (existing) return { entitlementId: existing.id, created: false };

    const created = await tx.entitlement.create({
      data: {
        userId: params.userId,
        scope: params.scope,
        source: params.source,
        orderId: params.orderId,
        grantedById: params.grantedById,
        expiresAt: null,
        ...params.where,
      },
      select: { id: true },
    });

    return { entitlementId: created.id, created: true };
  }

  // --------------------------------------------------------------------------
  // Administration & maintenance
  // --------------------------------------------------------------------------

  async revoke(entitlementId: string, revokedById: string, reason: string): Promise<void> {
    await this.prisma.entitlement.update({
      where: { id: entitlementId },
      data: {
        status: EntitlementStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason,
        grantedById: revokedById,
      },
    });
  }

  /**
   * Flips lapsed entitlements from ACTIVE to EXPIRED.
   *
   * Access checks already treat a past `expiresAt` as no access, so this is
   * housekeeping — it keeps the partial unique indexes free for a renewal and
   * makes "active subscriptions" counts honest. Run on a schedule.
   */
  async expireLapsed(): Promise<number> {
    const { count } = await this.prisma.entitlement.updateMany({
      where: {
        status: EntitlementStatus.ACTIVE,
        expiresAt: { not: null, lte: new Date() },
      },
      data: { status: EntitlementStatus.EXPIRED },
    });

    if (count) this.logger.log(`Expired ${count} lapsed entitlement(s)`);
    return count;
  }

  /** Everything a student currently holds, for the "اشتراكاتي" screen. */
  async listForUser(userId: string) {
    return this.prisma.entitlement.findMany({
      where: { userId, status: { not: EntitlementStatus.REVOKED } },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { reference: true, paidAt: true, totalMinor: true } },
      },
    });
  }
}
