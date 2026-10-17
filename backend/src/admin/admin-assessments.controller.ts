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
import { randomUUID } from 'node:crypto';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
import {
  AssessmentKind,
  ProductKind,
  PublishStatus,
  QuestionDifficulty,
  Role,
} from '../generated/prisma/enums';
import { CertificatesService } from '../certificates/certificates.service';
import { StorageService } from '../common/storage/storage.service';
import { QuestionDto, normalizeQuestion, optionRows } from '../assessments/question.dto';

class DrawRuleDto {
  @IsString() bankId!: string;
  @IsOptional() @IsEnum(QuestionDifficulty) difficulty?: QuestionDifficulty | null;
  @IsInt() @Min(1) @Max(200) count!: number;
}

class QuestionImageDto {
  @IsString() @MaxLength(255) fileName!: string;
  @IsString() contentType!: string;
  @IsInt() @Min(1) sizeBytes!: number;
}

const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
  @IsOptional() @IsBoolean() certificateEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(100) certificateMinScore?: number;
  /** The exam's own questions; may be empty when everything is drawn from banks. */
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DrawRuleDto)
  drawRules?: DrawRuleDto[];
}

class CertificateSettingsDto {
  @IsBoolean() certificateEnabled!: boolean;
  @IsInt() @Min(1) @Max(100) certificateMinScore!: number;
}

const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  EASY: 'سهل',
  MEDIUM: 'متوسط',
  HARD: 'صعب',
};

@Controller('admin/assessments')
@Roles(Role.CONTENT_MANAGER)
export class AdminAssessmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly certificates: CertificatesService,
    private readonly storage: StorageService,
  ) {}

  /** Presigned upload for a question picture (map, document, figure). */
  @Post('question-image')
  async questionImage(@Body() dto: QuestionImageDto) {
    const extension = IMAGE_TYPES[dto.contentType];
    if (!extension) throw new BadRequestException('الصورة لازم تكون PNG أو JPG أو WEBP');
    if (dto.sizeBytes > MAX_IMAGE_BYTES) throw new BadRequestException('حجم الصورة أكبر من ٥ ميجا');
    const key = `questions/${randomUUID().replace(/-/g, '')}.${extension}`;
    const upload = await this.storage.presignUpload(this.storage.publicBucket, key, 900);
    return {
      key,
      uploadUrl: upload.url,
      url: this.storage.publicUrl(key),
      headers: { 'Content-Type': dto.contentType },
    };
  }

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
          _count: { select: { questions: true, attempts: true, certificates: true } },
          drawRules: { select: { count: true } },
          attempts: { select: { percentage: true, passed: true, needsGrading: true } },
        },
      })
      .then((rows) =>
        rows.map(({ attempts, drawRules, ...row }) => ({
          ...row,
          drawnPerAttempt: drawRules.reduce((sum, rule) => sum + rule.count, 0),
          awaitingGrading: attempts.filter((item) => item.needsGrading).length,
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
        drawRules: {
          orderBy: { sortOrder: 'asc' },
          select: { bankId: true, difficulty: true, count: true },
        },
      },
    });
    if (!row) throw new NotFoundException('التقييم غير موجود');
    return {
      ...row,
      questions: row.questions.map((question) => ({
        ...question,
        imageUrl: this.storage.publicUrl(question.imageKey),
      })),
    };
  }

  @Post()
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpsertAssessmentDto) {
    await this.validate(dto);
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
    await this.validate(dto);
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
      await tx.assessmentDrawRule.deleteMany({ where: { assessmentId: id } });
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

  /**
   * Certificates can be switched on, off or re-thresholded at any time, even
   * after students have sat the exam: it does not change anyone's result.
   * Students who already reached the new minimum get their certificate now.
   */
  @Patch(':id/certificate')
  async updateCertificate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CertificateSettingsDto,
  ) {
    const row = await this.prisma.assessment.findUnique({ where: { id }, select: { title: true } });
    if (!row) throw new NotFoundException('التقييم غير موجود');
    await this.prisma.$transaction(async (tx) => {
      await tx.assessment.update({
        where: { id },
        data: {
          certificateEnabled: dto.certificateEnabled,
          certificateMinScore: dto.certificateMinScore,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'assessment.certificate.update',
        entityType: 'Assessment',
        entityId: id,
        metadata: { title: row.title, ...dto },
      });
    });
    return { ok: true, issued: await this.certificates.backfill(id) };
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

  private async validate(dto: UpsertAssessmentDto) {
    if (
      dto.kind === AssessmentKind.UNIT_EXAM
        ? !dto.unitId || dto.lessonId
        : !dto.lessonId || dto.unitId
    )
      throw new BadRequestException(
        'اختر الدرس للواجب أو اختبار الدرس، واختر الوحدة للامتحان الشامل',
      );
    const rules = dto.drawRules ?? [];
    const drawn = rules.reduce((sum, rule) => sum + rule.count, 0);
    if (dto.status === PublishStatus.PUBLISHED && !dto.questions.length && !drawn)
      throw new BadRequestException('لا يمكن نشر تقييم بدون أسئلة');
    if (dto.questions.length + drawn > 200)
      throw new BadRequestException('أقصى عدد أسئلة في المحاولة الواحدة ٢٠٠ سؤال');
    // Throws with the question number on the first invalid question.
    dto.questions.forEach((question, index) => normalizeQuestion(question, index));
    if (rules.length) await this.validateDrawRules(dto, rules);
    if (dto.availableFrom && dto.dueAt && new Date(dto.dueAt) <= new Date(dto.availableFrom))
      throw new BadRequestException('موعد التسليم يجب أن يكون بعد موعد الإتاحة');
    if (dto.isFree === false && (!dto.priceMinor || dto.priceMinor < 100))
      throw new BadRequestException('حدد سعرًا صحيحًا للامتحان المدفوع');
  }

  /**
   * Banks must belong to the exam's course and hold enough questions: a rule
   * for "any difficulty" competes with the other rules on the same bank.
   */
  private async validateDrawRules(dto: UpsertAssessmentDto, rules: DrawRuleDto[]) {
    const courseId =
      dto.kind === AssessmentKind.UNIT_EXAM
        ? (
            await this.prisma.unit.findUnique({
              where: { id: dto.unitId },
              select: { courseId: true },
            })
          )?.courseId
        : (
            await this.prisma.lesson.findUnique({
              where: { id: dto.lessonId },
              select: { chapter: { select: { unit: { select: { courseId: true } } } } },
            })
          )?.chapter.unit.courseId;
    const bankIds = [...new Set(rules.map((rule) => rule.bankId))];
    const banks = await this.prisma.questionBank.findMany({
      where: { id: { in: bankIds } },
      select: { id: true, title: true, courseId: true },
    });
    const counts = await this.prisma.assessmentQuestion.groupBy({
      by: ['bankId', 'difficulty'],
      where: { bankId: { in: bankIds }, archivedAt: null },
      _count: true,
    });
    for (const bankId of bankIds) {
      const bank = banks.find((row) => row.id === bankId);
      if (!bank) throw new BadRequestException('بنك الأسئلة غير موجود');
      if (bank.courseId !== courseId)
        throw new BadRequestException(`بنك «${bank.title}» مش تبع الكورس ده`);
      const available = (difficulty?: QuestionDifficulty) =>
        counts
          .filter((row) => row.bankId === bankId && (!difficulty || row.difficulty === difficulty))
          .reduce((sum, row) => sum + row._count, 0);
      const bankRules = rules.filter((rule) => rule.bankId === bankId);
      const total = bankRules.reduce((sum, rule) => sum + rule.count, 0);
      if (total > available())
        throw new BadRequestException(
          `بنك «${bank.title}» فيه ${available()} سؤال بس، وإنت طالب ${total}`,
        );
      for (const difficulty of Object.values(QuestionDifficulty)) {
        const wanted = bankRules
          .filter((rule) => rule.difficulty === difficulty)
          .reduce((sum, rule) => sum + rule.count, 0);
        if (wanted > available(difficulty))
          throw new BadRequestException(
            `بنك «${bank.title}» فيه ${available(difficulty)} سؤال ${DIFFICULTY_LABELS[difficulty]} بس، وإنت طالب ${wanted}`,
          );
      }
    }
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
      certificateEnabled: dto.certificateEnabled ?? false,
      certificateMinScore: dto.certificateMinScore ?? 85,
      questions: {
        create: dto.questions.map((question, questionIndex) => {
          const { options, ...normalized } = normalizeQuestion(question, questionIndex);
          return { ...normalized, sortOrder: questionIndex, options: optionRows(options) };
        }),
      },
      drawRules: {
        create: (dto.drawRules ?? []).map((rule, sortOrder) => ({
          bankId: rule.bankId,
          difficulty: rule.difficulty ?? null,
          count: rule.count,
          sortOrder,
        })),
      },
    };
  }
}
