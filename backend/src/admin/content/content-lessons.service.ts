import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProductKind, PublishStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { VideosService } from '../../videos/videos.service';
import { uniqueSlug } from '../../common/utils';
import {
  CompleteAttachmentDto,
  UploadTicketDto,
  UpsertLessonDto,
  UpdateLessonDto,
} from '../dto/content.dto';
import { resolvePublicationSchedule } from './publication-schedule';

@Injectable()
export class ContentLessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly videos: VideosService,
    private readonly storage: StorageService,
  ) {}

  // -------------------------------------------------------------------------
  // Lessons
  // -------------------------------------------------------------------------
  async createAttachmentUpload(lessonId: string, dto: UploadTicketDto) {
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
    if (dto.sizeBytes > 25 * 1024 * 1024)
      throw new BadRequestException('الحد الأقصى للملف 25 ميجابايت');
    const exists = await this.prisma.lesson.count({ where: { id: lessonId } });
    if (!exists) throw new NotFoundException('الحصة غير موجودة');
    const extension =
      dto.fileName
        .split('.')
        .pop()
        ?.replace(/[^a-z0-9]/gi, '')
        .toLowerCase() || 'bin';
    const key = `attachments/${lessonId}/${randomUUID()}.${extension}`;
    return this.storage.presignUpload(this.storage.videoBucket, key, 900);
  }

  async completeAttachment(lessonId: string, dto: CompleteAttachmentDto) {
    if (!dto.key.startsWith(`attachments/${lessonId}/`))
      throw new BadRequestException('مفتاح الملف غير صالح');
    const stat = await this.storage.statObject(this.storage.videoBucket, dto.key).catch(() => null);
    if (!stat || stat.size !== dto.sizeBytes) throw new BadRequestException('الملف لم يكتمل رفعه');
    return this.prisma.attachment.create({
      data: {
        lessonId,
        title: dto.title,
        titleEn: dto.titleEn,
        storageKey: dto.key,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
      },
    });
  }

  async deleteAttachment(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('الملف غير موجود');
    await this.storage
      .removeObject(this.storage.videoBucket, attachment.storageKey)
      .catch(() => undefined);
    await this.prisma.attachment.delete({ where: { id } });
    return { deleted: true };
  }

  async createLesson(
    actor: AuthenticatedUser,
    chapterId: string,
    dto: UpsertLessonDto,
    ip: string | undefined,
  ) {
    const siblings = await this.prisma.lesson.findMany({
      where: { chapterId },
      select: { slug: true, sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? Math.max(-1, ...siblings.map((item) => item.sortOrder)) + 1;
    const lesson = await this.prisma.$transaction(async (tx) => {
      if (dto.sortOrder !== undefined) {
        await tx.lesson.updateMany({
          where: { chapterId, sortOrder: { gte: sortOrder } },
          data: { sortOrder: { increment: 1 } },
        });
      }
      const created = await tx.lesson.create({
        data: {
          chapterId,
          title: dto.title,
          titleEn: dto.titleEn,
          slug: uniqueSlug(
            dto.title,
            siblings.map((s) => s.slug),
          ),
          description: dto.description,
          descriptionEn: dto.descriptionEn,
          sortOrder,
          status: dto.status ?? PublishStatus.DRAFT,
          priceMinor: dto.priceMinor,
          isFreePreview: dto.isFreePreview ?? false,
          centerPriceMinor: dto.centerPriceMinor,
          thumbnailKey: dto.thumbnailKey,
          scheduledAt: resolvePublicationSchedule(dto.status, dto.scheduledAt),
        },
      });
      if ((created.priceMinor ?? 0) > 0 || (created.centerPriceMinor ?? 0) > 0) {
        await tx.product.create({
          data: {
            kind: ProductKind.LESSON,
            lessonId: created.id,
            title: created.title,
            titleEn: created.titleEn,
            description: created.description,
            descriptionEn: created.descriptionEn,
            priceMinor: created.priceMinor ?? 0,
          },
        });
      }
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'lesson.create',
        entityType: 'Lesson',
        entityId: created.id,
        metadata: { title: created.title, sortOrder },
        ip: ip,
      });
      return created;
    });
    return lesson;
  }

  async updateLesson(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateLessonDto,
    ip: string | undefined,
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
            where: {
              chapterId: existing.chapterId,
              id: { not: id },
              sortOrder: { gte: dto.sortOrder, lt: existing.sortOrder },
            },
            data: { sortOrder: { increment: 1 } },
          });
        } else {
          await tx.lesson.updateMany({
            where: {
              chapterId: existing.chapterId,
              id: { not: id },
              sortOrder: { gt: existing.sortOrder, lte: dto.sortOrder },
            },
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
          ...(dto.centerPriceMinor !== undefined ? { centerPriceMinor: dto.centerPriceMinor } : {}),
          ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}),
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
      // Keep the sellable Product in step with the lesson's price.
      if (
        dto.priceMinor !== undefined ||
        dto.centerPriceMinor !== undefined ||
        dto.title ||
        dto.isFreePreview !== undefined
      ) {
        const product = existing.products[0];
        if ((updated.priceMinor ?? 0) > 0 || (updated.centerPriceMinor ?? 0) > 0) {
          await tx.product.upsert({
            where: { lessonId: id },
            create: {
              kind: ProductKind.LESSON,
              lessonId: id,
              title: updated.title,
              titleEn: updated.titleEn,
              description: updated.description,
              descriptionEn: updated.descriptionEn,
              priceMinor: updated.priceMinor ?? 0,
            },
            update: {
              priceMinor: updated.priceMinor ?? 0,
              title: updated.title,
              titleEn: updated.titleEn,
              description: updated.description,
              descriptionEn: updated.descriptionEn,
              isActive: true,
            },
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
        ip: ip,
      });
      return updated;
    });
    return lesson;
  }

  async archiveLesson(actor: AuthenticatedUser, id: string, ip: string | undefined) {
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
      ip: ip,
    });
    return lesson;
  }

  // -------------------------------------------------------------------------
  // Video upload
  // -------------------------------------------------------------------------
  createUploadTicket(id: string, dto: UploadTicketDto) {
    return this.videos.createUploadTicket(id, dto);
  }

  async completeUpload(actor: AuthenticatedUser, id: string, ip: string | undefined) {
    const result = await this.videos.completeUpload(id);
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'video.upload',
      entityType: 'Lesson',
      entityId: id,
      metadata: { assetId: result.assetId },
      ip: ip,
    });
    return result;
  }

  videoStatus(id: string) {
    return this.videos.getProcessingStatus(id);
  }

  retry(id: string) {
    return this.videos.requeue(id);
  }
}
