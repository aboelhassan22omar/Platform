import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { AuditService } from '../common/audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { normalizeEgyptianPhone } from '../common/utils/phone.util';
import { NotificationKind, OrderStatus, Role } from '../generated/prisma/enums';
import { OrdersService } from './orders.service';
import { TransferSettingsService } from './transfer-settings.service';
import { transferState, type TransferSubmission } from './transfer-state';

const RECEIPT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const EGYPTIAN_MOBILE = /^01[0125]\d{8}$/;
const normalizePhone = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? (normalizeEgyptianPhone(value) ?? value.trim()) : value,
  );

class ReceiptTicketDto {
  @IsIn(Object.keys(RECEIPT_TYPES), { message: 'ارفع صورة JPG أو PNG أو WEBP' })
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_RECEIPT_BYTES, { message: 'الصورة أكبر من ٥ ميجا' })
  sizeBytes!: number;
}

class SubmitTransferDto {
  @normalizePhone()
  @Matches(EGYPTIAN_MOBILE, { message: 'اكتب رقم الموبايل اللي حوّلت منه صح (01xxxxxxxxx)' })
  senderPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionReference?: string;

  @IsString()
  @Matches(/^receipts\/[a-z0-9]+\/[0-9a-f-]{36}\.(jpg|png|webp)$/, {
    message: 'ارفع صورة التحويل الأول',
  })
  receiptKey!: string;
}

class RejectTransferDto {
  @IsString()
  @MinLength(3, { message: 'اكتب سبب الرفض عشان الطالب يعرف يصلّح' })
  @MaxLength(300)
  reason!: string;
}

class TransferSettingsDto {
  @normalizePhone()
  @Matches(EGYPTIAN_MOBILE, { message: 'رقم فودافون كاش لازم يكون رقم مصري صحيح' })
  vodafoneCashPhone!: string;

  @normalizePhone()
  @Matches(EGYPTIAN_MOBILE, { message: 'رقم إنستا باي لازم يكون رقم مصري صحيح' })
  instapayPhone!: string;

  @IsString()
  @MaxLength(300)
  @Matches(/^$|^https:\/\/\S+$/, { message: 'لينك إنستا باي لازم يبدأ بـ https://' })
  instapayLink!: string;

  @IsString()
  @MaxLength(80)
  @Matches(/^$|^[A-Za-z0-9._-]+@instapay$/i, {
    message: 'عنوان إنستا باي لازم يكون بالشكل name@instapay',
  })
  instapayAddress!: string;

  @IsString()
  @MaxLength(60)
  recipientName!: string;
}

/**
 * Manual transfers (PAYMENT_PROVIDER=manual): the student transfers by
 * InstaPay or Vodafone Cash to the platform's number, then sends the number
 * they paid from and a screenshot. An admin approves (content unlocks
 * immediately) or rejects with a reason (the student can fix and resend).
 */
@Controller()
export class ManualTransfersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly settings: TransferSettingsService,
  ) {}

  private assertEnabled() {
    if (this.config.get('payments.provider') !== 'manual')
      throw new BadRequestException('التحويل اليدوي غير مفعل');
  }

  private async ownPendingOrder(reference: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { reference, userId, status: OrderStatus.AWAITING_PAYMENT },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود أو اتراجع خلاص');
    return order;
  }

  // --------------------------------------------------------------------------
  // Student
  // --------------------------------------------------------------------------

  /** A presigned upload for the transfer screenshot, stored privately. */
  @Post('orders/:reference/transfer/receipt')
  async receiptTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
    @Body() dto: ReceiptTicketDto,
  ) {
    this.assertEnabled();
    const order = await this.ownPendingOrder(reference, user.id);
    const key = `receipts/${order.id}/${randomUUID()}.${RECEIPT_TYPES[dto.contentType]}`;
    const upload = await this.storage.presignUpload(this.storage.videoBucket, key, 900);
    return {
      key,
      uploadUrl: upload.url,
      method: 'PUT' as const,
      headers: { 'Content-Type': dto.contentType },
    };
  }

  @Post('orders/:reference/transfer')
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
    @Body() dto: SubmitTransferDto,
  ) {
    this.assertEnabled();
    const order = await this.ownPendingOrder(reference, user.id);
    if (!dto.receiptKey.startsWith(`receipts/${order.id}/`)) {
      throw new BadRequestException('صورة التحويل مش تابعة للطلب ده');
    }
    const stat = await this.storage
      .statObject(this.storage.videoBucket, dto.receiptKey)
      .catch(() => null);
    if (!stat) throw new BadRequestException('صورة التحويل ما اترفعتش، جرّب ترفعها تاني');
    if (stat.size > MAX_RECEIPT_BYTES) throw new BadRequestException('الصورة أكبر من ٥ ميجا');

    const submission: TransferSubmission = {
      senderPhone: dto.senderPhone,
      transactionReference: dto.transactionReference?.trim() || undefined,
      receiptKey: dto.receiptKey,
      submittedAt: new Date().toISOString(),
    };
    const updated = await this.prisma.payment.updateMany({
      where: { orderId: order.id, provider: 'MANUAL', status: 'PENDING' },
      data: { providerPayload: submission as unknown as Prisma.InputJsonValue },
    });
    if (!updated.count) throw new NotFoundException('الطلب ده مش مستني تحويل');
    return { submitted: true };
  }

  // --------------------------------------------------------------------------
  // Admin
  // --------------------------------------------------------------------------

  @Roles(Role.ADMIN)
  @Get('admin/transfer-settings')
  getSettings() {
    return this.settings.get();
  }

  @Roles(Role.ADMIN)
  @Put('admin/transfer-settings')
  async updateSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: TransferSettingsDto,
    @Req() req: Request,
  ) {
    const saved = await this.settings.set({
      vodafoneCashPhone: dto.vodafoneCashPhone,
      instapayPhone: dto.instapayPhone,
      instapayLink: dto.instapayLink.trim(),
      instapayAddress: dto.instapayAddress.trim(),
      recipientName: dto.recipientName.trim(),
    });
    await this.audit.record(this.prisma, {
      actorId: actor.id,
      action: 'payments.transfer_settings.update',
      entityType: 'SiteSetting',
      entityId: 'payments.transfer',
      metadata: { ...saved },
      ip: req.ip,
    });
    return saved;
  }

  /** Transfers awaiting review, oldest first, with a short-lived screenshot link. */
  @Roles(Role.ADMIN)
  @Get('admin/transfers')
  async list() {
    this.assertEnabled();
    const payments = await this.prisma.payment.findMany({
      where: {
        provider: 'MANUAL',
        status: 'PENDING',
        order: { status: OrderStatus.AWAITING_PAYMENT },
      },
      include: {
        order: {
          include: {
            user: { select: { fullName: true, phone: true, username: true } },
            items: { select: { titleSnapshot: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return Promise.all(
      payments.map(async (payment) => {
        const submission = payment.providerPayload as unknown as TransferSubmission | null;
        const state = transferState(submission);
        return {
          orderId: payment.orderId,
          reference: payment.order.reference,
          amountMinor: payment.amountMinor,
          method: payment.method === 'CARD' ? 'INSTAPAY' : 'VODAFONE_CASH',
          createdAt: payment.createdAt,
          state,
          student: payment.order.user,
          items: payment.order.items.map((item) => item.titleSnapshot),
          senderPhone: submission?.senderPhone ?? null,
          transactionReference: submission?.transactionReference ?? null,
          submittedAt: submission?.submittedAt ?? null,
          rejectionReason: submission?.review?.reason ?? null,
          receiptUrl: submission?.receiptKey
            ? await this.storage
                .presignDownload(this.storage.videoBucket, submission.receiptKey, 900)
                .catch(() => null)
            : null,
        };
      }),
    );
  }

  @Roles(Role.ADMIN)
  @Post('admin/transfers/:orderId/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@CurrentUser() actor: AuthenticatedUser, @Param('orderId') orderId: string) {
    this.assertEnabled();
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { where: { provider: 'MANUAL' } } },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.status === OrderStatus.PAID) return { approved: true, alreadyPaid: true };
    if (order.status !== OrderStatus.AWAITING_PAYMENT)
      throw new BadRequestException('الطلب ده مش مستني تأكيد دفع');
    const submission = order.payments[0]?.providerPayload as unknown as TransferSubmission | null;

    // settleOrder grants the content and writes the audit entry (approvedBy).
    await this.orders.settleOrder(orderId, {
      eventId: `review_${orderId}`,
      eventType: 'manual.approval',
      providerRef: `manual_${order.reference}`,
      orderReference: order.reference,
      succeeded: true,
      amountMinor: order.totalMinor,
      method: order.payments[0]?.method ?? 'MANUAL',
      raw: { ...(submission ?? {}), approvedBy: actor.id },
      approvedBy: actor.id,
    });
    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        kind: NotificationKind.PURCHASE,
        title: 'تم تأكيد الدفع ✅',
        body: `اتأكدنا من تحويلك للطلب ${order.reference} والمحتوى اتفتح لك.`,
        href: '/dashboard/lessons',
      },
    });
    return { approved: true };
  }

  /** Sends the proof back with a reason; the order stays open so the student can resend. */
  @Roles(Role.ADMIN)
  @Post('admin/transfers/:orderId/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: RejectTransferDto,
    @Req() req: Request,
  ) {
    this.assertEnabled();
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { where: { provider: 'MANUAL', status: 'PENDING' } } },
    });
    if (!order || order.status !== OrderStatus.AWAITING_PAYMENT || !order.payments[0])
      throw new BadRequestException('الطلب ده مش مستني مراجعة');
    const payment = order.payments[0];
    const submission = (payment.providerPayload ?? {}) as unknown as TransferSubmission;
    const reason = dto.reason.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPayload: {
            ...submission,
            review: {
              status: 'rejected',
              reason,
              at: new Date().toISOString(),
              by: actor.id,
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'payment.transfer.rejected',
        entityType: 'Order',
        entityId: order.id,
        targetUserId: order.userId,
        metadata: { reference: order.reference, reason },
        ip: req.ip,
      });
      await tx.notification.create({
        data: {
          userId: order.userId,
          kind: NotificationKind.PURCHASE,
          title: 'محتاجين نراجع تحويلك تاني',
          body: `${reason} — افتح الطلب ${order.reference} وابعت البيانات الصح.`,
          href: `/checkout/return?ref=${order.reference}`,
        },
      });
    });
    return { rejected: true };
  }
}
