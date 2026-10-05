import { Test } from '@nestjs/testing';
import { EntitlementsService } from './entitlements.service';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Unit tests for the access-control engine.
 *
 * Prisma is mocked so these run without a database and stay fast. The
 * integration behaviour (real constraints, real transactions) is covered by
 * the E2E suite in tests/e2e.
 */
describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let prisma: {
    lesson: { findUnique: jest.Mock; findMany: jest.Mock };
    user: { findUnique: jest.Mock };
    entitlement: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    plan: { findUniqueOrThrow: jest.Mock };
  };

  const publishedLesson = (overrides: Record<string, unknown> = {}) => ({
    id: 'lesson-1',
    status: 'PUBLISHED',
    isFreePreview: false,
    chapterId: 'chapter-1',
    chapter: {
      unit: {
        course: {
          id: 'course-1',
          gradeId: 'grade-1',
          academicYearId: 'year-1',
          status: 'PUBLISHED',
          grade: { educationSystem: 'GENERAL', level: 'SEC_1' },
        },
      },
    },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      lesson: { findUnique: jest.fn(), findMany: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ educationSystem: 'GENERAL', gradeLevel: 'SEC_1' }),
      },
      entitlement: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      plan: { findUniqueOrThrow: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EntitlementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(EntitlementsService);
  });

  // -------------------------------------------------------------------------
  describe('checkLessonAccess', () => {
    it('opens a center-free lesson only for a center student', async () => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson({ centerPriceMinor: 0 }));
      prisma.user.findUnique.mockResolvedValue({ educationSystem: 'GENERAL', gradeLevel: 'SEC_1', studentType: 'CENTER' });
      await expect(service.checkLessonAccess('user-1', 'lesson-1')).resolves.toEqual({ allowed: true, reason: 'FREE_PREVIEW' });
      prisma.user.findUnique.mockResolvedValue({ educationSystem: 'GENERAL', gradeLevel: 'SEC_1', studentType: 'ONLINE' });
      await expect(service.checkLessonAccess('user-1', 'lesson-1')).resolves.toEqual({ allowed: false, reason: 'NO_ENTITLEMENT' });
    });

    it('does not open a paid center lesson without an entitlement', async () => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson({ centerPriceMinor: 2500 }));
      prisma.user.findUnique.mockResolvedValue({ educationSystem: 'GENERAL', gradeLevel: 'SEC_1', studentType: 'CENTER' });
      await expect(service.checkLessonAccess('user-1', 'lesson-1')).resolves.toEqual({ allowed: false, reason: 'NO_ENTITLEMENT' });
    });
    it('denies access to a lesson that does not exist', async () => {
      prisma.lesson.findUnique.mockResolvedValue(null);

      const decision = await service.checkLessonAccess('user-1', 'missing');

      expect(decision).toEqual({ allowed: false, reason: 'NOT_PUBLISHED' });
    });

    it('allows a free preview without any entitlement', async () => {
      prisma.lesson.findUnique.mockResolvedValue(
        publishedLesson({ isFreePreview: true }),
      );

      const decision = await service.checkLessonAccess('user-1', 'lesson-1');

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('FREE_PREVIEW');
      // No entitlement lookup is needed for free content.
      expect(prisma.entitlement.findFirst).not.toHaveBeenCalled();
    });

    it('denies even a free preview when it belongs to another grade', async () => {
      prisma.lesson.findUnique.mockResolvedValue(
        publishedLesson({ isFreePreview: true }),
      );
      prisma.user.findUnique.mockResolvedValue({
        educationSystem: 'GENERAL',
        gradeLevel: 'SEC_2',
      });

      const decision = await service.checkLessonAccess('user-1', 'lesson-1');

      expect(decision).toEqual({ allowed: false, reason: 'WRONG_GRADE' });
      expect(prisma.entitlement.findFirst).not.toHaveBeenCalled();
    });

    it('denies a draft lesson even when the student holds an entitlement', async () => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson({ status: 'DRAFT' }));

      const decision = await service.checkLessonAccess('user-1', 'lesson-1');

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('NOT_PUBLISHED');
    });

    it('denies a published lesson inside an unpublished course', async () => {
      prisma.lesson.findUnique.mockResolvedValue(
        publishedLesson({
          chapter: {
            unit: {
              course: {
                id: 'course-1',
                gradeId: 'grade-1',
                academicYearId: 'year-1',
                status: 'DRAFT',
              },
            },
          },
        }),
      );

      const decision = await service.checkLessonAccess('user-1', 'lesson-1');

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('NOT_PUBLISHED');
    });

    it('lets staff preview unpublished content, and reports that honestly', async () => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson({ status: 'DRAFT' }));

      const decision = await service.checkLessonAccess('admin-1', 'lesson-1', {
        isStaff: true,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('STAFF');
    });

    it.each([
      ['LESSON', 'LESSON_PURCHASE'],
      ['CHAPTER', 'CHAPTER_BUNDLE'],
      ['COURSE', 'COURSE_PURCHASE'],
      ['GRADE_MONTHLY', 'SUBSCRIPTION'],
      ['GRADE_YEARLY', 'SUBSCRIPTION'],
    ])('grants access via a %s entitlement and reports %s', async (scope, reason) => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson());
      prisma.entitlement.findFirst.mockResolvedValue({
        id: 'ent-1',
        scope,
        expiresAt: null,
      });

      const decision = await service.checkLessonAccess('user-1', 'lesson-1');

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe(reason);
      expect(decision.entitlementId).toBe('ent-1');
    });

    it('denies with NO_ENTITLEMENT when the student never had access', async () => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson());
      prisma.entitlement.findFirst
        .mockResolvedValueOnce(null) // no live entitlement
        .mockResolvedValueOnce(null); // and none lapsed either

      const decision = await service.checkLessonAccess('user-1', 'lesson-1');

      expect(decision).toEqual({ allowed: false, reason: 'NO_ENTITLEMENT' });
    });

    it('denies with EXPIRED when access lapsed, so the UI can prompt a renewal', async () => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson());
      prisma.entitlement.findFirst
        .mockResolvedValueOnce(null) // nothing live
        .mockResolvedValueOnce({ id: 'old-ent' }); // but something lapsed

      const decision = await service.checkLessonAccess('user-1', 'lesson-1');

      expect(decision).toEqual({ allowed: false, reason: 'EXPIRED' });
    });

    it('only considers entitlements that have started and not expired', async () => {
      prisma.lesson.findUnique.mockResolvedValue(publishedLesson());
      prisma.entitlement.findFirst.mockResolvedValue(null);

      await service.checkLessonAccess('user-1', 'lesson-1');

      const where = prisma.entitlement.findFirst.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
      expect(where.startsAt).toHaveProperty('lte');

      // The expiry window and the scope match must BOTH apply. If they were
      // two top-level OR keys, the second would overwrite the first and a
      // lapsed subscription would keep granting access.
      type Clause = { OR: Array<Record<string, unknown>> };
      const expiryGroup = where.AND.find((clause: Clause) =>
        clause.OR.some((c) => c.expiresAt === null),
      );
      expect(expiryGroup.OR).toEqual([
        { expiresAt: null },
        { expiresAt: { gt: expect.any(Date) } },
      ]);

      const scopeGroup = where.AND.find((clause: Clause) =>
        clause.OR.some((c) => c.scope !== undefined),
      );
      expect(scopeGroup.OR).toHaveLength(4);
    });
  });

  // -------------------------------------------------------------------------
  describe('filterAccessibleLessonIds', () => {
    it('includes center-free lessons in bulk access without granting them to online students', async () => {
      prisma.lesson.findMany.mockResolvedValue([publishedLesson({ centerPriceMinor: 0 })]);
      prisma.entitlement.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ educationSystem: 'GENERAL', gradeLevel: 'SEC_1', studentType: 'CENTER' });
      expect(await service.filterAccessibleLessonIds('user-1', ['lesson-1'])).toEqual(new Set(['lesson-1']));
      prisma.user.findUnique.mockResolvedValue({ educationSystem: 'GENERAL', gradeLevel: 'SEC_1', studentType: 'ONLINE' });
      expect(await service.filterAccessibleLessonIds('user-1', ['lesson-1'])).toEqual(new Set());
    });
    const lessons = [
      {
        id: 'l-free',
        isFreePreview: true,
        status: 'PUBLISHED',
        chapterId: 'c-1',
        chapter: { unit: { course: { id: 'co-1', gradeId: 'g-1', academicYearId: 'y-1', grade: { educationSystem: 'GENERAL', level: 'SEC_1' } } } },
      },
      {
        id: 'l-owned',
        isFreePreview: false,
        status: 'PUBLISHED',
        chapterId: 'c-1',
        chapter: { unit: { course: { id: 'co-1', gradeId: 'g-1', academicYearId: 'y-1', grade: { educationSystem: 'GENERAL', level: 'SEC_1' } } } },
      },
      {
        id: 'l-locked',
        isFreePreview: false,
        status: 'PUBLISHED',
        chapterId: 'c-9',
        chapter: { unit: { course: { id: 'co-9', gradeId: 'g-9', academicYearId: 'y-1', grade: { educationSystem: 'GENERAL', level: 'SEC_2' } } } },
      },
    ];

    it('returns an empty set for an empty input without querying', async () => {
      const result = await service.filterAccessibleLessonIds('user-1', []);

      expect(result.size).toBe(0);
      expect(prisma.lesson.findMany).not.toHaveBeenCalled();
    });

    it('includes free previews and owned lessons, excludes the rest', async () => {
      prisma.lesson.findMany.mockResolvedValue(lessons);
      prisma.entitlement.findMany.mockResolvedValue([
        {
          scope: 'LESSON',
          lessonId: 'l-owned',
          chapterId: null,
          courseId: null,
          gradeId: null,
          academicYearId: null,
        },
      ]);

      const result = await service.filterAccessibleLessonIds('user-1', [
        'l-free',
        'l-owned',
        'l-locked',
      ]);

      expect([...result].sort()).toEqual(['l-free', 'l-owned']);
    });

    it('expands a grade-wide subscription to every lesson in that grade and year', async () => {
      prisma.lesson.findMany.mockResolvedValue(lessons);
      prisma.entitlement.findMany.mockResolvedValue([
        {
          scope: 'GRADE_MONTHLY',
          lessonId: null,
          chapterId: null,
          courseId: null,
          gradeId: 'g-1',
          academicYearId: 'y-1',
        },
      ]);

      const result = await service.filterAccessibleLessonIds('user-1', [
        'l-free',
        'l-owned',
        'l-locked',
      ]);

      // l-locked belongs to a different grade, so the subscription misses it.
      expect(result.has('l-owned')).toBe(true);
      expect(result.has('l-locked')).toBe(false);
    });

    it('does not leak across academic years', async () => {
      prisma.lesson.findMany.mockResolvedValue(lessons);
      prisma.entitlement.findMany.mockResolvedValue([
        {
          scope: 'GRADE_YEARLY',
          lessonId: null,
          chapterId: null,
          courseId: null,
          gradeId: 'g-1',
          // Last year's subscription must not unlock this year's content.
          academicYearId: 'y-OLD',
        },
      ]);

      const result = await service.filterAccessibleLessonIds('user-1', ['l-owned']);

      expect(result.has('l-owned')).toBe(false);
    });

    it('gives staff everything without consulting entitlements', async () => {
      prisma.lesson.findMany.mockResolvedValue(lessons);

      const result = await service.filterAccessibleLessonIds(
        'admin-1',
        ['l-free', 'l-owned', 'l-locked'],
        { isStaff: true },
      );

      expect(result.size).toBe(3);
      expect(prisma.entitlement.findMany).not.toHaveBeenCalled();
    });

    it('runs a fixed number of queries regardless of list size', async () => {
      prisma.lesson.findMany.mockResolvedValue(lessons);
      prisma.entitlement.findMany.mockResolvedValue([]);

      await service.filterAccessibleLessonIds(
        'user-1',
        Array.from({ length: 500 }, (_, i) => `lesson-${i}`),
      );

      expect(prisma.lesson.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.entitlement.findMany).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('grantForProduct', () => {
    const tx = () => prisma as never;

    it('creates a perpetual entitlement for a lesson purchase', async () => {
      prisma.entitlement.findFirst.mockResolvedValue(null);
      prisma.entitlement.create.mockResolvedValue({ id: 'new-ent' });

      const result = await service.grantForProduct(tx(), {
        userId: 'user-1',
        product: {
          kind: 'LESSON',
          lessonId: 'lesson-1',
          chapterId: null,
          courseId: null,
          planId: null,
        },
        orderId: 'order-1',
      });

      expect(result).toEqual({ entitlementId: 'new-ent', created: true });
      expect(prisma.entitlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expiresAt: null, lessonId: 'lesson-1' }),
        }),
      );
    });

    it('reuses an existing entitlement instead of creating a duplicate', async () => {
      // This is what makes a replayed webhook harmless.
      prisma.entitlement.findFirst.mockResolvedValue({ id: 'existing-ent' });

      const result = await service.grantForProduct(tx(), {
        userId: 'user-1',
        product: {
          kind: 'LESSON',
          lessonId: 'lesson-1',
          chapterId: null,
          courseId: null,
          planId: null,
        },
      });

      expect(result).toEqual({ entitlementId: 'existing-ent', created: false });
      expect(prisma.entitlement.create).not.toHaveBeenCalled();
    });

    it('gives a monthly plan a bounded expiry', async () => {
      prisma.plan.findUniqueOrThrow.mockResolvedValue({
        id: 'plan-1',
        gradeId: 'grade-1',
        academicYearId: 'year-1',
        durationDays: 30,
        accessUntil: null,
        kind: 'MONTHLY_PLAN',
      });
      prisma.entitlement.findFirst.mockResolvedValue(null);
      prisma.entitlement.create.mockResolvedValue({ id: 'sub-ent' });

      await service.grantForProduct(tx(), {
        userId: 'user-1',
        product: {
          kind: 'MONTHLY_PLAN',
          lessonId: null,
          chapterId: null,
          courseId: null,
          planId: 'plan-1',
        },
      });

      const created = prisma.entitlement.create.mock.calls[0][0].data;
      expect(created.scope).toBe('GRADE_MONTHLY');
      const days = Math.round(
        (created.expiresAt.getTime() - Date.now()) / 86_400_000,
      );
      expect(days).toBe(30);
    });

    it('extends a renewal from the current expiry, not from today', async () => {
      // A student who renews early must not lose the days they already paid for.
      const existingExpiry = new Date(Date.now() + 10 * 86_400_000);

      prisma.plan.findUniqueOrThrow.mockResolvedValue({
        id: 'plan-1',
        gradeId: 'grade-1',
        academicYearId: 'year-1',
        durationDays: 30,
        accessUntil: null,
        kind: 'MONTHLY_PLAN',
      });
      prisma.entitlement.findFirst.mockResolvedValue({
        id: 'existing-sub',
        expiresAt: existingExpiry,
      });
      prisma.entitlement.update.mockResolvedValue({ id: 'existing-sub' });

      const result = await service.grantForProduct(tx(), {
        userId: 'user-1',
        product: {
          kind: 'MONTHLY_PLAN',
          lessonId: null,
          chapterId: null,
          courseId: null,
          planId: 'plan-1',
        },
      });

      expect(result.created).toBe(false);
      const updated = prisma.entitlement.update.mock.calls[0][0].data;
      const daysFromNow = Math.round(
        (updated.expiresAt.getTime() - Date.now()) / 86_400_000,
      );
      // 10 remaining + 30 purchased.
      expect(daysFromNow).toBe(40);
    });

    it('honours a fixed academic-year end date over a duration', async () => {
      const yearEnd = new Date('2027-07-31T00:00:00Z');
      prisma.plan.findUniqueOrThrow.mockResolvedValue({
        id: 'plan-2',
        gradeId: 'grade-1',
        academicYearId: 'year-1',
        durationDays: 365,
        accessUntil: yearEnd,
        kind: 'YEARLY_PLAN',
      });
      prisma.entitlement.findFirst.mockResolvedValue(null);
      prisma.entitlement.create.mockResolvedValue({ id: 'year-ent' });

      await service.grantForProduct(tx(), {
        userId: 'user-1',
        product: {
          kind: 'YEARLY_PLAN',
          lessonId: null,
          chapterId: null,
          courseId: null,
          planId: 'plan-2',
        },
      });

      const created = prisma.entitlement.create.mock.calls[0][0].data;
      expect(created.scope).toBe('GRADE_YEARLY');
      expect(created.expiresAt).toEqual(yearEnd);
    });

    it('throws rather than granting nothing when a product has no target', async () => {
      await expect(
        service.grantForProduct(tx(), {
          userId: 'user-1',
          product: {
            kind: 'LESSON',
            lessonId: null,
            chapterId: null,
            courseId: null,
            planId: null,
          },
        }),
      ).rejects.toThrow(/no target/i);
    });
  });
});
