import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { QuestionDifficulty, QuestionType, Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { QuestionDto, normalizeQuestion, optionRows } from '../assessments/question.dto';

class BankDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsString() courseId!: string;
  @IsOptional() @IsString() unitId?: string | null;
}

class AddQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}

/**
 * Question banks: one pool of questions per course (or unit) that exams draw
 * from at random. A question that was already answered by a student is never
 * changed or deleted, only hidden, so past results keep their meaning.
 */
@ApiTags('admin')
@Roles(Role.CONTENT_MANAGER)
@Controller('admin/question-banks')
export class AdminQuestionBanksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'بنوك الأسئلة' })
  async list() {
    const [banks, counts] = await Promise.all([
      this.prisma.questionBank.findMany({
        orderBy: [{ course: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          courseId: true,
          unitId: true,
          course: { select: { title: true, grade: { select: { nameAr: true } } } },
          unit: { select: { title: true } },
          _count: { select: { drawRules: true } },
        },
      }),
      this.prisma.assessmentQuestion.groupBy({
        by: ['bankId', 'difficulty'],
        where: { bankId: { not: null }, archivedAt: null },
        _count: true,
      }),
    ]);
    return banks.map(({ _count, ...bank }) => {
      const byDifficulty = Object.fromEntries(
        Object.values(QuestionDifficulty).map((difficulty) => [
          difficulty,
          counts.find((row) => row.bankId === bank.id && row.difficulty === difficulty)?._count ??
            0,
        ]),
      ) as Record<QuestionDifficulty, number>;
      return {
        ...bank,
        usedByExams: _count.drawRules,
        counts: byDifficulty,
        total: Object.values(byDifficulty).reduce((sum, value) => sum + value, 0),
      };
    });
  }

  @Post()
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: BankDto) {
    await this.assertPlacement(dto);
    const bank = await this.prisma.questionBank.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        courseId: dto.courseId,
        unitId: dto.unitId || null,
      },
    });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'question_bank.create',
      entityType: 'QuestionBank',
      entityId: bank.id,
      metadata: { title: bank.title },
    });
    return bank;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: BankDto) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      select: { courseId: true },
    });
    if (!bank) throw new NotFoundException('بنك الأسئلة غير موجود');
    if (bank.courseId !== dto.courseId)
      throw new BadRequestException('مينفعش تنقل البنك لكورس تاني، اعمل بنك جديد');
    await this.assertPlacement(dto);
    return this.prisma.questionBank.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        unitId: dto.unitId || null,
      },
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      select: { title: true, _count: { select: { drawRules: true } } },
    });
    if (!bank) throw new NotFoundException('بنك الأسئلة غير موجود');
    if (bank._count.drawRules)
      throw new BadRequestException('البنك ده مستخدم في امتحانات. شيله من الامتحانات الأول.');
    const answered = await this.prisma.assessmentAnswer.count({
      where: { question: { bankId: id } },
    });
    if (answered)
      throw new BadRequestException(
        'أسئلة البنك ده اتحلّت قبل كده، فمينفعش يتمسح عشان نتايج الطلاب.',
      );
    await this.prisma.questionBank.delete({ where: { id } });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'question_bank.delete',
      entityType: 'QuestionBank',
      entityId: id,
      metadata: { title: bank.title },
    });
    return { ok: true };
  }

  // --------------------------------------------------------------------------
  // Questions
  // --------------------------------------------------------------------------

  @Get(':id/questions')
  async questions(
    @Param('id') id: string,
    @Query('difficulty') difficulty?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
  ) {
    const take = 25;
    const currentPage = Math.max(Number(page) || 1, 1);
    const where: Prisma.AssessmentQuestionWhereInput = {
      bankId: id,
      archivedAt: null,
      ...(difficulty && difficulty in QuestionDifficulty
        ? { difficulty: difficulty as QuestionDifficulty }
        : {}),
      ...(type && type in QuestionType ? { type: type as QuestionType } : {}),
      ...(search?.trim() ? { prompt: { contains: search.trim(), mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.assessmentQuestion.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (currentPage - 1) * take,
        take,
        include: {
          options: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { answers: true } },
        },
      }),
      this.prisma.assessmentQuestion.count({ where }),
    ]);
    return {
      items: rows.map(({ _count, ...question }) => ({
        ...question,
        imageUrl: this.storage.publicUrl(question.imageKey),
        answeredCount: _count.answers,
      })),
      total,
      page: currentPage,
      pageSize: take,
    };
  }

  /** One question from the form, or many from the paste importer. */
  @Post(':id/questions')
  async addQuestions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddQuestionsDto,
  ) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!bank) throw new NotFoundException('بنك الأسئلة غير موجود');
    const normalized = dto.questions.map((question, index) => normalizeQuestion(question, index));
    await this.prisma.$transaction(
      normalized.map(({ options, ...question }) =>
        this.prisma.assessmentQuestion.create({
          data: { ...question, bankId: id, options: optionRows(options) },
        }),
      ),
    );
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'question_bank.questions.add',
      entityType: 'QuestionBank',
      entityId: id,
      metadata: { title: bank.title, added: normalized.length },
    });
    return { added: normalized.length };
  }

  @Patch(':id/questions/:questionId')
  async updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: QuestionDto,
  ) {
    const question = await this.bankQuestion(id, questionId);
    if (question._count.answers)
      throw new BadRequestException(
        'السؤال ده اتحل قبل كده، فتعديله هيغيّر نتايج الطلاب. احذفه وضيف نسخة جديدة.',
      );
    const { options, ...data } = normalizeQuestion(dto, 0);
    return this.prisma.$transaction(async (tx) => {
      await tx.assessmentOption.deleteMany({ where: { questionId } });
      return tx.assessmentQuestion.update({
        where: { id: questionId },
        data: { ...data, options: optionRows(options) },
      });
    });
  }

  /** Answered questions are hidden from new draws; untouched ones are deleted. */
  @Delete(':id/questions/:questionId')
  async removeQuestion(@Param('id') id: string, @Param('questionId') questionId: string) {
    const question = await this.bankQuestion(id, questionId);
    if (question._count.answers) {
      await this.prisma.assessmentQuestion.update({
        where: { id: questionId },
        data: { archivedAt: new Date() },
      });
      return { archived: true };
    }
    await this.prisma.assessmentQuestion.delete({ where: { id: questionId } });
    return { deleted: true };
  }

  private async bankQuestion(bankId: string, questionId: string) {
    const question = await this.prisma.assessmentQuestion.findFirst({
      where: { id: questionId, bankId, archivedAt: null },
      select: { id: true, _count: { select: { answers: true } } },
    });
    if (!question) throw new NotFoundException('السؤال غير موجود');
    return question;
  }

  private async assertPlacement(dto: BankDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true },
    });
    if (!course) throw new BadRequestException('اختار الكورس');
    if (dto.unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: dto.unitId },
        select: { courseId: true },
      });
      if (!unit || unit.courseId !== dto.courseId)
        throw new BadRequestException('الوحدة مش تبع الكورس ده');
    }
  }
}
