import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Role, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { generateToken } from '../common/utils/reference.util';
import { PasswordService } from './password.service';

/** Shown wherever the deleted student's name used to appear. */
export const DELETED_NAME = 'حساب محذوف';

/**
 * A student deleting their own account, from the site or the store apps
 * (Apple 5.1.1(v), Google Play's account-deletion policy).
 *
 * The user row is kept, because orders, payments and wallet movements are
 * financial records that must stay complete. Everything that identifies the
 * student is wiped from it, sign-in becomes impossible, and personal data
 * that has no bookkeeping value (sessions, devices, phones, notifications,
 * parent reports, study history) is deleted outright.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async deleteOwnAccount(userId: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, passwordHash: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new BadRequestException('الحساب ده اتحذف قبل كده');
    if (user.role !== Role.STUDENT) {
      throw new ForbiddenException('حسابات فريق العمل بيحذفها مدير المنصة من لوحة التحكم.');
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new BadRequestException('كلمة السر غلط');
    }

    const now = new Date();
    // Unique columns get a value nobody can type or register with.
    const tombstone = `deleted-${userId}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: DELETED_NAME,
          username: tombstone,
          phone: tombstone,
          parentPhone: '',
          passwordHash: `!${generateToken(32)}`,
          status: UserStatus.SUSPENDED,
          deletedAt: now,
          phoneVerifiedAt: null,
          parentReportsEnabled: false,
          deviceLimitExempt: false,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordReset.deleteMany({ where: { userId } });
      await tx.userDevice.deleteMany({ where: { userId } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.nativePushToken.deleteMany({ where: { userId } });
      await tx.lessonDownload.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.parentReport.deleteMany({ where: { userId } });
      await tx.studyDay.deleteMany({ where: { userId } });
      await tx.presenceRecord.deleteMany({ where: { userId } });
      // WhatsApp messages carry the student's and parent's numbers and names.
      await tx.outboundMessage.deleteMany({ where: { userId } });
      await this.audit.record(tx, {
        actorId: userId,
        action: 'user.account.deleted',
        entityType: 'User',
        entityId: userId,
        targetUserId: userId,
        ip,
      });
    });
    return { deleted: true };
  }
}
