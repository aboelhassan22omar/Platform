import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductKind, PublishStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators';
import { AuditService } from '../../common/audit/audit.service';
import { uniqueSlug } from '../../common/utils';
import { UpsertChapterDto, UpsertCourseDto, UpsertUnitDto } from '../dto/content.dto';
import { resolvePublicationSchedule } from './publication-schedule';

@Injectable()
export class ContentCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Courses
  // -------------------------------------------------------------------------
  async listCourses(gradeId?: string) {
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

  async getCourse(id: string) {
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

  async createCourse(actor: AuthenticatedUser, dto: UpsertCourseDto, ip: string | undefined) {
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
      const created = await tx.course.create({
        data: {
          title: dto.title,
          titleEn: dto.titleEn,
          slug: uniqueSlug(
            dto.title,
            siblings.map((s) => s.slug),
          ),
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
          scheduledAt: resolvePublicationSchedule(dto.status, dto.scheduledAt),
          publishedAt: dto.status === PublishStatus.PUBLISHED ? new Date() : null,
        },
      });
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
        ip: ip,
      });
      return created;
    });
    return course;
  }

  async updateCourse(
    actor: AuthenticatedUser,
    id: string,
    dto: Partial<UpsertCourseDto>,
    ip: string | undefined,
  ) {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الكورس غير موجود');
    const course = await this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
        if (dto.sortOrder < existing.sortOrder) {
          await tx.course.updateMany({
            where: {
              gradeId: existing.gradeId,
              id: { not: id },
              sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder },
            },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.course.updateMany({
            where: {
              gradeId: existing.gradeId,
              id: { not: id },
              sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder },
            },
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
            ? {
                scheduledAt: resolvePublicationSchedule(
                  dto.status ?? existing.status,
                  dto.scheduledAt,
                ),
              }
            : {}),
          ...(dto.status === PublishStatus.PUBLISHED && !existing.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        },
      });
      if (
        dto.priceMinor !== undefined ||
        dto.title ||
        dto.titleEn !== undefined ||
        dto.description !== undefined ||
        dto.descriptionEn !== undefined
      ) {
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
        ip: ip,
      });
      return updated;
    });
    return course;
  }

  // -------------------------------------------------------------------------
  // Units & chapters
  // -------------------------------------------------------------------------
  async createUnit(courseId: string, dto: UpsertUnitDto) {
    const last = await this.prisma.unit.aggregate({
      where: { courseId },
      _max: { sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1;
    return this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined) {
        await tx.unit.updateMany({
          where: { courseId, sortOrder: { gte: sortOrder } },
          data: { sortOrder: { increment: 1 } },
        });
      }
      return tx.unit.create({
        data: {
          courseId,
          title: dto.title,
          titleEn: dto.titleEn,
          description: dto.description,
          descriptionEn: dto.descriptionEn,
          sortOrder,
          status: dto.status ?? PublishStatus.DRAFT,
          scheduledAt: resolvePublicationSchedule(dto.status, dto.scheduledAt),
        },
      });
    });
  }

  async updateUnit(id: string, dto: Partial<UpsertUnitDto>) {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Unit not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
        if (dto.sortOrder < existing.sortOrder) {
          await tx.unit.updateMany({
            where: {
              courseId: existing.courseId,
              id: { not: id },
              sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder },
            },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.unit.updateMany({
            where: {
              courseId: existing.courseId,
              id: { not: id },
              sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder },
            },
            data: { sortOrder: { decrement: 1 } },
          });
        }
      }
      const { scheduledAt, ...data } = dto;
      return tx.unit.update({
        where: { id },
        data: {
          ...data,
          ...(dto.status || scheduledAt !== undefined
            ? {
                scheduledAt: resolvePublicationSchedule(dto.status ?? existing.status, scheduledAt),
              }
            : {}),
        },
      });
    });
  }

  async createChapter(unitId: string, dto: UpsertChapterDto) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.chapter.aggregate({ where: { unitId }, _max: { sortOrder: true } });
      const sortOrder = dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1;
      if (dto.sortOrder !== undefined) {
        await tx.chapter.updateMany({
          where: { unitId, sortOrder: { gte: sortOrder } },
          data: { sortOrder: { increment: 1 } },
        });
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
          scheduledAt: resolvePublicationSchedule(dto.status, dto.scheduledAt),
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

  async updateChapter(id: string, dto: Partial<UpsertChapterDto>) {
    const existing = await this.prisma.chapter.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الفصل غير موجود');
    return this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
        if (dto.sortOrder < existing.sortOrder) {
          await tx.chapter.updateMany({
            where: {
              unitId: existing.unitId,
              id: { not: id },
              sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder },
            },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.chapter.updateMany({
            where: {
              unitId: existing.unitId,
              id: { not: id },
              sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder },
            },
            data: { sortOrder: { decrement: 1 } },
          });
        }
      }
      const { scheduledAt, ...data } = dto;
      const chapter = await tx.chapter.update({
        where: { id },
        data: {
          ...data,
          ...(dto.status || scheduledAt !== undefined
            ? {
                scheduledAt: resolvePublicationSchedule(dto.status ?? existing.status, scheduledAt),
              }
            : {}),
        },
      });
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

  archiveCourse(id: string) {
    return this.prisma.course.update({
      where: { id },
      data: { status: PublishStatus.ARCHIVED },
    });
  }

  archiveUnit(id: string) {
    return this.prisma.unit.update({
      where: { id },
      data: { status: PublishStatus.ARCHIVED },
    });
  }

  archiveChapter(id: string) {
    return this.prisma.chapter.update({
      where: { id },
      data: { status: PublishStatus.ARCHIVED },
    });
  }
}
