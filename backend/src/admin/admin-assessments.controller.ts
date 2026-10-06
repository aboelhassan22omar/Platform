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
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AssessmentKind, ProductKind, PublishStatus, Role } from '../generated/prisma/enums';

class AssessmentOptionDto {
  @IsString() @MinLength(1) @MaxLength(500) text!: string;
  @IsOptional() @IsString() @MaxLength(500) textEn?: string;
  @IsBoolean() isCorrect!: boolean;
}
class AssessmentQuestionDto {
  @IsString() @MinLength(2) @MaxLength(1500) prompt!: string;
  @IsOptional() @IsString() @MaxLength(1500) promptEn?: string;
  @IsOptional() @IsString() @MaxLength(1500) explanation?: string;
  @IsOptional() @IsString() @MaxLength(1500) explanationEn?: string;
  @IsInt() @Min(1) @Max(100) points!: number;
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AssessmentOptionDto)
  options!: AssessmentOptionDto[];
}
class UpsertAssessmentDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(200) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) descriptionEn?: string;
  @IsEnum(AssessmentKind) kind!: AssessmentKind;
  @IsEnum(PublishStatus) status!: PublishStatus;
  @IsOptional() @IsString() lessonId?: string;
  @IsOptional() @IsString() unitId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(300) timeLimitMinutes?: number;
  @IsInt() @Min(0) @Max(100) passingScore!: number;
  @IsInt() @Min(1) @Max(20) maxAttempts!: number;
  @IsOptional() @IsBoolean() shuffleQuestions?: boolean;
  @IsOptional() @IsBoolean() shuffleOptions?: boolean;
  @IsOptional() @IsBoolean() isFree?: boolean;
  @IsOptional() @IsInt() @Min(100) priceMinor?: number;
  @IsOptional() @IsDateString() availableFrom?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AssessmentQuestionDto)
  questions!: AssessmentQuestionDto[];
}

@Controller('admin/assessments')
@Roles(Role.CONTENT_MANAGER)
export class AdminAssessmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('curriculum')
  curriculum() {
    return this.prisma.course.findMany({
      orderBy: [{ gradeId: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        title: true,
        academicYear: { select: { id: true, label: true } },
        grade: { select: { id: true, nameAr: true } },
        units: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            chapters: {
              orderBy: { sortOrder: 'asc' },
              select: {
                lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });
  }

  @Get()
  list() {
    return this.prisma.assessment
      .findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          lesson: {
            select: {
              title: true,
              chapter: {
                select: { unit: { select: { title: true, course: { select: { title: true } } } } },
              },
            },
          },
          unit: { select: { title: true, course: { select: { title: true } } } },
          _count: { select: { questions: true, attempts: true } },
          attempts: { select: { percentage: true, passed: true } },
        },
      })
      .then((rows) =>
        rows.map(({ attempts, ...row }) => ({
          ...row,
          averageScore: attempts.length
            ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / attempts.length)
            : null,
          passedCount: attempts.filter((item) => item.passed).length,
        })),
      );
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const row = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!row) throw new NotFoundException('التقييم غير موجود');
    return row;
  }

  @Post()
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpsertAssessmentDto) {
    this.validate(dto);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({ data: this.data(dto) });
      if (!created.isFree && created.priceMinor)
        await tx.product.create({
          data: {
            kind: ProductKind.ASSESSMENT,
            assessmentId: created.id,
            title: created.title,
            titleEn: created.titleEn,
            description: created.description,
            descriptionEn: created.descriptionEn,
            priceMinor: created.priceMinor,
          },
        });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'assessment.create',
        entityType: 'Assessment',
        entityId: created.id,
        metadata: { title: created.title, kind: created.kind },
      });
      return created;
    });
    return row;
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertAssessmentDto,
  ) {
    this.validate(dto);
    const exists = await this.prisma.assessment.findUnique({
      where: { id },
      select: { id: true, _count: { select: { attempts: true } } },
    });
    if (!exists) throw new NotFoundException('التقييم غير موجود');
    if (exists._count.attempts > 0)
      throw new BadRequestException(
        'لا يمكن تعديل الأسئلة بعد بدء الطلاب في الحل. أرشف التقييم وأنشئ نسخة جديدة للحفاظ على نتائجهم.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
      const updated = await tx.assessment.update({ where: { id }, data: this.data(dto) });
      if (!updated.isFree && updated.priceMinor)
        await tx.product.upsert({
          where: { assessmentId: id },
          create: {
            kind: ProductKind.ASSESSMENT,
            assessmentId: id,
            title: updated.title,
            titleEn: updated.titleEn,
            description: updated.description,
            descriptionEn: updated.descriptionEn,
            priceMinor: updated.priceMinor,
          },
          update: {
            title: updated.title,
            titleEn: updated.titleEn,
            description: updated.description,
            descriptionEn: updated.descriptionEn,
            priceMinor: updated.priceMinor,
            isActive: true,
          },
        });
      else await tx.product.updateMany({ where: { assessmentId: id }, data: { isActive: false } });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'assessment.update',
        entityType: 'Assessment',
        entityId: id,
        metadata: { title: updated.title },
      });
      return updated;
    });
  }

  @Patch(':id/archive')
  async archive(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    const row = await this.prisma.assessment.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    });
    if (!row) throw new NotFoundException('التقييم غير موجود');
    if (row.status === PublishStatus.ARCHIVED) return { ok: true };

    await this.prisma.$transaction(async (tx) => {
      await tx.assessment.update({ where: { id }, data: { status: PublishStatus.ARCHIVED } });
      await tx.product.updateMany({ where: { assessmentId: id }, data: { isActive: false } });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'assessment.archive',
        entityType: 'Assessment',
        entityId: id,
        metadata: { title: row.title },
      });
    });
    return { ok: true };
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    const row = await this.prisma.assessment.findUnique({ where: { id }, select: { title: true } });
    if (!row) throw new NotFoundException('التقييم غير موجود');
    await this.prisma.$transaction(async (tx) => {
      await tx.assessment.delete({ where: { id } });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'assessment.delete',
        entityType: 'Assessment',
        entityId: id,
        metadata: { title: row.title },
      });
    });
    return { ok: true };
  }

  private validate(dto: UpsertAssessmentDto) {
    if (
      dto.kind === AssessmentKind.UNIT_EXAM
        ? !dto.unitId || dto.lessonId
        : !dto.lessonId || dto.unitId
    )
      throw new BadRequestException(
        'اختر الدرس للواجب أو اختبار الدرس، واختر الوحدة للامتحان الشامل',
      );
    if (dto.status === PublishStatus.PUBLISHED && !dto.questions.length)
      throw new BadRequestException('لا يمكن نشر تقييم بدون أسئلة');
    dto.questions.forEach((question, index) => {
      if (question.options.filter((option) => option.isCorrect).length !== 1)
        throw new BadRequestException(`السؤال رقم ${index + 1} يجب أن يحتوي على إجابة صحيحة واحدة`);
    });
    if (dto.availableFrom && dto.dueAt && new Date(dto.dueAt) <= new Date(dto.availableFrom))
      throw new BadRequestException('موعد التسليم يجب أن يكون بعد موعد الإتاحة');
    if (dto.isFree === false && (!dto.priceMinor || dto.priceMinor < 100))
      throw new BadRequestException('حدد سعرًا صحيحًا للامتحان المدفوع');
  }

  private data(dto: UpsertAssessmentDto) {
    return {
      title: dto.title,
      titleEn: dto.titleEn || null,
      description: dto.description || null,
      descriptionEn: dto.descriptionEn || null,
      kind: dto.kind,
      status: dto.status,
      lessonId: dto.kind === AssessmentKind.UNIT_EXAM ? null : dto.lessonId,
      unitId: dto.kind === AssessmentKind.UNIT_EXAM ? dto.unitId : null,
      timeLimitMinutes: dto.timeLimitMinutes ?? null,
      passingScore: dto.passingScore,
      maxAttempts: dto.maxAttempts,
      shuffleQuestions: dto.shuffleQuestions ?? false,
      shuffleOptions: dto.shuffleOptions ?? false,
      isFree: dto.isFree ?? true,
      priceMinor: dto.isFree === false ? dto.priceMinor : null,
      availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      questions: {
        create: dto.questions.map((question, questionIndex) => ({
          prompt: question.prompt,
          promptEn: question.promptEn || null,
          explanation: question.explanation || null,
          explanationEn: question.explanationEn || null,
          points: question.points,
          sortOrder: questionIndex,
          options: {
            create: question.options.map((option, optionIndex) => ({
              text: option.text,
              textEn: option.textEn || null,
              isCorrect: option.isCorrect,
              sortOrder: optionIndex,
            })),
          },
        })),
      },
    };
  }
}
