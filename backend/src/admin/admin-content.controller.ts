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
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import { Prisma } from '../generated/prisma/client';
import { ProductKind, PublishStatus, Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { VideosService } from '../videos/videos.service';
import { uniqueSlug } from '../common/utils';
import {
  CompleteAttachmentDto,
  UploadTicketDto,
  UpsertChapterDto,
  UpsertCourseDto,
  UpsertLessonDto,
  UpsertUnitDto,
} from './dto/content.dto';

@ApiTags('admin')
@Roles(Role.CONTENT_MANAGER)
@Controller('admin/content')
export class AdminContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly videos: VideosService,
    private readonly storage: StorageService,
  ) {}

  private schedule(status?: PublishStatus, scheduledAt?: string) {
    if (status === PublishStatus.SCHEDULED && !scheduledAt) {
      throw new BadRequestException('حدد تاريخ ووقت النشر المجدول');
    }
    const date = scheduledAt ? new Date(scheduledAt) : null;
    if (status === PublishStatus.SCHEDULED && date && date <= new Date()) {
      throw new BadRequestException('وقت النشر المجدول لازم يكون في المستقبل');
    }
    return status === PublishStatus.SCHEDULED ? date : null;
  }

  // -------------------------------------------------------------------------
  // Courses
  // -------------------------------------------------------------------------

  @Get('courses')
  @ApiOperation({ summary: 'كل الكورسات (بما فيها المسودات)' })
  async listCourses(@Query('gradeId') gradeId?: string) {
    return this.prisma.course.findMany({
      where: gradeId ? { gradeId } : {},
      orderBy: [{ gradeId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        grade: { select: { nameAr: true, slug: true, themeKey: true } },
        academicYear: { select: { label: true } },
        _count: { select: { units: true } },
      },
    });
  }

  @Get('grades')
  @ApiOperation({ summary: 'الصفوف المتاحة لإدارة المحتوى' })
  listGrades() {
    return this.prisma.grade.findMany({
      where: { isActive: true },
      orderBy: [{ educationSystem: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        nameAr: true,
        shortNameAr: true,
        slug: true,
        themeKey: true,
        educationSystem: true,
      },
    });
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'شجرة الكورس كاملة للإدارة' })
  async getCourse(@Param('id') id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        grade: { select: { id: true, nameAr: true, slug: true, themeKey: true } },
        academicYear: { select: { label: true } },
        units: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            chapters: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: {
                lessons: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                  include: {
                    videoAsset: {
                      select: { status: true, originalName: true, errorMessage: true },
                    },
                    attachments: { orderBy: { createdAt: 'asc' } },
                    products: { select: { id: true, isActive: true } },
                  },
                },
                products: { select: { id: true, isActive: true } },
              },
            },
          },
        },
        products: { select: { id: true, isActive: true } },
      },
    });

    if (!course) throw new NotFoundException('الكورس غير موجود');
    return course;
  }

  @Post('courses')
  @ApiOperation({ summary: 'إنشاء كورس' })
  async createCourse(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpsertCourseDto,
    @Req() req: Request,
  ) {
    const academicYearId =
      dto.academicYearId ??
      (
        await this.prisma.academicYear.findFirst({
          where: { isCurrent: true },
          select: { id: true },
        })
      )?.id;

    if (!academicYearId) {
      throw new BadRequestException('لازم تحدد العام الدراسي');
    }

    // Slugs are unique per grade, so uniqueness is checked among siblings only.
    const siblings = await this.prisma.course.findMany({
      where: { gradeId: dto.gradeId },
      select: { slug: true, sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? Math.max(-1, ...siblings.map((item) => item.sortOrder)) + 1;

    const course = await this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined) {
        await tx.course.updateMany({
          where: { gradeId: dto.gradeId, sortOrder: { gte: sortOrder } },
          data: { sortOrder: { increment: 1 } },
        });
      }
      const created = await tx.course.create({ data: {
        title: dto.title,
        titleEn: dto.titleEn,
        slug: uniqueSlug(dto.title, siblings.map((s) => s.slug)),
        gradeId: dto.gradeId,
        academicYearId,
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        status: dto.status ?? PublishStatus.DRAFT,
        sortOrder,
        priceMinor: dto.priceMinor,
        isProvisional: dto.isProvisional ?? false,
        thumbnailKey: dto.thumbnailKey,
        coverKey: dto.coverKey,
        scheduledAt: this.schedule(dto.status, dto.scheduledAt),
        publishedAt: dto.status === PublishStatus.PUBLISHED ? new Date() : null,
      } });

      if (dto.priceMinor && dto.priceMinor > 0) {
        await tx.product.create({
        data: {
          kind: ProductKind.COURSE,
          courseId: created.id,
          title: created.title,
          titleEn: created.titleEn,
          description: created.description,
          descriptionEn: created.descriptionEn,
          priceMinor: dto.priceMinor,
        },
        });
      }

      await this.audit.record(tx, {
      actorId: actor.id,
      action: 'course.create',
      entityType: 'Course',
      entityId: created.id,
      metadata: { title: created.title, sortOrder },
      ip: req.ip,
      });
      return created;
    });

    return course;
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'تعديل كورس' })
  async updateCourse(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: Partial<UpsertCourseDto>,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الكورس غير موجود');

    const course = await this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
        if (dto.sortOrder < existing.sortOrder) {
          await tx.course.updateMany({
            where: { gradeId: existing.gradeId, id: { not: id }, sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder } },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.course.updateMany({
            where: { gradeId: existing.gradeId, id: { not: id }, sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder } },
            data: { sortOrder: { decrement: 1 } },
          });
        }
      }

      const updated = await tx.course.update({
        where: { id },
        data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.descriptionEn !== undefined ? { descriptionEn: dto.descriptionEn || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.priceMinor !== undefined ? { priceMinor: dto.priceMinor } : {}),
        ...(dto.isProvisional !== undefined ? { isProvisional: dto.isProvisional } : {}),
        ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}),
        ...(dto.coverKey !== undefined ? { coverKey: dto.coverKey } : {}),
        ...(dto.status || dto.scheduledAt !== undefined
          ? { scheduledAt: this.schedule(dto.status ?? existing.status, dto.scheduledAt) }
          : {}),
        ...(dto.status === PublishStatus.PUBLISHED && !existing.publishedAt
          ? { publishedAt: new Date() }
          : {}),
        },
      });

      if (dto.priceMinor !== undefined || dto.title || dto.titleEn !== undefined || dto.description !== undefined || dto.descriptionEn !== undefined) {
        const priceMinor = dto.priceMinor ?? existing.priceMinor;
        if (priceMinor && priceMinor > 0) {
          await tx.product.upsert({
          where: { courseId: id },
          create: {
            kind: ProductKind.COURSE,
            courseId: id,
            title: course.title,
            titleEn: course.titleEn,
            description: course.description,
            descriptionEn: course.descriptionEn,
            priceMinor,
          },
          update: {
            title: course.title,
            titleEn: course.titleEn,
            description: course.description,
            descriptionEn: course.descriptionEn,
            priceMinor,
            isActive: true,
          },
          });
        } else {
          await tx.product.updateMany({ where: { courseId: id }, data: { isActive: false } });
        }
      }

      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'course.update',
        entityType: 'Course',
        entityId: id,
        metadata: { changed: Object.keys(dto) },
        ip: req.ip,
      });
      return updated;
    });

    return course;
  }

  // -------------------------------------------------------------------------
  // Units & chapters
  // -------------------------------------------------------------------------

  @Post('courses/:courseId/units')
  @ApiOperation({ summary: 'إضافة وحدة' })
  async createUnit(@Param('courseId') courseId: string, @Body() dto: UpsertUnitDto) {
    const last = await this.prisma.unit.aggregate({ where: { courseId }, _max: { sortOrder: true } });
    const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1;
    return this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined) {
        await tx.unit.updateMany({ where: { courseId, sortOrder: { gte: sortOrder } }, data: { sortOrder: { increment: 1 } } });
      }
      return tx.unit.create({ data: {
        courseId,
        title: dto.title,
        titleEn: dto.titleEn,
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        sortOrder,
        status: dto.status ?? PublishStatus.DRAFT,
        scheduledAt: this.schedule(dto.status, dto.scheduledAt),
      } });
    });
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'تعديل وحدة' })
  async updateUnit(@Param('id') id: string, @Body() dto: Partial<UpsertUnitDto>) {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unit not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
        if (dto.sortOrder < existing.sortOrder) {
          await tx.unit.updateMany({
            where: { courseId: existing.courseId, id: { not: id }, sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder } },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.unit.updateMany({
            where: { courseId: existing.courseId, id: { not: id }, sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder } },
            data: { sortOrder: { decrement: 1 } },
          });
        }
      }
      const { scheduledAt, ...data } = dto;
      return tx.unit.update({ where: { id }, data: {
        ...data,
        ...(dto.status || scheduledAt !== undefined
          ? { scheduledAt: this.schedule(dto.status ?? existing.status, scheduledAt) }
          : {}),
      } });
    });
  }

  @Post('units/:unitId/chapters')
  @ApiOperation({ summary: 'إضافة فصل' })
  async createChapter(@Param('unitId') unitId: string, @Body() dto: UpsertChapterDto) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.chapter.aggregate({ where: { unitId }, _max: { sortOrder: true } });
      const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1;
      if (dto.sortOrder !== undefined) {
        await tx.chapter.updateMany({ where: { unitId, sortOrder: { gte: sortOrder } }, data: { sortOrder: { increment: 1 } } });
      }
      const chapter = await tx.chapter.create({
      data: {
        unitId,
        title: dto.title,
        titleEn: dto.titleEn,
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        sortOrder,
        status: dto.status ?? PublishStatus.DRAFT,
        priceMinor: dto.priceMinor,
        scheduledAt: this.schedule(dto.status, dto.scheduledAt),
      },
    });
      if (dto.priceMinor && dto.priceMinor > 0) {
        await tx.product.create({
          data: {
            kind: ProductKind.CHAPTER_BUNDLE,
            chapterId: chapter.id,
            title: chapter.title,
            titleEn: chapter.titleEn,
            description: chapter.description,
            descriptionEn: chapter.descriptionEn,
            priceMinor: dto.priceMinor,
          },
        });
      }
      return chapter;
    });
  }

  @Patch('chapters/:id')
  @ApiOperation({ summary: 'تعديل فصل' })
  async updateChapter(@Param('id') id: string, @Body() dto: Partial<UpsertChapterDto>) {
    const existing = await this.prisma.chapter.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الفصل غير موجود');
    return this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
        if (dto.sortOrder < existing.sortOrder) {
          await tx.chapter.updateMany({
            where: { unitId: existing.unitId, id: { not: id }, sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder } },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.chapter.updateMany({
            where: { unitId: existing.unitId, id: { not: id }, sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder } },
            data: { sortOrder: { decrement: 1 } },
          });
        }
      }
      const { scheduledAt, ...data } = dto;
      const chapter = await tx.chapter.update({ where: { id }, data: {
        ...data,
        ...(dto.status || scheduledAt !== undefined
          ? { scheduledAt: this.schedule(dto.status ?? existing.status, scheduledAt) }
          : {}),
      } });
      if (dto.priceMinor !== undefined || dto.title || dto.description !== undefined) {
      const priceMinor = dto.priceMinor ?? existing.priceMinor;
      if (priceMinor && priceMinor > 0) {
        await tx.product.upsert({
          where: { chapterId: id },
          create: {
            kind: ProductKind.CHAPTER_BUNDLE,
            chapterId: id,
            title: chapter.title,
            description: chapter.description,
            priceMinor,
          },
          update: {
            title: chapter.title,
            description: chapter.description,
            priceMinor,
            isActive: true,
          },
        });
      } else {
        await tx.product.updateMany({
          where: { chapterId: id },
          data: { isActive: false },
        });
      }
      }
      return chapter;
    });
  }

  @Delete('courses/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة كورس' })
  archiveCourse(@Param('id') id: string) {
    return this.prisma.course.update({
      where: { id },
      data: { status: PublishStatus.ARCHIVED },
    });
  }

  @Delete('units/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة وحدة' })
  archiveUnit(@Param('id') id: string) {
    return this.prisma.unit.update({
      where: { id },
      data: { status: PublishStatus.ARCHIVED },
    });
  }

  @Delete('chapters/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة فصل' })
  archiveChapter(@Param('id') id: string) {
    return this.prisma.chapter.update({
      where: { id },
      data: { status: PublishStatus.ARCHIVED },
    });
  }

  // -------------------------------------------------------------------------
  // Lessons
  // -------------------------------------------------------------------------

  @Post('lessons/:id/attachments/upload-ticket')
  async createAttachmentUpload(@Param('id') lessonId: string, @Body() dto: UploadTicketDto) {
    const allowed = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]);
    if (!allowed.has(dto.contentType)) throw new BadRequestException('صيغة الملف غير مدعومة');
    if (dto.sizeBytes > 25 * 1024 * 1024) throw new BadRequestException('الحد الأقصى للملف 25 ميجابايت');
    const exists = await this.prisma.lesson.count({ where: { id: lessonId } });
    if (!exists) throw new NotFoundException('الحصة غير موجودة');
    const extension = dto.fileName.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const key = `attachments/${lessonId}/${randomUUID()}.${extension}`;
    return this.storage.presignUpload(this.storage.videoBucket, key, 900);
  }

  @Post('lessons/:id/attachments/complete')
  async completeAttachment(@Param('id') lessonId: string, @Body() dto: CompleteAttachmentDto) {
    if (!dto.key.startsWith(`attachments/${lessonId}/`)) throw new BadRequestException('مفتاح الملف غير صالح');
    const stat = await this.storage.statObject(this.storage.videoBucket, dto.key).catch(() => null);
    if (!stat || stat.size !== dto.sizeBytes) throw new BadRequestException('الملف لم يكتمل رفعه');
    return this.prisma.attachment.create({ data: {
      lessonId,
      title: dto.title,
      titleEn: dto.titleEn,
      storageKey: dto.key,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
    } });
  }

  @Delete('attachments/:id')
  async deleteAttachment(@Param('id') id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('الملف غير موجود');
    await this.storage.removeObject(this.storage.videoBucket, attachment.storageKey).catch(() => undefined);
    await this.prisma.attachment.delete({ where: { id } });
    return { deleted: true };
  }

  @Post('chapters/:chapterId/lessons')
  @ApiOperation({ summary: 'إضافة حصة' })
  async createLesson(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpsertLessonDto,
    @Req() req: Request,
  ) {
    const siblings = await this.prisma.lesson.findMany({
      where: { chapterId },
      select: { slug: true, sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? Math.max(-1, ...siblings.map((item) => item.sortOrder)) + 1;

    const lesson = await this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined) {
        await tx.lesson.updateMany({ where: { chapterId, sortOrder: { gte: sortOrder } }, data: { sortOrder: { increment: 1 } } });
      }
      const created = await tx.lesson.create({ data: {
        chapterId,
        title: dto.title,
        titleEn: dto.titleEn,
        slug: uniqueSlug(dto.title, siblings.map((s) => s.slug)),
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        sortOrder,
        status: dto.status ?? PublishStatus.DRAFT,
        priceMinor: dto.priceMinor,
        isFreePreview: dto.isFreePreview ?? false,
        thumbnailKey: dto.thumbnailKey,
        scheduledAt: this.schedule(dto.status, dto.scheduledAt),
      } });

      if (dto.priceMinor && dto.priceMinor > 0) {
        await tx.product.create({
        data: {
          kind: ProductKind.LESSON,
          lessonId: created.id,
          title: created.title,
          titleEn: created.titleEn,
          description: created.description,
          descriptionEn: created.descriptionEn,
          priceMinor: dto.priceMinor,
        },
        });
      }

      await this.audit.record(tx, {
      actorId: actor.id,
      action: 'lesson.create',
      entityType: 'Lesson',
      entityId: created.id,
      metadata: { title: created.title, sortOrder },
      ip: req.ip,
      });
      return created;
    });

    return lesson;
  }

  @Patch('lessons/:id')
  @ApiOperation({ summary: 'تعديل حصة' })
  async updateLesson(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: Partial<UpsertLessonDto>,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.lesson.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!existing) throw new NotFoundException('الحصة غير موجودة');

    const lesson = await this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
        if (dto.sortOrder < existing.sortOrder) {
          await tx.lesson.updateMany({
            where: { chapterId: existing.chapterId, id: { not: id }, sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder } },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.lesson.updateMany({
            where: { chapterId: existing.chapterId, id: { not: id }, sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder } },
            data: { sortOrder: { decrement: 1 } },
          });
        }
      }
      const updated = await tx.lesson.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.descriptionEn !== undefined ? { descriptionEn: dto.descriptionEn || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.priceMinor !== undefined ? { priceMinor: dto.priceMinor } : {}),
        ...(dto.isFreePreview !== undefined ? { isFreePreview: dto.isFreePreview } : {}),
        ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}),
        ...(dto.status || dto.scheduledAt !== undefined
          ? { scheduledAt: this.schedule(dto.status ?? existing.status, dto.scheduledAt) }
          : {}),
        ...(dto.status === PublishStatus.PUBLISHED && !existing.publishedAt
          ? { publishedAt: new Date() }
          : {}),
      },
      });

      // Keep the sellable Product in step with the lesson's price.
      if (dto.priceMinor !== undefined) {
        const product = existing.products[0];
        if (dto.priceMinor > 0) {
          await tx.product.upsert({
          where: { lessonId: id },
          create: {
            kind: ProductKind.LESSON,
            lessonId: id,
            title: lesson.title,
            titleEn: lesson.titleEn,
            description: lesson.description,
            descriptionEn: lesson.descriptionEn,
            priceMinor: dto.priceMinor,
          },
          update: { priceMinor: dto.priceMinor, title: lesson.title, titleEn: lesson.titleEn, description: lesson.description, descriptionEn: lesson.descriptionEn, isActive: true },
        });
        } else if (product) {
          // Deactivated rather than deleted: historical order lines reference it.
          await tx.product.update({ where: { id: product.id }, data: { isActive: false } });
        }
      }

      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'lesson.update',
        entityType: 'Lesson',
        entityId: id,
        metadata: { changed: Object.keys(dto) },
        ip: req.ip,
      });
      return updated;
    });

    return lesson;
  }

  @Delete('lessons/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'أرشفة حصة' })
  async archiveLesson(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    // Archived, never hard-deleted — students who paid keep their history.
    const lesson = await this.prisma.lesson.update({
      where: { id },
      data: { status: PublishStatus.ARCHIVED },
    });

    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'lesson.archive',
      entityType: 'Lesson',
      entityId: id,
      ip: req.ip,
    });

    return lesson;
  }

  @Delete('courses/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف كورس نهائياً' })
  async deleteCoursePermanently(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { id: true, title: true, gradeId: true, sortOrder: true },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');
    await this.assertNoPurchases({ OR: [{ courseId: id }, { chapter: { unit: { courseId: id } } }, { lesson: { chapter: { unit: { courseId: id } } } }] });
    const assets = await this.lessonAssets({ chapter: { unit: { courseId: id } } });
    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.deleteMany({ where: { OR: [{ courseId: id }, { chapterId: { in: await tx.chapter.findMany({ where: { unit: { courseId: id } }, select: { id: true } }).then((rows) => rows.map((row) => row.id)) } }, { lessonId: { in: assets.map((item) => item.id) } }] } });
      await tx.course.delete({ where: { id } });
      await tx.course.updateMany({ where: { gradeId: course.gradeId, sortOrder: { gt: course.sortOrder } }, data: { sortOrder: { decrement: 1 } } });
      await this.audit.record(tx, { actorId: actor.id, action: 'course.delete_permanently', entityType: 'Course', entityId: id, metadata: { title: course.title }, ip: req.ip });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  @Delete('units/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف وحدة نهائياً' })
  async deleteUnitPermanently(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    const unit = await this.prisma.unit.findUnique({ where: { id }, select: { id: true, title: true, courseId: true, sortOrder: true } });
    if (!unit) throw new NotFoundException('الوحدة غير موجودة');
    await this.assertNoPurchases({ OR: [{ chapter: { unitId: id } }, { lesson: { chapter: { unitId: id } } }] });
    const assets = await this.lessonAssets({ chapter: { unitId: id } });
    await this.prisma.$transaction(async (tx) => {
      const chapterIds = await tx.chapter.findMany({ where: { unitId: id }, select: { id: true } }).then((rows) => rows.map((row) => row.id));
      await tx.entitlement.deleteMany({ where: { OR: [{ chapterId: { in: chapterIds } }, { lessonId: { in: assets.map((item) => item.id) } }] } });
      await tx.unit.delete({ where: { id } });
      await tx.unit.updateMany({ where: { courseId: unit.courseId, sortOrder: { gt: unit.sortOrder } }, data: { sortOrder: { decrement: 1 } } });
      await this.audit.record(tx, { actorId: actor.id, action: 'unit.delete_permanently', entityType: 'Unit', entityId: id, metadata: { title: unit.title }, ip: req.ip });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  @Delete('chapters/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف باكدج نهائياً' })
  async deleteChapterPermanently(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id }, select: { id: true, title: true, unitId: true, sortOrder: true } });
    if (!chapter) throw new NotFoundException('الباكدج غير موجود');
    await this.assertNoPurchases({ OR: [{ chapterId: id }, { lesson: { chapterId: id } }] });
    const assets = await this.lessonAssets({ chapterId: id });
    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.deleteMany({ where: { OR: [{ chapterId: id }, { lessonId: { in: assets.map((item) => item.id) } }] } });
      await tx.chapter.delete({ where: { id } });
      await tx.chapter.updateMany({ where: { unitId: chapter.unitId, sortOrder: { gt: chapter.sortOrder } }, data: { sortOrder: { decrement: 1 } } });
      await this.audit.record(tx, { actorId: actor.id, action: 'chapter.delete_permanently', entityType: 'Chapter', entityId: id, metadata: { title: chapter.title }, ip: req.ip });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  @Delete('lessons/:id/permanent')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'حذف حصة نهائياً' })
  async deleteLessonPermanently(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id }, select: { id: true, title: true, chapterId: true, sortOrder: true } });
    if (!lesson) throw new NotFoundException('الحصة غير موجودة');
    await this.assertNoPurchases({ lessonId: id });
    const assets = await this.lessonAssets({ id });
    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.deleteMany({ where: { lessonId: id } });
      await tx.lesson.delete({ where: { id } });
      await tx.lesson.updateMany({ where: { chapterId: lesson.chapterId, sortOrder: { gt: lesson.sortOrder } }, data: { sortOrder: { decrement: 1 } } });
      await this.audit.record(tx, { actorId: actor.id, action: 'lesson.delete_permanently', entityType: 'Lesson', entityId: id, metadata: { title: lesson.title }, ip: req.ip });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  private async assertNoPurchases(productWhere: Prisma.ProductWhereInput) {
    const purchaseCount = await this.prisma.orderItem.count({ where: { product: productWhere } });
    if (purchaseCount > 0) {
      throw new BadRequestException('لا يمكن الحذف النهائي لأن المحتوى مرتبط بمشتريات طلاب. استخدم الأرشفة للحفاظ على سجل الدفع.');
    }
  }

  private lessonAssets(where: Prisma.LessonWhereInput) {
    return this.prisma.lesson.findMany({ where, select: { id: true, videoAsset: { select: { sourceKey: true, hlsPrefix: true } } } });
  }

  private async removeLessonAssets(lessons: Array<{ id: string; videoAsset: { sourceKey: string | null; hlsPrefix: string | null } | null }>) {
    for (const lesson of lessons) {
      if (lesson.videoAsset?.sourceKey) await this.storage.removeObject(this.storage.videoBucket, lesson.videoAsset.sourceKey).catch(() => undefined);
      if (lesson.videoAsset?.hlsPrefix) await this.storage.removePrefix(this.storage.videoBucket, lesson.videoAsset.hlsPrefix).catch(() => undefined);
    }
  }

  // -------------------------------------------------------------------------
  // Video upload
  // -------------------------------------------------------------------------

  @Post('lessons/:id/video/upload-ticket')
  @ApiOperation({ summary: 'طلب رابط رفع مباشر للفيديو' })
  createUploadTicket(@Param('id') id: string, @Body() dto: UploadTicketDto) {
    return this.videos.createUploadTicket(id, dto);
  }

  @Post('lessons/:id/video/complete')
  @ApiOperation({ summary: 'تأكيد انتهاء الرفع وبدء المعالجة' })
  async completeUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.videos.completeUpload(id);
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'video.upload',
      entityType: 'Lesson',
      entityId: id,
      metadata: { assetId: result.assetId },
      ip: req.ip,
    });
    return result;
  }

  @Get('lessons/:id/video/status')
  @ApiOperation({ summary: 'حالة معالجة الفيديو' })
  videoStatus(@Param('id') id: string) {
    return this.videos.getProcessingStatus(id);
  }

  @Post('lessons/:id/video/retry')
  @ApiOperation({ summary: 'إعادة محاولة معالجة الفيديو' })
  retry(@Param('id') id: string) {
    return this.videos.requeue(id);
  }
}
