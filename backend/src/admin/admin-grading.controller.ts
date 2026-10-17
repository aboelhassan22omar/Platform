import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionType, Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { AssessmentsService } from '../assessments/assessments.service';

class EssayGradeDto {
  @IsString() questionId!: string;
  @IsInt() @Min(0) @Max(100) points!: number;
  @IsOptional() @IsString() @MaxLength(1000) feedback?: string;
}

class GradeAttemptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EssayGradeDto)
  grades!: EssayGradeDto[];
}

/**
 * Written answers waiting for a teacher or an assistant. Grading the last
 * one finalises the result: pass/fail, certificate and a notification.
 */
@ApiTags('admin')
@Roles(Role.SUPPORT)
@Controller('admin/grading')
export class AdminGradingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly assessments: AssessmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'الإجابات المقالية اللي مستنية تصحيح' })
  async queue(@Query('status') status = 'pending', @Query('page') page = '1') {
    const take = 30;
    const currentPage = Math.max(Number(page) || 1, 1);
    const where = {
      submittedAt: { not: null },
      ...(status === 'graded'
        ? { needsGrading: false, gradedAt: { not: null } }
        : { needsGrading: true }),
    };
    const [rows, total, pending] = await Promise.all([
      this.prisma.assessmentAttempt.findMany({
        where,
        // Oldest first for the to-do list, newest first for history.
        orderBy: status === 'graded' ? { gradedAt: 'desc' } : { submittedAt: 'asc' },
        skip: (currentPage - 1) * take,
        take,
        select: {
          id: true,
          submittedAt: true,
          gradedAt: true,
          percentage: true,
          user: { select: { id: true, fullName: true } },
          assessment: { select: { id: true, title: true, kind: true } },
          answers: {
            where: { question: { type: QuestionType.ESSAY }, textAnswer: { not: null } },
            select: { gradedAt: true },
          },
        },
      }),
      this.prisma.assessmentAttempt.count({ where }),
      this.prisma.assessmentAttempt.count({
        where: { needsGrading: true, submittedAt: { not: null } },
      }),
    ]);
    return {
      items: rows.map(({ answers, ...row }) => ({
        ...row,
        essays: answers.length,
        ungraded: answers.filter((answer) => !answer.gradedAt).length,
      })),
      total,
      pending,
      page: currentPage,
      pageSize: take,
    };
  }

  @Get(':attemptId')
  async detail(@Param('attemptId') attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        submittedAt: true,
        needsGrading: true,
        score: true,
        maxScore: true,
        percentage: true,
        user: { select: { fullName: true } },
        assessment: { select: { title: true } },
        answers: {
          where: { question: { type: QuestionType.ESSAY } },
          select: {
            questionId: true,
            textAnswer: true,
            pointsAwarded: true,
            feedback: true,
            gradedAt: true,
            question: {
              select: {
                prompt: true,
                imageKey: true,
                explanation: true,
                points: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });
    if (!attempt?.submittedAt) throw new NotFoundException('المحاولة غير موجودة');
    const { answers, ...rest } = attempt;
    return {
      ...rest,
      essays: answers
        .filter((answer) => answer.textAnswer)
        .map(({ question, ...answer }) => ({
          ...answer,
          prompt: question.prompt,
          imageUrl: this.storage.publicUrl(question.imageKey),
          modelAnswer: question.explanation,
          maxPoints: question.points,
        })),
    };
  }

  @Post(':attemptId')
  async grade(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: GradeAttemptDto,
  ) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        userId: true,
        submittedAt: true,
        assessmentId: true,
        assessment: { select: { title: true } },
        answers: {
          where: { question: { type: QuestionType.ESSAY } },
          select: {
            id: true,
            questionId: true,
            textAnswer: true,
            question: { select: { points: true } },
          },
        },
      },
    });
    if (!attempt?.submittedAt) throw new NotFoundException('المحاولة غير موجودة');
    const byQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const now = new Date();
    const writes = dto.grades.map((grade) => {
      const answer = byQuestion.get(grade.questionId);
      if (!answer?.textAnswer) throw new BadRequestException('إجابة مش موجودة في المحاولة دي');
      if (grade.points > answer.question.points)
        throw new BadRequestException(`أقصى درجة للسؤال ده ${answer.question.points}`);
      return this.prisma.assessmentAnswer.update({
        where: { id: answer.id },
        data: {
          pointsAwarded: grade.points,
          isCorrect: grade.points >= answer.question.points,
          feedback: grade.feedback?.trim() || null,
          gradedAt: now,
          gradedById: actor.id,
        },
      });
    });
    await this.prisma.$transaction(writes);

    const result = await this.assessments.rescore(attemptId);
    if (!result.needsGrading) {
      await this.prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: { gradedAt: now, gradedById: actor.id },
      });
      await this.prisma.notification.create({
        data: {
          userId: attempt.userId,
          kind: 'CONTENT',
          title: 'اتصحّح امتحانك ✍️',
          body: `نتيجتك في «${attempt.assessment.title}»: ${result.percentage}٪.`,
          href: `/dashboard/assessments/${attempt.assessmentId}`,
        },
      });
    }
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'assessment.attempt.graded',
      entityType: 'AssessmentAttempt',
      entityId: attemptId,
      targetUserId: attempt.userId,
      metadata: {
        graded: dto.grades.length,
        percentage: result.percentage,
        complete: !result.needsGrading,
      },
    });
    return result;
  }
}
