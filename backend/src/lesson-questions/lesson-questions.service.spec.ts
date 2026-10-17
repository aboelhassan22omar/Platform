import { ForbiddenException, HttpException } from '@nestjs/common';
import { LessonQuestionsService, shortName } from './lesson-questions.service';

const student = { id: 'asker', role: 'STUDENT' } as never;
const classmate = { id: 'classmate', role: 'STUDENT' } as never;
const teacher = { id: 'teacher', role: 'ADMIN' } as never;

const thread = (patch: Record<string, unknown> = {}) => ({
  id: 'q1',
  lessonId: 'lesson',
  userId: 'asker',
  body: 'إزاي؟',
  videoSeconds: 120,
  status: 'OPEN',
  pinned: false,
  hidden: false,
  answeredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 'asker', fullName: 'يوسف محمد علي' },
  replies: [],
  votes: [],
  _count: { votes: 0 },
  lesson: { title: 'ثورة ١٩١٩' },
  ...patch,
});

const setup = (row = thread(), opts: { askedToday?: number; access?: boolean } = {}) => {
  const tx = {
    lessonQuestionReply: { create: jest.fn() },
    lessonQuestion: { update: jest.fn() },
  };
  const prisma = {
    lessonQuestion: {
      findUnique: jest.fn(async () => row),
      findUniqueOrThrow: jest.fn(async () => row),
      count: jest.fn(async () => opts.askedToday ?? 0),
      create: jest.fn(async () => row),
      update: jest.fn(),
      delete: jest.fn(),
    },
    lessonQuestionVote: {
      findMany: jest.fn(async () => [{ userId: 'classmate' }]),
      findUnique: jest.fn(async () => null),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(async () => 1),
    },
    notification: { createMany: jest.fn() },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const entitlements = {
    checkLessonAccess: jest.fn(async () =>
      opts.access === false ? { allowed: false, reason: 'NOT_PURCHASED' } : { allowed: true },
    ),
  };
  const messages = { questionAnswered: jest.fn(async () => 1) };
  const service = new LessonQuestionsService(
    prisma as never,
    entitlements as never,
    messages as never,
  );
  return { service, prisma, tx, messages };
};

describe('Lesson Q&A', () => {
  it('shows classmates a short name only', () => {
    expect(shortName('يوسف محمد علي')).toBe('يوسف م.');
    expect(shortName('يوسف')).toBe('يوسف');
  });

  it('keeps students who cannot watch the lesson out of its Q&A', async () => {
    const { service } = setup(thread(), { access: false });
    await expect(service.list(student, 'lesson', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.ask(student, 'lesson', { body: 'سؤال' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('limits how many questions a student asks per day', async () => {
    const { service } = setup(thread(), { askedToday: 15 });
    await expect(service.ask(student, 'lesson', { body: 'سؤال جديد' })).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('a teacher reply answers the question and tells the asker and everyone with the same question', async () => {
    const { service, tx, prisma, messages } = setup();
    await service.reply(teacher, 'q1', 'الإجابة كذا');
    expect(tx.lessonQuestionReply.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromStaff: true }),
    });
    expect(tx.lessonQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ANSWERED' }) }),
    );
    const notified = (
      prisma.notification.createMany.mock.calls[0][0] as { data: Array<{ userId: string }> }
    ).data;
    expect(notified.map((row) => row.userId).sort()).toEqual(['asker', 'classmate']);
    expect(messages.questionAnswered).toHaveBeenCalledTimes(1);
  });

  it('only the asker may add to their thread; their follow-up reopens it', async () => {
    const { service } = setup();
    await expect(service.reply(classmate, 'q1', 'وأنا كمان')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const answered = setup(thread({ status: 'ANSWERED' }));
    await answered.service.reply(student, 'q1', 'طب وليه؟');
    expect(answered.tx.lessonQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'OPEN' } }),
    );
    expect(answered.messages.questionAnswered).not.toHaveBeenCalled();
  });

  it('"same question" toggles, but not on your own question', async () => {
    const { service, prisma } = setup();
    expect(await service.vote(classmate, 'q1')).toEqual({ votedByMe: true, votes: 1 });
    expect(prisma.lessonQuestionVote.create).toHaveBeenCalled();
    await expect(service.vote(student, 'q1')).rejects.toThrow('ده سؤالك أصلًا');
  });

  it('an answered question removed by its asker is hidden, not deleted', async () => {
    const { service, prisma } = setup(
      thread({
        replies: [
          {
            id: 'r1',
            fromStaff: true,
            body: 'x',
            user: { id: 'teacher', fullName: 'المستر' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
    );
    expect(await service.remove(student, 'q1')).toEqual({ hidden: true });
    expect(prisma.lessonQuestion.delete).not.toHaveBeenCalled();
  });
});
