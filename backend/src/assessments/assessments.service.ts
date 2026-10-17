import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  AssessmentAttemptStatus,
  PublishStatus,
  QuestionDifficulty,
  QuestionType,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import type { AuthenticatedUser } from '../common/decorators';
import { CertificatesService } from '../certificates/certificates.service';

export interface SubmittedAnswer {
  questionId: string;
  /** Chosen option, for multiple choice and true/false. */
  optionId?: string;
  /** Written answer, for an essay question. */
  text?: string;
}

const ESSAY_MAX_LENGTH = 5000;

/** Unbiased shuffle with a cryptographic source: students cannot predict a draw. */
function shuffleRandom<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificatesService,
    private readonly storage: StorageService,
  ) {}

  async listForStudent(user: AuthenticatedUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { educationSystem: true, gradeLevel: true },
    });
    if (!profile?.educationSystem || !profile.gradeLevel) return [];

    const now = new Date();
    const rows = await this.prisma.assessment.findMany({
      where: {
        status: PublishStatus.PUBLISHED,
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
        AND: {
          OR: [
            {
              lesson: {
                chapter: {
                  unit: {
                    course: {
                      grade: {
                        educationSystem: profile.educationSystem,
                        level: profile.gradeLevel,
                      },
                    },
                  },
                },
              },
            },
            {
              unit: {
                course: {
                  grade: { educationSystem: profile.educationSystem, level: profile.gradeLevel },
                },
              },
            },
          ],
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        lesson: {
          select: {
            title: true,
            titleEn: true,
            chapter: {
              select: {
                unit: {
                  select: {
                    title: true,
                    titleEn: true,
                    course: { select: { title: true, titleEn: true } },
                  },
                },
              },
            },
          },
        },
        unit: {
          select: {
            title: true,
            titleEn: true,
            course: { select: { title: true, titleEn: true } },
          },
        },
        _count: { select: { questions: true } },
        drawRules: { select: { count: true } },
        attempts: {
          where: {
            userId: user.id,
            status: { in: [AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIMED_OUT] },
          },
          orderBy: { submittedAt: 'desc' },
          select: {
            id: true,
            percentage: true,
            passed: true,
            submittedAt: true,
            needsGrading: true,
          },
        },
        products: { where: { isActive: true }, select: { id: true, priceMinor: true } },
      },
    });
    const owned = new Set(
      (
        await this.prisma.entitlement.findMany({
          where: {
            userId: user.id,
            assessmentId: { in: rows.map((row) => row.id) },
            status: 'ACTIVE',
          },
          select: { assessmentId: true },
        })
      )
        .map((item) => item.assessmentId)
        .filter(Boolean),
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      titleEn: row.titleEn,
      description: row.description,
      descriptionEn: row.descriptionEn,
      kind: row.kind,
      timeLimitMinutes: row.timeLimitMinutes,
      passingScore: row.passingScore,
      certificateMinScore: row.certificateEnabled ? row.certificateMinScore : null,
      maxAttempts: row.maxAttempts,
      shuffleQuestions: row.shuffleQuestions,
      shuffleOptions: row.shuffleOptions,
      availableFrom: row.availableFrom,
      dueAt: row.dueAt,
      questionCount:
        row._count.questions + row.drawRules.reduce((sum, rule) => sum + rule.count, 0),
      attemptCount: row.attempts.length,
      latestAttempt: row.attempts[0] ?? null,
      lesson: row.lesson
        ? {
            title: row.lesson.title,
            titleEn: row.lesson.titleEn,
            unitTitle: row.lesson.chapter.unit.title,
            unitTitleEn: row.lesson.chapter.unit.titleEn,
            courseTitle: row.lesson.chapter.unit.course.title,
            courseTitleEn: row.lesson.chapter.unit.course.titleEn,
          }
        : null,
      unit: row.unit
        ? {
            title: row.unit.title,
            titleEn: row.unit.titleEn,
            courseTitle: row.unit.course.title,
            courseTitleEn: row.unit.course.titleEn,
          }
        : null,
      isOverdue: Boolean(row.dueAt && row.dueAt < now),
      isFree: row.isFree || owned.has(row.id),
      priceMinor: row.priceMinor,
      productId: row.products[0]?.id ?? null,
      isAccessible: row.isFree || owned.has(row.id),
    }));
  }

  /**
   * The questions of one attempt, in its order. Attempts made before question
   * banks existed have no stored set and used all of the exam's questions.
   */
  private async attemptQuestions(attempt: { assessmentId: string; questionIds: string[] }) {
    const include = {
      options: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
    };
    if (!attempt.questionIds.length) {
      return this.prisma.assessmentQuestion.findMany({
        where: { assessmentId: attempt.assessmentId },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include,
      });
    }
    const rows = await this.prisma.assessmentQuestion.findMany({
      where: { id: { in: attempt.questionIds } },
      include,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return attempt.questionIds.flatMap((questionId) => byId.get(questionId) ?? []);
  }

  /** What the student sees of a question: never which option is correct. */
  private presentQuestion(question: Awaited<ReturnType<typeof this.attemptQuestions>>[number]) {
    return {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      promptEn: question.promptEn,
      imageUrl: this.storage.publicUrl(question.imageKey),
      points: question.points,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        textEn: option.textEn,
      })),
    };
  }

  async getForStudent(id: string, user: AuthenticatedUser) {
    await this.assertStudentCanAccess(id, user.id);
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true } },
        drawRules: { select: { count: true } },
        attempts: {
          where: { userId: user.id },
          orderBy: { startedAt: 'desc' },
          include: { answers: true },
        },
        lesson: { select: { title: true } },
        unit: { select: { title: true } },
      },
    });
    if (!assessment) throw new NotFoundException('التقييم غير موجود');
    const active = assessment.attempts.find(
      (attempt) => attempt.status === AssessmentAttemptStatus.IN_PROGRESS,
    );
    if (active?.expiresAt && active.expiresAt <= new Date())
      await this.finalize(active.id, AssessmentAttemptStatus.TIMED_OUT);
    const latest = await this.prisma.assessmentAttempt.findFirst({
      where: { assessmentId: id, userId: user.id },
      orderBy: { startedAt: 'desc' },
    });
    if (latest && latest.status !== AssessmentAttemptStatus.IN_PROGRESS) {
      return this.review(latest.id, user.id);
    }

    const { drawRules, _count, attempts, ...details } = assessment;
    const plannedCount = _count.questions + drawRules.reduce((sum, rule) => sum + rule.count, 0);
    const base = {
      id: details.id,
      title: details.title,
      titleEn: details.titleEn,
      description: details.description,
      descriptionEn: details.descriptionEn,
      kind: details.kind,
      timeLimitMinutes: details.timeLimitMinutes,
      passingScore: details.passingScore,
      maxAttempts: details.maxAttempts,
      dueAt: details.dueAt,
      lesson: details.lesson,
      unit: details.unit,
      attemptCount: attempts.length,
      latestAttempt: attempts[0] ?? null,
    };
    // Before the start button the student sees the size of the exam, not its
    // questions: the clock has not started yet.
    if (!active) {
      return {
        ...base,
        mode: 'READY' as const,
        questionCount: plannedCount,
        questions: [],
        activeAttempt: null,
      };
    }

    const questions = await this.attemptQuestions(active);
    const ordered = details.shuffleQuestions
      ? this.shuffleStable(questions, `${active.id}:questions`)
      : questions;
    return {
      ...base,
      mode: 'ACTIVE' as const,
      questionCount: questions.length,
      questions: ordered.map((question) => {
        const shown = this.presentQuestion(question);
        return details.shuffleOptions && question.type === QuestionType.MCQ
          ? {
              ...shown,
              options: this.shuffleStable(shown.options, `${active.id}:${question.id}:options`),
            }
          : shown;
      }),
      activeAttempt: {
        id: active.id,
        expiresAt: active.expiresAt,
        answers: active.answers.map((answer) => ({
          questionId: answer.questionId,
          optionId: answer.optionId,
          text: answer.textAnswer,
        })),
      },
    };
  }

  async start(id: string, user: AuthenticatedUser) {
    await this.assertStudentCanAccess(id, user.id);
    const assessment = await this.prisma.assessment.findUniqueOrThrow({
      where: { id },
      include: {
        questions: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true } },
        drawRules: { orderBy: { sortOrder: 'asc' } },
      },
    });
    const active = await this.prisma.assessmentAttempt.findFirst({
      where: { assessmentId: id, userId: user.id, status: AssessmentAttemptStatus.IN_PROGRESS },
    });
    if (active) return this.getForStudent(id, user);
    const previous = await this.prisma.assessmentAttempt.findMany({
      where: { assessmentId: id, userId: user.id },
      select: { questionIds: true },
    });
    if (previous.length >= assessment.maxAttempts)
      throw new BadRequestException('استنفدت عدد المحاولات المتاحة');

    const questionIds = await this.drawQuestions(
      assessment.questions.map((question) => question.id),
      assessment.drawRules,
      new Set(previous.flatMap((attempt) => attempt.questionIds)),
    );
    if (!questionIds.length) throw new BadRequestException('الامتحان لسه مفيهوش أسئلة');

    const now = new Date();
    await this.prisma.assessmentAttempt.create({
      data: {
        assessmentId: id,
        userId: user.id,
        questionIds,
        expiresAt: assessment.timeLimitMinutes
          ? new Date(now.getTime() + assessment.timeLimitMinutes * 60_000)
          : null,
      },
    });
    return this.getForStudent(id, user);
  }

  /**
   * The exam's own questions plus, for each draw rule, that many random bank
   * questions. Questions this student saw in earlier attempts are used only
   * when the bank has nothing fresh left, so a retry is a genuinely new paper.
   */
  async drawQuestions(
    fixedIds: string[],
    rules: Array<{ bankId: string; difficulty: QuestionDifficulty | null; count: number }>,
    seen: Set<string> = new Set(),
  ): Promise<string[]> {
    const picked = [...fixedIds];
    for (const rule of rules) {
      const pool = await this.prisma.assessmentQuestion.findMany({
        where: {
          bankId: rule.bankId,
          archivedAt: null,
          ...(rule.difficulty ? { difficulty: rule.difficulty } : {}),
          id: { notIn: picked },
        },
        select: { id: true },
      });
      const fresh = shuffleRandom(pool.filter((row) => !seen.has(row.id)));
      const repeat = shuffleRandom(pool.filter((row) => seen.has(row.id)));
      picked.push(...[...fresh, ...repeat].slice(0, rule.count).map((row) => row.id));
    }
    return picked;
  }

  async save(id: string, user: AuthenticatedUser, answers: SubmittedAnswer[]) {
    const attempt = await this.activeAttempt(id, user.id);
    if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
      await this.finalize(attempt.id, AssessmentAttemptStatus.TIMED_OUT);
      throw new BadRequestException('انتهى وقت الامتحان وتم تسليم الإجابات المحفوظة');
    }
    await this.storeAnswers(attempt, answers);
    return { ok: true };
  }

  async submit(id: string, user: AuthenticatedUser, answers: SubmittedAnswer[]) {
    const attempt = await this.activeAttempt(id, user.id);
    await this.storeAnswers(attempt, answers);
    await this.finalize(
      attempt.id,
      attempt.expiresAt && attempt.expiresAt <= new Date()
        ? AssessmentAttemptStatus.TIMED_OUT
        : AssessmentAttemptStatus.SUBMITTED,
    );
    return this.review(attempt.id, user.id);
  }

  private async activeAttempt(assessmentId: string, userId: string) {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: { assessmentId, userId, status: AssessmentAttemptStatus.IN_PROGRESS },
    });
    if (!attempt) throw new BadRequestException('ابدأ الامتحان أولًا');
    return attempt;
  }

  /**
   * Marks choice questions at once. A written answer is stored unmarked
   * (0 points) until staff grade it.
   */
  private async storeAnswers(
    attempt: { id: string; assessmentId: string; questionIds: string[] },
    answers: SubmittedAnswer[],
  ) {
    if (!answers.length) return;
    const questions = await this.attemptQuestions(attempt);
    const map = new Map(questions.map((question) => [question.id, question]));
    const writes = answers.map((answer) => {
      const question = map.get(answer.questionId);
      if (!question) throw new BadRequestException('إحدى الإجابات غير صالحة');
      const where = { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } };
      if (question.type === QuestionType.ESSAY) {
        const text = (answer.text ?? '').trim().slice(0, ESSAY_MAX_LENGTH);
        const data = {
          textAnswer: text || null,
          optionId: null,
          isCorrect: false,
          pointsAwarded: 0,
          feedback: null,
          gradedAt: null,
          gradedById: null,
        };
        return this.prisma.assessmentAnswer.upsert({
          where,
          create: { attemptId: attempt.id, questionId: question.id, ...data },
          update: data,
        });
      }
      const option = question.options.find((item) => item.id === answer.optionId);
      if (!option) throw new BadRequestException('إحدى الإجابات غير صالحة');
      const data = {
        optionId: option.id,
        isCorrect: option.isCorrect,
        pointsAwarded: option.isCorrect ? question.points : 0,
      };
      return this.prisma.assessmentAnswer.upsert({
        where,
        create: { attemptId: attempt.id, questionId: question.id, ...data },
        update: data,
      });
    });
    await this.prisma.$transaction(writes);
  }

  private async finalize(attemptId: string, status: AssessmentAttemptStatus) {
    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status, submittedAt: new Date() },
    });
    await this.rescore(attemptId);
  }

  /**
   * Recomputes an attempt's score from its answers. Until every written
   * answer is graded the attempt is "waiting for grading": its percentage is
   * provisional, it does not pass and earns no certificate yet.
   */
  async rescore(attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { assessment: { select: { passingScore: true } }, answers: true },
    });
    const questions = await this.attemptQuestions(attempt);
    const essays = new Set(
      questions.filter((question) => question.type === QuestionType.ESSAY).map((q) => q.id),
    );
    const maxScore = questions.reduce((sum, question) => sum + question.points, 0);
    const score = attempt.answers.reduce((sum, answer) => sum + answer.pointsAwarded, 0);
    const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;
    const needsGrading = attempt.answers.some(
      (answer) => essays.has(answer.questionId) && answer.textAnswer && !answer.gradedAt,
    );
    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        score,
        maxScore,
        percentage,
        needsGrading,
        passed: !needsGrading && percentage >= attempt.assessment.passingScore,
      },
    });
    if (!needsGrading) await this.certificates.issueForAttempt(attemptId);
    return { score, maxScore, percentage, needsGrading };
  }

  private async review(attemptId: string, userId: string) {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: { id: attemptId, userId },
      include: { assessment: true, answers: { include: { option: true } } },
    });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    const questions = await this.attemptQuestions(attempt);
    const attemptsUsed = await this.prisma.assessmentAttempt.count({
      where: { assessmentId: attempt.assessmentId, userId },
    });
    const certificate = await this.prisma.certificate.findUnique({
      where: { userId_assessmentId: { userId, assessmentId: attempt.assessmentId } },
      select: { serial: true, percentage: true },
    });
    const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    return {
      mode: 'REVIEW',
      id: attempt.id,
      title: attempt.assessment.title,
      titleEn: attempt.assessment.titleEn,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percentage: attempt.percentage,
      passed: attempt.passed,
      status: attempt.status,
      needsGrading: attempt.needsGrading,
      correctCount: attempt.answers.filter((answer) => answer.isCorrect).length,
      questionCount: questions.length,
      submittedAt: attempt.submittedAt,
      attemptCount: attemptsUsed,
      maxAttempts: attempt.assessment.maxAttempts,
      certificateMinScore: attempt.assessment.certificateEnabled
        ? attempt.assessment.certificateMinScore
        : null,
      certificate,
      canRetry:
        attemptsUsed < attempt.assessment.maxAttempts &&
        (!attempt.assessment.dueAt || attempt.assessment.dueAt > new Date()),
      answers: questions.map((question) => {
        const answer = answers.get(question.id);
        const correct = question.options.find((option) => option.isCorrect);
        const graded = Boolean(answer?.gradedAt);
        return {
          questionId: question.id,
          type: question.type,
          prompt: question.prompt,
          promptEn: question.promptEn,
          imageUrl: this.storage.publicUrl(question.imageKey),
          points: question.points,
          pointsAwarded: answer?.pointsAwarded ?? 0,
          // For an essay the explanation is the model answer: shown once graded.
          explanation:
            question.type === QuestionType.ESSAY && !graded ? null : question.explanation,
          explanationEn:
            question.type === QuestionType.ESSAY && !graded ? null : question.explanationEn,
          selectedOptionId: answer?.optionId ?? null,
          selectedText: answer?.option?.text ?? null,
          selectedTextEn: answer?.option?.textEn ?? null,
          textAnswer: answer?.textAnswer ?? null,
          feedback: answer?.feedback ?? null,
          graded,
          isCorrect: answer?.isCorrect ?? false,
          correctOption:
            question.type === QuestionType.ESSAY || !correct
              ? null
              : { id: correct.id, text: correct.text, textEn: correct.textEn },
        };
      }),
    };
  }

  private async assertStudentCanAccess(id: string, userId: string) {
    const [user, assessment] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { educationSystem: true, gradeLevel: true },
      }),
      this.prisma.assessment.findUnique({
        where: { id },
        select: {
          status: true,
          availableFrom: true,
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
      }),
    ]);
    if (!assessment) throw new NotFoundException('التقييم غير موجود');
    const now = new Date();
    if (
      assessment.status !== PublishStatus.PUBLISHED ||
      (assessment.availableFrom && assessment.availableFrom > now)
    )
      throw new ForbiddenException('هذا التقييم غير متاح الآن');
    const timing = await this.prisma.assessment.findUnique({
      where: { id },
      select: { dueAt: true },
    });
    if (timing?.dueAt && timing.dueAt <= now)
      throw new ForbiddenException('انتهى موعد هذا التقييم');
    const access = await this.prisma.assessment.findUnique({
      where: { id },
      select: { isFree: true },
    });
    if (!access?.isFree) {
      const owned = await this.prisma.entitlement.findFirst({
        where: { userId, assessmentId: id, status: 'ACTIVE' },
      });
      if (!owned) throw new ForbiddenException('يجب شراء الامتحان أولًا');
    }
    const grade = assessment.lesson?.chapter.unit.course.grade ?? assessment.unit?.course.grade;
    if (
      !user ||
      !grade ||
      user.educationSystem !== grade.educationSystem ||
      user.gradeLevel !== grade.level
    )
      throw new ForbiddenException('هذا التقييم غير مخصص لصفك');
  }

  /** Deterministic per attempt: refresh/resume never rearranges the exam. */
  private shuffleStable<T>(items: T[], seedText: string): T[] {
    const result = [...items];
    let seed = 2166136261;
    for (const char of seedText) {
      seed ^= char.charCodeAt(0);
      seed = Math.imul(seed, 16777619);
    }
    const random = () => {
      seed += 0x6d2b79f5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }
}
