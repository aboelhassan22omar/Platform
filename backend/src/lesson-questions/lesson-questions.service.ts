import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { LessonQuestionStatus, Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { EntitlementsService, ACCESS_MESSAGES } from '../entitlements/entitlements.service';
import { MessageProducersService } from '../messaging/message-producers.service';
import type { AuthenticatedUser } from '../common/decorators';

/** Questions a student may ask per day, across all lessons. */
const DAILY_QUESTION_LIMIT = 15;
const PAGE_SIZE = 20;

/** "يوسف م." — enough to recognise a classmate without exposing full names. */
export const shortName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[1].charAt(0)}.`;
};

const isStaff = (user: { role: Role | string }) => user.role !== Role.STUDENT;

const threadInclude = (viewerId: string) =>
  ({
    user: { select: { id: true, fullName: true } },
    replies: {
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        fromStaff: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, fullName: true } },
      },
    },
    votes: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { votes: true } },
  }) satisfies Prisma.LessonQuestionInclude;

type Thread = Prisma.LessonQuestionGetPayload<{ include: ReturnType<typeof threadInclude> }>;

/**
 * Questions and answers under each lesson. A student asks; the teacher or an
 * assistant answers; everyone who can watch the lesson reads the thread and
 * can say "I have the same question", which tells the teacher what matters.
 */
@Injectable()
export class LessonQuestionsService {
  private readonly logger = new Logger(LessonQuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly messages: MessageProducersService,
  ) {}

  /** Same rule as watching: only people who can open the lesson join its Q&A. */
  private async assertLessonAccess(user: AuthenticatedUser, lessonId: string) {
    const decision = await this.entitlements.checkLessonAccess(user.id, lessonId, {
      isStaff: isStaff(user),
    });
    if (!decision.allowed) throw new ForbiddenException(ACCESS_MESSAGES[decision.reason]);
  }

  private present(thread: Thread, viewer: AuthenticatedUser) {
    const staffView = isStaff(viewer);
    return {
      id: thread.id,
      lessonId: thread.lessonId,
      body: thread.body,
      videoSeconds: thread.videoSeconds,
      status: thread.status,
      pinned: thread.pinned,
      hidden: thread.hidden,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      author: staffView ? thread.user.fullName : shortName(thread.user.fullName),
      authorId: staffView ? thread.user.id : undefined,
      mine: thread.userId === viewer.id,
      votes: thread._count.votes,
      votedByMe: thread.votes.length > 0,
      replies: thread.replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        fromStaff: reply.fromStaff,
        createdAt: reply.createdAt,
        edited: reply.updatedAt.getTime() - reply.createdAt.getTime() > 1000,
        // Staff answer under their own name; students under a short one.
        author: reply.fromStaff || staffView ? reply.user.fullName : shortName(reply.user.fullName),
        mine: reply.user.id === viewer.id,
      })),
    };
  }

  async list(
    viewer: AuthenticatedUser,
    lessonId: string,
    opts: { sort?: string; filter?: string; page?: number },
  ) {
    await this.assertLessonAccess(viewer, lessonId);
    const page = Math.max(opts.page ?? 1, 1);
    const where: Prisma.LessonQuestionWhereInput = {
      lessonId,
      ...(isStaff(viewer) ? {} : { OR: [{ hidden: false }, { userId: viewer.id }] }),
      ...(opts.filter === 'mine' ? { userId: viewer.id } : {}),
      ...(opts.filter === 'open' ? { status: LessonQuestionStatus.OPEN } : {}),
    };
    const orderBy: Prisma.LessonQuestionOrderByWithRelationInput[] =
      opts.sort === 'top'
        ? [{ pinned: 'desc' }, { votes: { _count: 'desc' } }, { createdAt: 'desc' }]
        : [{ pinned: 'desc' }, { createdAt: 'desc' }];
    const [rows, total, open] = await Promise.all([
      this.prisma.lessonQuestion.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: threadInclude(viewer.id),
      }),
      this.prisma.lessonQuestion.count({ where }),
      this.prisma.lessonQuestion.count({
        where: { lessonId, hidden: false, status: LessonQuestionStatus.OPEN },
      }),
    ]);
    return {
      items: rows.map((row) => this.present(row, viewer)),
      total,
      open,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async ask(
    viewer: AuthenticatedUser,
    lessonId: string,
    input: { body: string; videoSeconds?: number },
  ) {
    await this.assertLessonAccess(viewer, lessonId);
    const body = input.body.trim();
    if (body.length < 3) throw new BadRequestException('اكتب سؤالك بوضوح');
    if (!isStaff(viewer)) {
      const today = await this.prisma.lessonQuestion.count({
        where: { userId: viewer.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      });
      if (today >= DAILY_QUESTION_LIMIT) {
        throw new HttpException(
          { message: 'وصلت لأقصى عدد أسئلة النهارده. كمّل بكرة أو رد على أسئلتك القديمة.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    const created = await this.prisma.lessonQuestion.create({
      data: {
        lessonId,
        userId: viewer.id,
        body,
        videoSeconds: input.videoSeconds ?? null,
      },
      include: threadInclude(viewer.id),
    });
    return this.present(created, viewer);
  }

  private async thread(id: string, viewer: AuthenticatedUser) {
    const thread = await this.prisma.lessonQuestion.findUnique({
      where: { id },
      include: { ...threadInclude(viewer.id), lesson: { select: { title: true } } },
    });
    if (!thread || (thread.hidden && !isStaff(viewer) && thread.userId !== viewer.id)) {
      throw new NotFoundException('السؤال غير موجود');
    }
    await this.assertLessonAccess(viewer, thread.lessonId);
    return thread;
  }

  /** The asker may fix their question until it is answered. */
  async edit(viewer: AuthenticatedUser, id: string, body: string) {
    const thread = await this.thread(id, viewer);
    if (thread.userId !== viewer.id) throw new ForbiddenException('مش سؤالك');
    if (thread.replies.some((reply) => reply.fromStaff)) {
      throw new BadRequestException('السؤال اتجاوب عليه، مينفعش يتعدل');
    }
    const updated = await this.prisma.lessonQuestion.update({
      where: { id },
      data: { body: body.trim() },
      include: threadInclude(viewer.id),
    });
    return this.present(updated, viewer);
  }

  /** The asker removes their own question; staff hide instead (see moderate). */
  async remove(viewer: AuthenticatedUser, id: string) {
    const thread = await this.thread(id, viewer);
    if (thread.userId !== viewer.id) throw new ForbiddenException('مش سؤالك');
    if (thread.replies.some((reply) => reply.fromStaff)) {
      // Others may be relying on the answer: hide it rather than lose it.
      await this.prisma.lessonQuestion.update({ where: { id }, data: { hidden: true } });
      return { hidden: true };
    }
    await this.prisma.lessonQuestion.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Staff answer any question; a student may add to their own thread (a
   * follow-up or "thanks, understood"). A staff reply marks the question
   * answered and tells the asker and everyone who had the same question.
   */
  async reply(viewer: AuthenticatedUser, id: string, body: string) {
    const thread = await this.thread(id, viewer);
    const staff = isStaff(viewer);
    if (!staff && thread.userId !== viewer.id) {
      throw new ForbiddenException('تقدر ترد على أسئلتك بس، والمستر بيرد على الكل');
    }
    const text = body.trim();
    if (!text) throw new BadRequestException('اكتب ردك');
    const firstAnswer = staff && thread.status === LessonQuestionStatus.OPEN;
    await this.prisma.$transaction(async (tx) => {
      await tx.lessonQuestionReply.create({
        data: { questionId: id, userId: viewer.id, body: text, fromStaff: staff },
      });
      if (staff) {
        await tx.lessonQuestion.update({
          where: { id },
          data: {
            status: LessonQuestionStatus.ANSWERED,
            answeredAt: thread.answeredAt ?? new Date(),
          },
        });
      } else if (thread.status === LessonQuestionStatus.ANSWERED) {
        // A follow-up from the asker reopens the thread for the teacher.
        await tx.lessonQuestion.update({
          where: { id },
          data: { status: LessonQuestionStatus.OPEN },
        });
      }
    });
    if (staff) await this.notifyAnswered(thread, viewer.id, firstAnswer);
    return this.present(
      await this.prisma.lessonQuestion.findUniqueOrThrow({
        where: { id },
        include: threadInclude(viewer.id),
      }),
      viewer,
    );
  }

  private async notifyAnswered(
    thread: { id: string; userId: string; lessonId: string; lesson: { title: string } },
    replierId: string,
    firstAnswer: boolean,
  ) {
    const voters = await this.prisma.lessonQuestionVote.findMany({
      where: { questionId: thread.id },
      select: { userId: true },
    });
    const recipients = [...new Set([thread.userId, ...voters.map((vote) => vote.userId)])].filter(
      (userId) => userId !== replierId,
    );
    if (recipients.length) {
      await this.prisma.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          kind: 'CONTENT' as const,
          title: userId === thread.userId ? 'المستر رد على سؤالك ✍️' : 'اتجاوب على سؤال كان عندك',
          body: `في حصة «${thread.lesson.title}».`,
          href: `/lessons/${thread.lessonId}?question=${thread.id}`,
        })),
      });
    }
    if (firstAnswer && thread.userId !== replierId) {
      await this.messages
        .questionAnswered({
          id: thread.id,
          userId: thread.userId,
          lessonId: thread.lessonId,
          lessonTitle: thread.lesson.title,
        })
        .catch((error: Error) => this.logger.warn(`WhatsApp for answer skipped: ${error.message}`));
    }
  }

  /** "I have the same question" — toggles. */
  async vote(viewer: AuthenticatedUser, id: string) {
    const thread = await this.thread(id, viewer);
    if (thread.userId === viewer.id) throw new BadRequestException('ده سؤالك أصلًا');
    const key = { questionId_userId: { questionId: id, userId: viewer.id } };
    const existing = await this.prisma.lessonQuestionVote.findUnique({ where: key });
    if (existing) await this.prisma.lessonQuestionVote.delete({ where: key });
    else
      await this.prisma.lessonQuestionVote.create({ data: { questionId: id, userId: viewer.id } });
    const votes = await this.prisma.lessonQuestionVote.count({ where: { questionId: id } });
    return { votedByMe: !existing, votes };
  }

  // --------------------------------------------------------------------------
  // Staff
  // --------------------------------------------------------------------------

  /** Everything students asked, newest or most wanted first. */
  async inbox(
    viewer: AuthenticatedUser,
    opts: { status?: string; courseId?: string; search?: string; page?: number },
  ) {
    const page = Math.max(opts.page ?? 1, 1);
    const term = opts.search?.trim();
    const where: Prisma.LessonQuestionWhereInput = {
      ...(opts.status === 'open'
        ? { status: LessonQuestionStatus.OPEN, hidden: false }
        : opts.status === 'answered'
          ? { status: LessonQuestionStatus.ANSWERED }
          : opts.status === 'hidden'
            ? { hidden: true }
            : {}),
      ...(opts.courseId ? { lesson: { chapter: { unit: { courseId: opts.courseId } } } } : {}),
      ...(term
        ? {
            OR: [
              { body: { contains: term, mode: 'insensitive' } },
              { user: { fullName: { contains: term, mode: 'insensitive' } } },
              { lesson: { title: { contains: term, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total, open] = await Promise.all([
      this.prisma.lessonQuestion.findMany({
        where,
        // Open questions: oldest first, so nobody waits forever; else newest.
        orderBy:
          opts.status === 'open'
            ? [{ votes: { _count: 'desc' } }, { createdAt: 'asc' }]
            : [{ createdAt: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          ...threadInclude(viewer.id),
          lesson: {
            select: {
              id: true,
              title: true,
              chapter: { select: { unit: { select: { course: { select: { title: true } } } } } },
            },
          },
        },
      }),
      this.prisma.lessonQuestion.count({ where }),
      this.prisma.lessonQuestion.count({
        where: { status: LessonQuestionStatus.OPEN, hidden: false },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        ...this.present(row, viewer),
        lesson: {
          id: row.lesson.id,
          title: row.lesson.title,
          courseTitle: row.lesson.chapter.unit.course.title,
        },
      })),
      total,
      open,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async moderate(id: string, patch: { pinned?: boolean; hidden?: boolean }) {
    const exists = await this.prisma.lessonQuestion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('السؤال غير موجود');
    await this.prisma.lessonQuestion.update({
      where: { id },
      data: {
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
        ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}),
      },
    });
    return { ok: true };
  }

  /** Staff remove a reply (their own wording, or a student's off-topic one). */
  async removeReply(viewer: AuthenticatedUser, replyId: string) {
    const reply = await this.prisma.lessonQuestionReply.findUnique({
      where: { id: replyId },
      select: { id: true, userId: true, questionId: true },
    });
    if (!reply) throw new NotFoundException('الرد غير موجود');
    if (!isStaff(viewer) && reply.userId !== viewer.id) throw new ForbiddenException('مش ردّك');
    await this.prisma.lessonQuestionReply.delete({ where: { id: replyId } });
    // With no staff answer left, the question is open again.
    const staffReplies = await this.prisma.lessonQuestionReply.count({
      where: { questionId: reply.questionId, fromStaff: true },
    });
    if (!staffReplies) {
      await this.prisma.lessonQuestion.update({
        where: { id: reply.questionId },
        data: { status: LessonQuestionStatus.OPEN, answeredAt: null },
      });
    }
    return { ok: true };
  }
}
