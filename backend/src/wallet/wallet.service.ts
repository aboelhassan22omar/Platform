import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Role, WalletTransactionType } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';

type Tx = Prisma.TransactionClient;

/** Thrown inside a settlement when the balance no longer covers the order. */
export class InsufficientBalanceError extends BadRequestException {
  constructor(
    readonly balanceMinor: number,
    readonly requiredMinor: number,
  ) {
    super({
      message: `رصيدك ${pounds(balanceMinor)} جنيه وناقصك ${pounds(
        Math.max(0, requiredMinor - balanceMinor),
      )} جنيه. اشحن رصيدك الأول.`,
      code: 'INSUFFICIENT_BALANCE',
    });
  }

  get shortfallMinor(): number {
    return Math.max(0, this.requiredMinor - this.balanceMinor);
  }
}

const pounds = (minor: number) => (minor / 100).toLocaleString('ar-EG');

/** Smallest and largest single top-up, in piastres. */
export const TOPUP_MIN_MINOR = 1_000;
export const TOPUP_MAX_MINOR = 1_000_000;

/**
 * The student's balance on the platform.
 *
 * Every change is one guarded UPDATE of users.walletBalanceMinor plus one
 * WalletTransaction row, always inside the caller's transaction, so the
 * balance and its statement can never disagree. The debit only succeeds while
 * the balance covers it, and a CHECK constraint backs that up in the database.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async credit(
    tx: Tx,
    input: {
      userId: string;
      amountMinor: number;
      type: WalletTransactionType;
      orderId?: string;
      note?: string;
      actorId?: string;
    },
  ) {
    if (input.amountMinor <= 0) throw new BadRequestException('المبلغ لازم يكون أكبر من صفر');
    const user = await tx.user.update({
      where: { id: input.userId },
      data: { walletBalanceMinor: { increment: input.amountMinor } },
      select: { walletBalanceMinor: true },
    });
    return tx.walletTransaction.create({
      data: {
        userId: input.userId,
        type: input.type,
        amountMinor: input.amountMinor,
        balanceAfterMinor: user.walletBalanceMinor,
        orderId: input.orderId,
        note: input.note,
        actorId: input.actorId,
      },
    });
  }

  async debit(
    tx: Tx,
    input: {
      userId: string;
      amountMinor: number;
      type: WalletTransactionType;
      orderId?: string;
      note?: string;
      actorId?: string;
    },
  ) {
    if (input.amountMinor <= 0) throw new BadRequestException('المبلغ لازم يكون أكبر من صفر');
    // Conditional decrement: two purchases racing for the same balance cannot
    // both pass, because the second sees the already-lowered row.
    const { count } = await tx.user.updateMany({
      where: { id: input.userId, walletBalanceMinor: { gte: input.amountMinor } },
      data: { walletBalanceMinor: { decrement: input.amountMinor } },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { walletBalanceMinor: true },
    });
    if (!count) throw new InsufficientBalanceError(user.walletBalanceMinor, input.amountMinor);
    return tx.walletTransaction.create({
      data: {
        userId: input.userId,
        type: input.type,
        amountMinor: -input.amountMinor,
        balanceAfterMinor: user.walletBalanceMinor,
        orderId: input.orderId,
        note: input.note,
        actorId: input.actorId,
      },
    });
  }

  async balance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalanceMinor: true },
    });
    return user?.walletBalanceMinor ?? 0;
  }

  /** Balance plus the latest statement lines, newest first. */
  async summary(userId: string, take = 50) {
    const [balanceMinor, transactions] = await Promise.all([
      this.balance(userId),
      this.prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          type: true,
          amountMinor: true,
          balanceAfterMinor: true,
          note: true,
          createdAt: true,
          order: {
            select: { reference: true, items: { select: { titleSnapshot: true } } },
          },
        },
      }),
    ]);
    return {
      balanceMinor,
      transactions: transactions.map(({ order, ...row }) => ({
        ...row,
        orderReference: order?.reference ?? null,
        items: order?.items.map((item) => item.titleSnapshot) ?? [],
      })),
    };
  }

  /**
   * Staff add or remove balance by hand — cash paid at the center, a refund, a
   * correction. Signed amount; the reason is shown to the student.
   */
  async adjustByStaff(input: {
    actorId: string;
    userId: string;
    amountMinor: number;
    note: string;
    ip?: string;
  }) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor === 0) {
      throw new BadRequestException('اكتب مبلغ صحيح');
    }
    const student = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { role: true },
    });
    if (!student || student.role !== Role.STUDENT) throw new NotFoundException('الطالب غير موجود');

    const row = await this.prisma.$transaction(async (tx) => {
      const params = {
        userId: input.userId,
        amountMinor: Math.abs(input.amountMinor),
        note: input.note,
        actorId: input.actorId,
      };
      const created =
        input.amountMinor > 0
          ? await this.credit(tx, { ...params, type: WalletTransactionType.ADMIN_CREDIT })
          : await this.debit(tx, { ...params, type: WalletTransactionType.ADMIN_DEBIT });
      await this.audit.record(tx, {
        actorId: input.actorId,
        action: input.amountMinor > 0 ? 'wallet.credit' : 'wallet.debit',
        entityType: 'WalletTransaction',
        entityId: created.id,
        targetUserId: input.userId,
        metadata: { amountMinor: input.amountMinor, note: input.note },
        ip: input.ip,
      });
      await tx.notification.create({
        data: {
          userId: input.userId,
          kind: 'PURCHASE',
          title: input.amountMinor > 0 ? 'اتضاف رصيد لمحفظتك 💰' : 'اتخصم مبلغ من محفظتك',
          body: `${input.note} — رصيدك دلوقتي ${(created.balanceAfterMinor / 100).toLocaleString('ar-EG')} جنيه.`,
          href: '/dashboard/wallet',
        },
      });
      return created;
    });
    return { balanceMinor: row.balanceAfterMinor, transactionId: row.id };
  }
}
