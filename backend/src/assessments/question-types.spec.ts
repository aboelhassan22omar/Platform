import { BadRequestException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { normalizeQuestion, type QuestionDto } from './question.dto';

const question = (patch: Partial<QuestionDto>): QuestionDto => ({
  prompt: 'سؤال تجريبي',
  points: 2,
  options: [],
  ...patch,
});

describe('Question types', () => {
  it('stores true/false as the same two options whatever the client sent', () => {
    const normalized = normalizeQuestion(
      question({
        type: 'TRUE_FALSE',
        options: [
          { text: 'x', isCorrect: false },
          { text: 'y', isCorrect: true },
        ],
      }),
      0,
    );
    expect(normalized.options).toEqual([
      { text: 'صح', textEn: 'True', isCorrect: false },
      { text: 'غلط', textEn: 'False', isCorrect: true },
    ]);
  });

  it('keeps no options for an essay and requires exactly one correct choice for MCQ', () => {
    expect(
      normalizeQuestion(question({ type: 'ESSAY', options: [{ text: 'a', isCorrect: true }] }), 0)
        .options,
    ).toEqual([]);
    expect(() =>
      normalizeQuestion(
        question({
          options: [
            { text: 'a', isCorrect: true },
            { text: 'b', isCorrect: true },
          ],
        }),
        4,
      ),
    ).toThrow('السؤال رقم 5');
    expect(() => normalizeQuestion(question({ type: 'TRUE_FALSE', options: [] }), 0)).toThrow(
      BadRequestException,
    );
  });
});

/** Builds the service with only what drawQuestions and rescore touch. */
const service = (prisma: Record<string, unknown>, certificates = { issueForAttempt: jest.fn() }) =>
  new AssessmentsService(
    prisma as never,
    certificates as never,
    { publicUrl: () => null } as never,
  );

describe('Random draws from a bank', () => {
  const bank = Array.from({ length: 30 }, (_, index) => ({ id: `q${index}` }));
  const prisma = {
    assessmentQuestion: {
      findMany: jest.fn(async ({ where }: { where: { id: { notIn: string[] } } }) =>
        bank.filter((row) => !where.id.notIn.includes(row.id)),
      ),
    },
  };

  it('adds the requested number of distinct questions after the fixed ones', async () => {
    const ids = await service(prisma).drawQuestions(
      ['fixed1'],
      [{ bankId: 'bank', difficulty: null, count: 10 }],
    );
    expect(ids[0]).toBe('fixed1');
    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(11);
  });

  it('gives a different paper each time', async () => {
    const draws = await Promise.all(
      Array.from({ length: 5 }, () =>
        service(prisma).drawQuestions([], [{ bankId: 'bank', difficulty: 'HARD', count: 10 }]),
      ),
    );
    expect(new Set(draws.map((ids) => [...ids].sort().join())).size).toBeGreaterThan(1);
  });

  it('prefers questions the student has not seen in earlier attempts', async () => {
    const seen = new Set(bank.slice(0, 20).map((row) => row.id));
    const ids = await service(prisma).drawQuestions(
      [],
      [{ bankId: 'bank', difficulty: null, count: 10 }],
      seen,
    );
    expect(ids.every((id) => !seen.has(id))).toBe(true);
  });
});

describe('Essay grading', () => {
  const setup = (answers: Array<Record<string, unknown>>) => {
    const update = jest.fn();
    const prisma = {
      assessmentAttempt: {
        findUniqueOrThrow: jest.fn(async () => ({
          id: 'attempt',
          assessmentId: 'exam',
          questionIds: ['mcq', 'essay'],
          assessment: { passingScore: 50 },
          answers,
        })),
        update,
      },
      assessmentQuestion: {
        findMany: jest.fn(async () => [
          { id: 'mcq', type: 'MCQ', points: 2, options: [] },
          { id: 'essay', type: 'ESSAY', points: 8, options: [] },
        ]),
      },
    };
    const certificates = { issueForAttempt: jest.fn() };
    return { svc: service(prisma, certificates), update, certificates };
  };

  it('waits for the grader: no pass and no certificate until the essay is marked', async () => {
    const { svc, update, certificates } = setup([
      { questionId: 'mcq', pointsAwarded: 2 },
      { questionId: 'essay', pointsAwarded: 0, textAnswer: 'إجابتي', gradedAt: null },
    ]);
    expect(await svc.rescore('attempt')).toMatchObject({ needsGrading: true, percentage: 20 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passed: false, needsGrading: true }),
      }),
    );
    expect(certificates.issueForAttempt).not.toHaveBeenCalled();
  });

  it('finalises once graded', async () => {
    const { svc, update, certificates } = setup([
      { questionId: 'mcq', pointsAwarded: 2 },
      { questionId: 'essay', pointsAwarded: 6, textAnswer: 'إجابتي', gradedAt: new Date() },
    ]);
    expect(await svc.rescore('attempt')).toMatchObject({ needsGrading: false, percentage: 80 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passed: true }) }),
    );
    expect(certificates.issueForAttempt).toHaveBeenCalledWith('attempt');
  });

  it('a blank essay needs no grader: it simply scores zero', async () => {
    const { svc } = setup([{ questionId: 'mcq', pointsAwarded: 2 }]);
    expect(await svc.rescore('attempt')).toMatchObject({ needsGrading: false, percentage: 20 });
  });
});
