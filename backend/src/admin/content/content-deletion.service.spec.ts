import { BadRequestException } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../common/decorators';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuditService } from '../../common/audit/audit.service';
import type { StorageService } from '../../common/storage/storage.service';
import { ContentDeletionService } from './content-deletion.service';

describe('permanent content deletion', () => {
  const actor: AuthenticatedUser = {
    id: 'teacher',
    username: 'teacher',
    role: Role.CONTENT_MANAGER,
    tokenVersion: 0,
  };

  it.each([
    'deleteCoursePermanently',
    'deleteUnitPermanently',
    'deleteChapterPermanently',
    'deleteLessonPermanently',
  ] as const)(
    '%s preserves purchased content and does not remove stored assets',
    async (method) => {
      const findUnique = jest
        .fn()
        .mockResolvedValue({ id: 'content', title: 'Purchased content', sortOrder: 0 });
      const prisma = {
        course: { findUnique },
        unit: { findUnique },
        chapter: { findUnique },
        lesson: { findUnique, findMany: jest.fn() },
        orderItem: { count: jest.fn().mockResolvedValue(1) },
        $transaction: jest.fn(),
      };
      const storage = { removeObject: jest.fn(), removePrefix: jest.fn() };
      const audit = { record: jest.fn() };
      const service = new ContentDeletionService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        storage as unknown as StorageService,
      );
      await expect(service[method](actor, 'content', undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.lesson.findMany).not.toHaveBeenCalled();
      expect(storage.removeObject).not.toHaveBeenCalled();
      expect(storage.removePrefix).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    },
  );
});
