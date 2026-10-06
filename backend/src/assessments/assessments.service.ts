import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentAttemptStatus, PublishStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators';

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

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
        attempts: {
          where: {
            userId: user.id,
            status: { in: [AssessmentAttemptStatus.SUBMITTED, AssessmentAttemptStatus.TIMED_OUT] },
          },
          orderBy: { submittedAt: 'desc' },
          select: { id: true, percentage: true, passed: true, submittedAt: true },
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
      maxAttempts: row.maxAttempts,
      shuffleQuestions: row.shuffleQuestions,
      shuffleOptions: row.shuffleOptions,
      availableFrom: row.availableFrom,
      dueAt: row.dueAt,
      questionCount: row._count.questions,
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

  async getForStudent(id: string, user: AuthenticatedUser) {
    await this.assertStudentCanAccess(id, user.id);
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            prompt: true,
            promptEn: true,
            points: true,
            sortOrder: true,
            options: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: { id: true, text: true, textEn: true, sortOrder: true },
            },
          },
        },
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
    const shuffleKey = active?.id ?? `${user.id}:${assessment.id}:ready`;
    const questions = assessment.shuffleQuestions
      ? this.shuffleStable(assessment.questions, `${shuffleKey}:questions`)
      : assessment.questions;
    return {
      ...assessment,
      questions: questions.map((question) => ({
        ...question,
        options: assessment.shuffleOptions
          ? this.shuffleStable(question.options, `${shuffleKey}:${question.id}:options`)
          : question.options,
      })),
      mode: active ? 'ACTIVE' : 'READY',
      activeAttempt: active
        ? {
            id: active.id,
            expiresAt: active.expiresAt,
            answers: active.answers.map((answer) => ({
              questionId: answer.questionId,
              optionId: answer.optionId,
            })),
          }
        : null,
      attemptCount: assessment.attempts.length,
      latestAttempt: assessment.attempts[0] ?? null,
    };
  }

  async start(id: string, user: AuthenticatedUser) {
    await this.assertStudentCanAccess(id, user.id);
    const assessment = await this.prisma.assessment.findUniqueOrThrow({
      where: { id },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    const active = await this.prisma.assessmentAttempt.findFirst({
      where: { assessmentId: id, userId: user.id, status: AssessmentAttemptStatus.IN_PROGRESS },
    });
    if (active) return this.getForStudent(id, user);
    const used = await this.prisma.assessmentAttempt.count({
      where: { assessmentId: id, userId: user.id },
    });
    if (used >= assessment.maxAttempts)
      throw new BadRequestException('استنفدت عدد المحاولات المتاحة');
    const now = new Date();
    await this.prisma.assessmentAttempt.create({
      data: {
        assessmentId: id,
        userId: user.id,
        expiresAt: assessment.timeLimitMinutes
          ? new Date(now.getTime() + assessment.timeLimitMinutes * 60_000)
          : null,
      },
    });
    return this.getForStudent(id, user);
  }

  async save(
    id: string,
    user: AuthenticatedUser,
    answers: Array<{ questionId: string; optionId: string }>,
  ) {
    const attempt = await this.activeAttempt(id, user.id);
    if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
      await this.finalize(attempt.id, AssessmentAttemptStatus.TIMED_OUT);
      throw new BadRequestException('انتهى وقت الامتحان وتم تسليم الإجابات المحفوظة');
    }
    await this.storeAnswers(attempt.id, id, answers);
    return { ok: true };
  }

  async submit(
    id: string,
    user: AuthenticatedUser,
    answers: Array<{ questionId: string; optionId: string }>,
  ) {
    const attempt = await this.activeAttempt(id, user.id);
    await this.storeAnswers(attempt.id, id, answers);
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

  private async storeAnswers(
    attemptId: string,
    assessmentId: string,
    answers: Array<{ questionId: string; optionId: string }>,
  ) {
    const questions = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId },
      include: { options: true },
    });
    const map = new Map(questions.map((q) => [q.id, q]));
    await this.prisma.$transaction(
      answers.map((answer) => {
        const question = map.get(answer.questionId);
        const option = question?.options.find((item) => item.id === answer.optionId);
        if (!question || !option) throw new BadRequestException('إحدى الإجابات غير صالحة');
        return this.prisma.assessmentAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: question.id } },
          create: {
            attemptId,
            questionId: question.id,
            optionId: option.id,
            isCorrect: option.isCorrect,
            pointsAwarded: option.isCorrect ? question.points : 0,
          },
          update: {
            optionId: option.id,
            isCorrect: option.isCorrect,
            pointsAwarded: option.isCorrect ? question.points : 0,
          },
        });
      }),
    );
  }

  private async finalize(attemptId: string, status: AssessmentAttemptStatus) {
    const attempt = await this.prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { assessment: { include: { questions: true } }, answers: true },
    });
    const maxScore = attempt.assessment.questions.reduce((sum, q) => sum + q.points, 0),
      score = attempt.answers.reduce((sum, a) => sum + a.pointsAwarded, 0),
      percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;
    await this.prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        status,
        score,
        maxScore,
        percentage,
        passed: percentage >= attempt.assessment.passingScore,
        submittedAt: new Date(),
      },
    });
  }

  private async review(attemptId: string, userId: string) {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        assessment: {
          include: {
            questions: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: { options: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
            },
          },
        },
        answers: { include: { option: true } },
      },
    });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    const attemptsUsed = await this.prisma.assessmentAttempt.count({
      where: { assessmentId: attempt.assessmentId, userId },
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
      correctCount: attempt.answers.filter((answer) => answer.isCorrect).length,
      questionCount: attempt.assessment.questions.length,
      submittedAt: attempt.submittedAt,
      attemptCount: attemptsUsed,
      maxAttempts: attempt.assessment.maxAttempts,
      canRetry:
        attemptsUsed < attempt.assessment.maxAttempts &&
        (!attempt.assessment.dueAt || attempt.assessment.dueAt > new Date()),
      answers: attempt.assessment.questions.map((question) => {
        const answer = answers.get(question.id);
        const correct = question.options.find((option) => option.isCorrect);
        return {
          questionId: question.id,
          prompt: question.prompt,
          promptEn: question.promptEn,
          explanation: question.explanation,
          explanationEn: question.explanationEn,
          selectedOptionId: answer?.optionId ?? null,
          selectedText: answer?.option?.text ?? null,
          selectedTextEn: answer?.option?.textEn ?? null,
          isCorrect: answer?.isCorrect ?? false,
          correctOption: correct
            ? { id: correct.id, text: correct.text, textEn: correct.textEn }
            : null,
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
