import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  AssessmentAttemptStatus,
  AssessmentKind,
  GradeLevel,
  PublishStatus,
  Role,
  UserStatus,
} from '../generated/prisma/enums';

/** A lesson counts as finished at 92% — credits and outros are not content. */
const COMPLETION_THRESHOLD_PERCENT = 99;

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Records playback position.
   *
   * The client sends a heartbeat roughly every 15 seconds and on pause/unload,
   * never per frame. `percent` is recomputed here from position and duration —
   * a client claiming 100% on a video it never watched changes nothing.
   *
   * Access is re-checked on every write, so a student whose subscription
   * lapsed mid-session stops accumulating progress.
   */
  async record(
    userId: string,
    lessonId: string,
    input: { positionSeconds: number; durationSeconds: number; watchedSeconds?: number },
    opts: { isStaff?: boolean } = {},
  ) {
    const decision = await this.entitlements.checkLessonAccess(userId, lessonId, opts);
    if (!decision.allowed) {
      throw new ForbiddenException('مش مسموح لك تشوف الحصة دي');
    }

    const asset = await this.prisma.videoAsset.findUnique({
      where: { lessonId },
      select: { durationSeconds: true },
    });
    const canonicalDuration = asset?.durationSeconds ?? 0;
    const duration = Math.max(0, canonicalDuration || Math.floor(input.durationSeconds));
    // Clamp to the real duration so a forged position cannot mark a lesson done.
    const position = Math.min(
      Math.max(0, Math.floor(input.positionSeconds)),
      duration || Number.MAX_SAFE_INTEGER,
    );

    const existing = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: {
        positionSeconds: true,
        durationSeconds: true,
        completed: true,
        lastWatchedAt: true,
      },
    });

    // Study time is the furthest point reached in each video. Rewatching or
    // rewinding never adds time and never moves the saved position backwards.
    const previousPosition = existing?.positionSeconds ?? 0;
    const now = new Date();
    const elapsedSeconds = existing?.lastWatchedAt
      ? Math.max(0, (now.getTime() - existing.lastWatchedAt.getTime()) / 1000)
      : 0;
    const reportedWatched = Math.max(0, Math.min(input.watchedSeconds ?? 0, 120));
    // A seek/forged position cannot award progress. Allow real playback up to
    // 2x speed, plus a small event/timer tolerance.
    const verifiedAdvance = existing
      ? Math.min(reportedWatched, elapsedSeconds * 2.15 + 3)
      : Math.min(reportedWatched, 33);
    const furthestPosition = Math.min(
      duration || position,
      Math.max(previousPosition, Math.min(position, previousPosition + verifiedAdvance)),
    );
    const knownDuration = Math.max(existing?.durationSeconds ?? 0, duration);
    const furthestPercent =
      knownDuration > 0 ? Math.min(100, Math.round((furthestPosition / knownDuration) * 100)) : 0;
    const isCompleted = existing?.completed || furthestPercent >= COMPLETION_THRESHOLD_PERCENT;

    return this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        positionSeconds: furthestPosition,
        durationSeconds: knownDuration,
        percent: furthestPercent,
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null,
        watchedSeconds: furthestPosition,
        lastWatchedAt: now,
      },
      update: {
        positionSeconds: furthestPosition,
        durationSeconds: knownDuration || undefined,
        percent: existing?.completed ? 100 : furthestPercent,
        // Once finished, a lesson stays finished even if the student rewinds.
        completed: isCompleted,
        ...(isCompleted && !existing?.completed ? { completedAt: new Date() } : {}),
        watchedSeconds: furthestPosition,
        lastWatchedAt: now,
      },
    });
  }

  async getForLesson(userId: string, lessonId: string) {
    return this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  /** Headline numbers for the student dashboard. */
  async summaryForUser(userId: string) {
    const [aggregate, completed, inProgress] = await Promise.all([
      this.prisma.lessonProgress.aggregate({
        where: { userId },
        _sum: { positionSeconds: true },
        _count: true,
      }),
      this.prisma.lessonProgress.count({ where: { userId, completed: true } }),
      this.prisma.lessonProgress.count({
        where: { userId, completed: false, positionSeconds: { gt: 10 } },
      }),
    ]);

    return {
      lessonsStarted: aggregate._count,
      lessonsCompleted: completed,
      lessonsInProgress: inProgress,
      totalWatchedSeconds: aggregate._sum.positionSeconds ?? 0,
    };
  }

  async leaderboard(currentUserId: string, requestedGrade?: GradeLevel) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { gradeLevel: true },
    });
    const gradeLevel = requestedGrade ?? currentUser?.gradeLevel;
    if (!gradeLevel)
      return {
        gradeLevel: null,
        topStudents: [],
        currentStudent: null,
        scoring: this.scoringRules(),
      };

    const students = await this.prisma.user.findMany({
      where: { role: Role.STUDENT, status: UserStatus.ACTIVE, gradeLevel },
      select: {
        id: true,
        fullName: true,
        progress: { select: { percent: true, completed: true } },
        assessmentAttempts: {
          where: {
            status: { in: [AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIMED_OUT] },
          },
          select: { assessmentId: true, percentage: true, assessment: { select: { kind: true } } },
        },
      },
    });

    const ranked = students
      .map((student) => this.scoreStudent(student))
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          b.averageScore - a.averageScore ||
          a.fullName.localeCompare(b.fullName, 'ar'),
      )
      .map((student, index) => ({ ...student, rank: index + 1 }));

    return {
      gradeLevel,
      topStudents: ranked.slice(0, 10),
      currentStudent:
        gradeLevel === currentUser?.gradeLevel
          ? (ranked.find((student) => student.id === currentUserId) ?? null)
          : null,
      scoring: this.scoringRules(),
    };
  }

  async achievementsForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gradeLevel: true, educationSystem: true },
    });
    if (!user?.gradeLevel || !user.educationSystem)
      return {
        title: this.titleFor(0),
        completionPercent: 0,
        earnedCount: 0,
        totalCount: 0,
        badges: [],
      };

    const grade = await this.prisma.grade.findUnique({
      where: {
        educationSystem_level: { educationSystem: user.educationSystem, level: user.gradeLevel },
      },
      select: { id: true, nameAr: true },
    });
    if (!grade)
      return {
        title: this.titleFor(0),
        completionPercent: 0,
        earnedCount: 0,
        totalCount: 0,
        badges: [],
      };

    const attemptFilter = {
      userId,
      status: { in: [AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIMED_OUT] },
    };
    const [units, lessons, uniqueAssessments, ranking] = await Promise.all([
      this.prisma.unit.findMany({
        where: {
          status: PublishStatus.PUBLISHED,
          course: { status: PublishStatus.PUBLISHED, gradeId: grade.id },
        },
        orderBy: [{ courseId: 'asc' }, { sortOrder: 'asc' }],
        select: { id: true, title: true },
      }),
      this.prisma.lesson.findMany({
        where: {
          status: PublishStatus.PUBLISHED,
          chapter: {
            status: PublishStatus.PUBLISHED,
            unit: {
              status: PublishStatus.PUBLISHED,
              course: { status: PublishStatus.PUBLISHED, gradeId: grade.id },
            },
          },
        },
        select: {
          id: true,
          chapter: { select: { unitId: true } },
          progress: { where: { userId }, select: { percent: true, completed: true } },
        },
      }),
      this.prisma.assessment.findMany({
        where: {
          status: PublishStatus.PUBLISHED,
          OR: [
            { unit: { course: { gradeId: grade.id } } },
            { lesson: { chapter: { unit: { course: { gradeId: grade.id } } } } },
          ],
        },
        select: {
          id: true,
          kind: true,
          unitId: true,
          lesson: { select: { chapter: { select: { unitId: true } } } },
          attempts: { where: attemptFilter, select: { percentage: true } },
        },
      }),
      this.leaderboard(userId, user.gradeLevel),
    ]);

    const lessonProgressTotal = lessons.reduce(
      (sum, lesson) => sum + (lesson.progress[0]?.percent ?? 0),
      0,
    );
    const submittedCount = uniqueAssessments.filter((item) => item.attempts.length > 0).length;
    const targetCount = lessons.length + uniqueAssessments.length;
    const completionPercent = targetCount
      ? Math.round((lessonProgressTotal + submittedCount * 100) / targetCount)
      : 0;
    const currentRank = ranking.currentStudent?.rank ?? 0;

    const homework = uniqueAssessments.filter((item) => item.kind === AssessmentKind.HOMEWORK);
    const exams = uniqueAssessments.filter((item) => item.kind !== AssessmentKind.HOMEWORK);
    const best = (item: { attempts: Array<{ percentage: number }> }) =>
      Math.max(0, ...item.attempts.map((attempt) => attempt.percentage));
    const average = (items: typeof uniqueAssessments) =>
      items.length
        ? Math.round(items.reduce((sum, item) => sum + best(item), 0) / items.length)
        : 0;
    const completedLessons = lessons.filter((lesson) => lesson.progress[0]?.completed).length;
    const submittedHomework = homework.filter((item) => item.attempts.length > 0).length;
    const submittedExams = exams.filter((item) => item.attempts.length > 0).length;
    const perfectHomework = homework.filter((item) => best(item) === 100).length;
    const excellentExams = exams.filter((item) => best(item) >= 90).length;
    const totalPoints = ranking.currentStudent?.totalPoints ?? 0;
    const toward = (value: number, target: number) =>
      Math.min(100, Math.round((value / target) * 100));

    const badges: Array<ReturnType<ProgressService['badge']>> = [
      this.badge(
        'top-1',
        'كأس بطل الصف',
        'trophy',
        currentRank === 1,
        currentRank ? Math.min(100, Math.round(100 / currentRank)) : 0,
        'احتل المركز الأول في ترتيب صفك.',
        'ranking',
      ),
      this.badge(
        'top-3',
        'منصة الأبطال',
        'crown',
        currentRank > 0 && currentRank <= 3,
        currentRank ? Math.min(100, Math.round(300 / currentRank)) : 0,
        'كن ضمن أول 3 طلاب في صفك.',
        'ranking',
      ),
      this.badge(
        'top-10',
        'نخبة الصف',
        'medal',
        currentRank > 0 && currentRank <= 10,
        currentRank ? Math.min(100, Math.round(1000 / currentRank)) : 0,
        'كن ضمن أول 10 طلاب في صفك.',
        'ranking',
      ),
      this.badge(
        'video-first',
        'أول خطوة',
        'play',
        completedLessons >= 1,
        toward(completedLessons, 1),
        'أكمل أول فيديو تعليمي.',
        'videos',
      ),
      this.badge(
        'video-5',
        'طالب نشيط',
        'book',
        completedLessons >= 5,
        toward(completedLessons, 5),
        'أكمل 5 فيديوهات تعليمية.',
        'videos',
      ),
      this.badge(
        'video-10',
        'رحّالة المعرفة',
        'compass',
        completedLessons >= 10,
        toward(completedLessons, 10),
        'أكمل 10 فيديوهات تعليمية.',
        'videos',
      ),
      this.badge(
        'video-25',
        'مؤرخ مجتهد',
        'pyramid',
        completedLessons >= 25,
        toward(completedLessons, 25),
        'أكمل 25 فيديو تعليميًا.',
        'videos',
      ),
      this.badge(
        'video-all',
        'سيد المحتوى',
        'eye',
        lessons.length > 0 && completedLessons === lessons.length,
        lessons.length ? toward(completedLessons, lessons.length) : 0,
        'أكمل جميع فيديوهات صفك.',
        'videos',
      ),
      this.badge(
        'homework-first',
        'بداية الواجب',
        'scroll',
        submittedHomework >= 1,
        toward(submittedHomework, 1),
        'سلّم أول واجب.',
        'homework',
      ),
      this.badge(
        'homework-5',
        'محارب الواجبات',
        'shield',
        submittedHomework >= 5,
        toward(submittedHomework, 5),
        'سلّم 5 واجبات.',
        'homework',
      ),
      this.badge(
        'homework-10',
        'سلسلة الإنجاز',
        'lightning',
        submittedHomework >= 10,
        toward(submittedHomework, 10),
        'سلّم 10 واجبات.',
        'homework',
      ),
      this.badge(
        'homework-perfect',
        'العلامة الكاملة',
        'diamond',
        perfectHomework >= 1,
        toward(perfectHomework, 1),
        'احصل على 100% في واجب واحد.',
        'homework',
      ),
      this.badge(
        'homework-perfect-5',
        'ملك الواجبات',
        'crown',
        perfectHomework >= 5,
        toward(perfectHomework, 5),
        'احصل على 100% في 5 واجبات.',
        'homework',
      ),
      this.badge(
        'homework-master',
        'حارس الواجبات',
        'scroll',
        homework.length > 0 &&
          homework.every((item) => item.attempts.length > 0) &&
          average(homework) >= 80,
        homework.length ? toward(submittedHomework, homework.length) : 0,
        'سلّم كل واجبات صفك وحافظ على متوسط 80% أو أكثر.',
        'homework',
      ),
      this.badge(
        'exam-first',
        'دخول الساحة',
        'sword',
        submittedExams >= 1,
        toward(submittedExams, 1),
        'أكمل أول امتحان.',
        'exams',
      ),
      this.badge(
        'exam-5',
        'ثابت تحت الضغط',
        'shield',
        submittedExams >= 5,
        toward(submittedExams, 5),
        'أكمل 5 امتحانات.',
        'exams',
      ),
      this.badge(
        'exam-excellent',
        'نجم الامتحان',
        'star',
        excellentExams >= 1,
        toward(excellentExams, 1),
        'احصل على 90% أو أكثر في امتحان.',
        'exams',
      ),
      this.badge(
        'exam-excellent-5',
        'العبقري الذهبي',
        'brain',
        excellentExams >= 5,
        toward(excellentExams, 5),
        'احصل على 90% أو أكثر في 5 امتحانات.',
        'exams',
      ),
      this.badge(
        'exam-master',
        'عبقري الامتحانات',
        'star',
        exams.length > 0 && exams.every((item) => item.attempts.length > 0) && average(exams) >= 90,
        exams.length ? toward(submittedExams, exams.length) : 0,
        'أكمل كل امتحانات صفك بمتوسط 90% أو أكثر.',
        'exams',
      ),
      this.badge(
        'points-500',
        'البرونزي',
        'medal',
        totalPoints >= 500,
        toward(totalPoints, 500),
        'اجمع 500 نقطة.',
        'points',
      ),
      this.badge(
        'points-1000',
        'الفضي',
        'medal',
        totalPoints >= 1000,
        toward(totalPoints, 1000),
        'اجمع 1000 نقطة.',
        'points',
      ),
      this.badge(
        'points-2500',
        'الذهبي',
        'trophy',
        totalPoints >= 2500,
        toward(totalPoints, 2500),
        'اجمع 2500 نقطة.',
        'points',
      ),
      this.badge(
        'points-5000',
        'الماسي',
        'diamond',
        totalPoints >= 5000,
        toward(totalPoints, 5000),
        'اجمع 5000 نقطة.',
        'points',
      ),
      this.badge(
        'completion-25',
        'فاتح الطريق',
        'compass',
        completionPercent >= 25,
        toward(completionPercent, 25),
        'أكمل 25% من محتوى صفك.',
        'completion',
      ),
      this.badge(
        'completion-50',
        'نصف الطريق',
        'ankh',
        completionPercent >= 50,
        toward(completionPercent, 50),
        'أكمل 50% من محتوى صفك.',
        'completion',
      ),
      this.badge(
        'completion-75',
        'قاهر المنهج',
        'scarab',
        completionPercent >= 75,
        toward(completionPercent, 75),
        'أكمل 75% من محتوى صفك.',
        'completion',
      ),
      this.badge(
        'completion-90',
        'العالمي',
        'crown',
        completionPercent >= 90,
        toward(completionPercent, 90),
        'أكمل 90% من محتوى صفك.',
        'completion',
      ),
      this.badge(
        'completion-100',
        'الأسطوري',
        'trophy',
        completionPercent >= 100,
        completionPercent,
        'أكمل كل محتوى صفك بنسبة 100%.',
        'completion',
      ),
    ];

    const unitIcons = ['eye', 'ankh', 'scarab', 'pyramid', 'lotus'];
    units.forEach((unit, index) => {
      const unitLessons = lessons.filter((lesson) => lesson.chapter.unitId === unit.id);
      const unitAssessments = uniqueAssessments.filter(
        (assessment) => (assessment.unitId ?? assessment.lesson?.chapter.unitId) === unit.id,
      );
      const completedItems =
        unitLessons.filter((lesson) => lesson.progress[0]?.completed).length +
        unitAssessments.filter((item) => item.attempts.length > 0).length;
      const totalItems = unitLessons.length + unitAssessments.length;
      badges.push(
        this.badge(
          `unit-${unit.id}`,
          `شارة ${unit.title}`,
          unitIcons[index % unitIcons.length],
          totalItems > 0 && completedItems === totalItems,
          totalItems ? Math.round((completedItems / totalItems) * 100) : 0,
          `أكمل كل فيديوهات وواجبات وامتحانات «${unit.title}».`,
          'units',
        ),
      );
    });

    return {
      gradeName: grade.nameAr,
      title: this.titleFor(completionPercent),
      completionPercent,
      earnedCount: badges.filter((item) => item.earned).length,
      totalCount: badges.length,
      badges,
    };
  }

  private badge(
    id: string,
    name: string,
    icon: string,
    earned: boolean,
    progress: number,
    requirement: string,
    category = 'special',
  ) {
    return {
      id,
      name,
      icon,
      category,
      earned,
      progress: Math.max(0, Math.min(100, progress)),
      requirement,
    };
  }

  private titleFor(percent: number) {
    if (percent >= 100) return { name: 'الأسطوري', tier: 'LEGENDARY', nextAt: null };
    if (percent >= 90) return { name: 'العالمي', tier: 'WORLD_CLASS', nextAt: 100 };
    if (percent >= 75) return { name: 'البطل', tier: 'CHAMPION', nextAt: 90 };
    if (percent >= 50) return { name: 'المحارب', tier: 'WARRIOR', nextAt: 75 };
    if (percent >= 25) return { name: 'المجتهد', tier: 'DILIGENT', nextAt: 50 };
    return { name: 'المستكشف', tier: 'EXPLORER', nextAt: 25 };
  }

  private scoreStudent(student: {
    id: string;
    fullName: string;
    progress: Array<{ percent: number; completed: boolean }>;
    assessmentAttempts: Array<{
      assessmentId: string;
      percentage: number;
      assessment: { kind: AssessmentKind };
    }>;
  }) {
    const bestAttempts = new Map<string, { percentage: number; kind: AssessmentKind }>();
    for (const attempt of student.assessmentAttempts) {
      const previous = bestAttempts.get(attempt.assessmentId);
      if (!previous || attempt.percentage > previous.percentage) {
        bestAttempts.set(attempt.assessmentId, {
          percentage: attempt.percentage,
          kind: attempt.assessment.kind,
        });
      }
    }

    const videoPoints = student.progress.reduce(
      (sum, item) => sum + Math.max(0, Math.min(100, item.percent)),
      0,
    );
    const lessonsCompleted = student.progress.filter((item) => item.completed).length;
    let homeworkPoints = 0;
    let examPoints = 0;
    let scoreTotal = 0;
    for (const attempt of bestAttempts.values()) {
      scoreTotal += attempt.percentage;
      if (attempt.kind === AssessmentKind.HOMEWORK) homeworkPoints += attempt.percentage;
      else if (attempt.kind === AssessmentKind.LESSON_EXAM) examPoints += attempt.percentage * 1.5;
      else examPoints += attempt.percentage * 2;
    }
    const completionPoints = lessonsCompleted * 25 + bestAttempts.size * 10;
    const totalPoints = Math.round(videoPoints + homeworkPoints + examPoints + completionPoints);

    return {
      id: student.id,
      fullName: student.fullName,
      totalPoints,
      videoPoints: Math.round(videoPoints),
      homeworkPoints: Math.round(homeworkPoints),
      examPoints: Math.round(examPoints),
      completionPoints,
      lessonsCompleted,
      assessmentsCompleted: bestAttempts.size,
      averageScore: bestAttempts.size ? Math.round(scoreTotal / bestAttempts.size) : 0,
    };
  }

  private scoringRules() {
    return {
      videoProgressMax: 100,
      videoCompletionBonus: 25,
      homeworkMultiplier: 1,
      lessonExamMultiplier: 1.5,
      unitExamMultiplier: 2,
      assessmentCompletionBonus: 10,
    };
  }
}
