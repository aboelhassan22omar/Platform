import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PublishStatus, VideoStatus, StudentType } from '../generated/prisma/enums';
import { isLessonFreeFor, lessonPriceFor } from '../common/utils/lesson-pricing';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

/**
 * Read model for the public catalogue and the student's own library.
 *
 * Every lesson leaving this service carries an `isAccessible` flag computed
 * from the entitlement table — the frontend renders locks from that flag, but
 * it is the playback endpoint that actually enforces access. A tampered
 * frontend gains nothing.
 */
@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // --------------------------------------------------------------------------
  // Public catalogue
  // --------------------------------------------------------------------------

  async getCourseBySlug(
    gradeSlug: string,
    courseSlug: string,
    viewer?: { id: string; isStaff: boolean },
  ) {
    const course = await this.prisma.course.findFirst({
      where: {
        slug: courseSlug,
        grade: { slug: gradeSlug },
        // Staff can preview drafts; students only ever see published courses.
        ...(viewer?.isStaff ? {} : { status: PublishStatus.PUBLISHED }),
      },
      include: {
        grade: true,
        academicYear: true,
        products: { where: { isActive: true }, select: { id: true, priceMinor: true } },
        units: {
          where: viewer?.isStaff ? {} : { status: PublishStatus.PUBLISHED },
          orderBy: { sortOrder: 'asc' },
          include: {
            chapters: {
              where: viewer?.isStaff ? {} : { status: PublishStatus.PUBLISHED },
              orderBy: { sortOrder: 'asc' },
              include: {
                products: { where: { isActive: true }, select: { id: true } },
                lessons: {
                  where: viewer?.isStaff ? {} : { status: PublishStatus.PUBLISHED },
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    products: { where: { isActive: true }, select: { id: true } },
                    videoAsset: { select: { status: true, durationSeconds: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('الكورس غير موجود');

    const lessonIds = course.units.flatMap((unit) =>
      unit.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
    );

    const accessible = viewer
      ? await this.entitlements.filterAccessibleLessonIds(viewer.id, lessonIds, {
          isStaff: viewer.isStaff,
        })
      : new Set<string>();

    // A signed-out visitor still sees which lessons are free previews.
    const progress = viewer ? await this.progressMap(viewer.id, lessonIds) : new Map();
    const studentType = viewer ? await this.studentTypeFor(viewer.id) : undefined;

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnailUrl: this.storage.publicUrl(course.thumbnailKey),
      coverUrl: this.storage.publicUrl(course.coverKey),
      status: course.status,
      isProvisional: course.isProvisional,
      priceMinor: course.priceMinor,
      productId: course.products[0]?.id ?? null,
      academicYear: course.academicYear.label,
      grade: {
        id: course.grade.id,
        slug: course.grade.slug,
        nameAr: course.grade.nameAr,
        shortNameAr: course.grade.shortNameAr,
        themeKey: course.grade.themeKey,
        educationSystem: course.grade.educationSystem,
      },
      lessonCount: lessonIds.length,
      accessibleCount: accessible.size,
      units: course.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        description: unit.description,
        sortOrder: unit.sortOrder,
        chapters: unit.chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          description: chapter.description,
          sortOrder: chapter.sortOrder,
          priceMinor: chapter.priceMinor,
          productId: chapter.products[0]?.id ?? null,
          lessons: chapter.lessons.map((lesson) =>
            this.presentLesson(
              lesson,
              accessible.has(lesson.id),
              progress.get(lesson.id),
              studentType,
            ),
          ),
        })),
      })),
    };
  }

  // --------------------------------------------------------------------------
  // "حصصي" — the student's library
  // --------------------------------------------------------------------------

  /**
   * Every lesson the student can currently open, however they got it.
   *
   * Deliberately returns ONE row per lesson: a student who owns a lesson
   * outright *and* holds a subscription covering it sees a single card, not
   * two. `accessVia` reports the strongest reason.
   */
  async listMyLessons(userId: string, _opts: { isStaff?: boolean } = {}) {
    const now = new Date();

    const [student, watchedRows] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { educationSystem: true, gradeLevel: true, studentType: true },
      }),
      this.prisma.lessonProgress.findMany({
        where: { userId },
        select: { lessonId: true },
      }),
    ]);

    if (!_opts.isStaff && (!student?.educationSystem || !student.gradeLevel)) return [];
    const watchedLessonIds = watchedRows.map((row) => row.lessonId);

    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        userId,
        status: 'ACTIVE',
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
        expiresAt: true,
      },
    });

    const gradeScopes = entitlements.filter((e) => e.gradeId && e.academicYearId);

    // One query gathers every lesson reachable through any held entitlement.
    const lessons = await this.prisma.lesson.findMany({
      where: {
        status: PublishStatus.PUBLISHED,
        ...(!_opts.isStaff
          ? {
              chapter: {
                unit: {
                  course: {
                    grade: {
                      educationSystem: student!.educationSystem!,
                      level: student!.gradeLevel!,
                    },
                  },
                },
              },
            }
          : {}),
        OR: [
          // A free lesson joins "My lessons" only after the student starts it.
          { id: { in: watchedLessonIds }, isFreePreview: true },
          ...(student?.studentType === StudentType.CENTER
            ? [{ id: { in: watchedLessonIds }, centerPriceMinor: 0 }]
            : []),
          { id: { in: entitlements.map((e) => e.lessonId).filter(Boolean) as string[] } },
          {
            chapterId: {
              in: entitlements.map((e) => e.chapterId).filter(Boolean) as string[],
            },
          },
          {
            chapter: {
              unit: {
                courseId: {
                  in: entitlements.map((e) => e.courseId).filter(Boolean) as string[],
                },
              },
            },
          },
          ...(gradeScopes.length
            ? [
                {
                  chapter: {
                    unit: {
                      course: {
                        status: PublishStatus.PUBLISHED,
                        OR: gradeScopes.map((e) => ({
                          gradeId: e.gradeId!,
                          academicYearId: e.academicYearId!,
                        })),
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        videoAsset: { select: { status: true, durationSeconds: true } },
        chapter: {
          include: {
            unit: { include: { course: { include: { grade: true } } } },
          },
        },
      },
      orderBy: [{ chapter: { unit: { sortOrder: 'asc' } } }, { sortOrder: 'asc' }],
    });

    const progress = await this.progressMap(
      userId,
      lessons.map((l) => l.id),
    );

    const ownedLessonIds = new Set(entitlements.map((e) => e.lessonId).filter(Boolean));
    const ownedChapterIds = new Set(entitlements.map((e) => e.chapterId).filter(Boolean));
    const ownedCourseIds = new Set(entitlements.map((e) => e.courseId).filter(Boolean));

    return lessons.map((lesson) => {
      const course = lesson.chapter.unit.course;
      const accessVia = ownedLessonIds.has(lesson.id)
        ? 'LESSON'
        : ownedChapterIds.has(lesson.chapterId)
          ? 'CHAPTER'
          : ownedCourseIds.has(course.id)
            ? 'COURSE'
            : gradeScopes.some(
                  (e) => e.gradeId === course.gradeId && e.academicYearId === course.academicYearId,
                )
              ? 'SUBSCRIPTION'
              : 'FREE_PREVIEW';

      // For subscription access the card shows when it runs out.
      const expiresAt =
        accessVia === 'SUBSCRIPTION'
          ? (gradeScopes.find(
              (e) => e.gradeId === course.gradeId && e.academicYearId === course.academicYearId,
            )?.expiresAt ?? null)
          : null;

      const p = progress.get(lesson.id);

      return {
        ...this.presentLesson(lesson, true, p, student?.studentType),
        accessVia,
        expiresAt,
        course: {
          id: course.id,
          title: course.title,
          slug: course.slug,
          gradeSlug: course.grade.slug,
          themeKey: course.grade.themeKey,
        },
        chapterTitle: lesson.chapter.title,
        unitTitle: lesson.chapter.unit.title,
      };
    });
  }

  /** "كمّل من مكان ما وقفت" — recently watched, not yet finished. */
  async listContinueWatching(userId: string, limit = 6) {
    const studentType = await this.studentTypeFor(userId);
    const rows = await this.prisma.lessonProgress.findMany({
      where: {
        userId,
        completed: false,
        positionSeconds: { gt: 10 },
        lesson: { status: PublishStatus.PUBLISHED },
      },
      orderBy: { lastWatchedAt: 'desc' },
      take: limit * 2,
      include: {
        lesson: {
          include: {
            videoAsset: { select: { status: true, durationSeconds: true } },
            chapter: {
              include: { unit: { include: { course: { include: { grade: true } } } } },
            },
          },
        },
      },
    });

    // Progress rows outlive entitlements (a lapsed subscription keeps its
    // history), so re-check access before offering to resume.
    const accessible = await this.entitlements.filterAccessibleLessonIds(
      userId,
      rows.map((r) => r.lessonId),
    );

    return rows
      .filter((row) => accessible.has(row.lessonId))
      .slice(0, limit)
      .map((row) => {
        const course = row.lesson.chapter.unit.course;
        return {
          ...this.presentLesson(row.lesson, true, row, studentType),
          course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
            gradeSlug: course.grade.slug,
            themeKey: course.grade.themeKey,
          },
          chapterTitle: row.lesson.chapter.title,
        };
      });
  }

  async getLessonForViewer(lessonId: string, viewer: { id: string; isStaff: boolean }) {
    const studentType = await this.studentTypeFor(viewer.id);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        videoAsset: { select: { status: true, durationSeconds: true } },
        attachments: true,
        chapter: {
          include: { unit: { include: { course: { include: { grade: true } } } } },
        },
        products: { where: { isActive: true }, select: { id: true, priceMinor: true } },
      },
    });

    if (!lesson) throw new NotFoundException('الحصة غير موجودة');

    const decision = await this.entitlements.checkLessonAccess(viewer.id, lessonId, {
      isStaff: viewer.isStaff,
    });

    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: viewer.id, lessonId } },
    });

    const course = lesson.chapter.unit.course;

    return {
      ...this.presentLesson(lesson, decision.allowed, progress ?? undefined, studentType),
      access: {
        allowed: decision.allowed,
        reason: decision.reason,
        expiresAt: decision.expiresAt ?? null,
      },
      attachments: decision.allowed
        ? lesson.attachments.map((a) => ({
            id: a.id,
            title: a.title,
            contentType: a.contentType,
            sizeBytes: a.sizeBytes,
          }))
        : [],
      chapter: { id: lesson.chapter.id, title: lesson.chapter.title },
      unit: { id: lesson.chapter.unit.id, title: lesson.chapter.unit.title },
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        gradeSlug: course.grade.slug,
        gradeName: course.grade.nameAr,
        themeKey: course.grade.themeKey,
      },
    };
  }

  async getAttachmentDownload(
    lessonId: string,
    attachmentId: string,
    viewer: { id: string; isStaff: boolean },
  ) {
    const decision = await this.entitlements.checkLessonAccess(viewer.id, lessonId, {
      isStaff: viewer.isStaff,
    });
    if (!decision.allowed) throw new ForbiddenException('غير مسموح بتنزيل ملف الحصة');
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, lessonId },
    });
    if (!attachment) throw new NotFoundException('الملف غير موجود');
    return this.storage.presignDownload(this.storage.videoBucket, attachment.storageKey, 120);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async progressMap(userId: string, lessonIds: string[]) {
    if (!lessonIds.length) return new Map();
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
    });
    return new Map(rows.map((row) => [row.lessonId, row]));
  }

  private async studentTypeFor(userId: string) {
    return (
      await this.prisma.user.findUnique({ where: { id: userId }, select: { studentType: true } })
    )?.studentType;
  }

  private presentLesson(
    lesson: {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      thumbnailKey: string | null;
      sortOrder: number;
      status: PublishStatus;
      priceMinor: number | null;
      centerPriceMinor?: number | null;
      isFreePreview: boolean;
      durationSeconds: number;
      chapterId: string;
      videoAsset?: { status: VideoStatus; durationSeconds: number | null } | null;
      products?: Array<{ id: string }>;
    },
    isAccessible: boolean,
    progress?: {
      positionSeconds: number;
      percent: number;
      completed: boolean;
      lastWatchedAt: Date;
    },
    studentType?: StudentType,
  ) {
    return {
      id: lesson.id,
      title: lesson.title,
      slug: lesson.slug,
      description: lesson.description,
      thumbnailUrl: this.storage.publicUrl(lesson.thumbnailKey),
      sortOrder: lesson.sortOrder,
      status: lesson.status,
      priceMinor: lessonPriceFor(lesson, studentType),
      productId:
        (lessonPriceFor(lesson, studentType) ?? 0) > 0 ? (lesson.products?.[0]?.id ?? null) : null,
      isFreePreview: isLessonFreeFor(lesson, studentType),
      durationSeconds: lesson.videoAsset?.durationSeconds ?? lesson.durationSeconds,
      chapterId: lesson.chapterId,
      videoStatus: lesson.videoAsset?.status ?? VideoStatus.AWAITING_UPLOAD,
      isPlayable: lesson.videoAsset?.status === VideoStatus.READY,
      isAccessible,
      progress: progress
        ? {
            positionSeconds: progress.positionSeconds,
            percent: progress.percent,
            completed: progress.completed,
            lastWatchedAt: progress.lastWatchedAt,
          }
        : null,
    };
  }
}
