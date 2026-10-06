import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class ContentDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async deleteCoursePermanently(actor: AuthenticatedUser, id: string, ip: string | undefined) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { id: true, title: true, gradeId: true, sortOrder: true },
    });
    if (!course) throw new NotFoundException('الكورس غير موجود');
    await this.assertNoPurchases({
      OR: [
        { courseId: id },
        { chapter: { unit: { courseId: id } } },
        { lesson: { chapter: { unit: { courseId: id } } } },
      ],
    });
    const assets = await this.lessonAssets({ chapter: { unit: { courseId: id } } });
    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.deleteMany({
        where: {
          OR: [
            { courseId: id },
            {
              chapterId: {
                in: await tx.chapter
                  .findMany({ where: { unit: { courseId: id } }, select: { id: true } })
                  .then((rows) => rows.map((row) => row.id)),
              },
            },
            { lessonId: { in: assets.map((item) => item.id) } },
          ],
        },
      });
      await tx.course.delete({ where: { id } });
      await tx.course.updateMany({
        where: { gradeId: course.gradeId, sortOrder: { gt: course.sortOrder } },
        data: { sortOrder: { decrement: 1 } },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'course.delete_permanently',
        entityType: 'Course',
        entityId: id,
        metadata: { title: course.title },
        ip: ip,
      });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  async deleteUnitPermanently(actor: AuthenticatedUser, id: string, ip: string | undefined) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true, title: true, courseId: true, sortOrder: true },
    });
    if (!unit) throw new NotFoundException('الوحدة غير موجودة');
    await this.assertNoPurchases({
      OR: [{ chapter: { unitId: id } }, { lesson: { chapter: { unitId: id } } }],
    });
    const assets = await this.lessonAssets({ chapter: { unitId: id } });
    await this.prisma.$transaction(async (tx) => {
      const chapterIds = await tx.chapter
        .findMany({ where: { unitId: id }, select: { id: true } })
        .then((rows) => rows.map((row) => row.id));
      await tx.entitlement.deleteMany({
        where: {
          OR: [
            { chapterId: { in: chapterIds } },
            { lessonId: { in: assets.map((item) => item.id) } },
          ],
        },
      });
      await tx.unit.delete({ where: { id } });
      await tx.unit.updateMany({
        where: { courseId: unit.courseId, sortOrder: { gt: unit.sortOrder } },
        data: { sortOrder: { decrement: 1 } },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'unit.delete_permanently',
        entityType: 'Unit',
        entityId: id,
        metadata: { title: unit.title },
        ip: ip,
      });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  async deleteChapterPermanently(actor: AuthenticatedUser, id: string, ip: string | undefined) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      select: { id: true, title: true, unitId: true, sortOrder: true },
    });
    if (!chapter) throw new NotFoundException('الباكدج غير موجود');
    await this.assertNoPurchases({ OR: [{ chapterId: id }, { lesson: { chapterId: id } }] });
    const assets = await this.lessonAssets({ chapterId: id });
    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.deleteMany({
        where: { OR: [{ chapterId: id }, { lessonId: { in: assets.map((item) => item.id) } }] },
      });
      await tx.chapter.delete({ where: { id } });
      await tx.chapter.updateMany({
        where: { unitId: chapter.unitId, sortOrder: { gt: chapter.sortOrder } },
        data: { sortOrder: { decrement: 1 } },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'chapter.delete_permanently',
        entityType: 'Chapter',
        entityId: id,
        metadata: { title: chapter.title },
        ip: ip,
      });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  async deleteLessonPermanently(actor: AuthenticatedUser, id: string, ip: string | undefined) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { id: true, title: true, chapterId: true, sortOrder: true },
    });
    if (!lesson) throw new NotFoundException('الحصة غير موجودة');
    await this.assertNoPurchases({ lessonId: id });
    const assets = await this.lessonAssets({ id });
    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.deleteMany({ where: { lessonId: id } });
      await tx.lesson.delete({ where: { id } });
      await tx.lesson.updateMany({
        where: { chapterId: lesson.chapterId, sortOrder: { gt: lesson.sortOrder } },
        data: { sortOrder: { decrement: 1 } },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'lesson.delete_permanently',
        entityType: 'Lesson',
        entityId: id,
        metadata: { title: lesson.title },
        ip: ip,
      });
    });
    await this.removeLessonAssets(assets);
    return { ok: true };
  }

  private async assertNoPurchases(productWhere: Prisma.ProductWhereInput) {
    const purchaseCount = await this.prisma.orderItem.count({ where: { product: productWhere } });
    if (purchaseCount > 0) {
      throw new BadRequestException(
        'لا يمكن الحذف النهائي لأن المحتوى مرتبط بمشتريات طلاب. استخدم الأرشفة للحفاظ على سجل الدفع.',
      );
    }
  }

  private lessonAssets(where: Prisma.LessonWhereInput) {
    return this.prisma.lesson.findMany({
      where,
      select: { id: true, videoAsset: { select: { sourceKey: true, hlsPrefix: true } } },
    });
  }

  private async removeLessonAssets(
    lessons: Array<{
      id: string;
      videoAsset: {
        sourceKey: string | null;
        hlsPrefix: string | null;
      } | null;
    }>,
  ) {
    for (const lesson of lessons) {
      if (lesson.videoAsset?.sourceKey)
        await this.storage
          .removeObject(this.storage.videoBucket, lesson.videoAsset.sourceKey)
          .catch(() => undefined);
      if (lesson.videoAsset?.hlsPrefix)
        await this.storage
          .removePrefix(this.storage.videoBucket, lesson.videoAsset.hlsPrefix)
          .catch(() => undefined);
    }
  }
}
