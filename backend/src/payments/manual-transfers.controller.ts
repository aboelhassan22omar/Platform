import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { Role } from '../generated/prisma/enums';
import { OrdersService } from './orders.service';

class TransferDto {
  @IsString() @Matches(/^(010|011|012|015)\d{8}$/) senderPhone!: string;
  @IsString() @MinLength(3) @MaxLength(100) transactionReference!: string;
}
class ApproveTransferDto {
  @IsInt() @Min(1) receivedAmountMinor!: number;
  @IsString() @MinLength(3) @MaxLength(100) transactionReference!: string;
}
@Controller()
export class ManualTransfersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}
  private assertEnabled() {
    if (this.config.get('payments.provider') !== 'manual')
      throw new BadRequestException('التحويل اليدوي غير مفعل');
  }
  @Post('orders/:reference/transfer')
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reference') reference: string,
    @Body() dto: TransferDto,
  ) {
    this.assertEnabled();
    const order = await this.prisma.order.findFirst({
      where: { reference, userId: user.id, status: 'AWAITING_PAYMENT' },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود أو انتهت مراجعته');
    await this.prisma.payment.updateMany({
      where: { orderId: order.id, provider: 'MANUAL', status: 'PENDING' },
      data: { providerPayload: { ...dto, submittedAt: new Date().toISOString() } },
    });
    return { submitted: true, notice: 'لن تفتح الحصة إلا بعد مراجعة وصول المبلغ في حساب المستلم' };
  }
  @Roles(Role.ADMIN)
  @Get('admin/transfers')
  list() {
    this.assertEnabled();
    return this.prisma.payment.findMany({
      where: { provider: 'MANUAL', status: 'PENDING', order: { status: 'AWAITING_PAYMENT' } },
      include: {
        order: { include: { user: { select: { fullName: true, phone: true } }, items: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
  @Roles(Role.ADMIN)
  @Post('admin/transfers/:orderId/approve')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: ApproveTransferDto,
  ) {
    this.assertEnabled();
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (dto.receivedAmountMinor !== order.totalMinor)
      throw new BadRequestException('المبلغ المستلم لا يطابق الطلب');
    if (!['AWAITING_PAYMENT', 'PAID'].includes(order.status))
      throw new BadRequestException('الطلب لا يقبل تأكيد الدفع');
    await this.orders.settleOrder(orderId, {
      eventId: `review_${orderId}`,
      eventType: 'manual.approval',
      providerRef: `manual_${dto.transactionReference.trim()}`,
      orderReference: order.reference,
      succeeded: true,
      amountMinor: dto.receivedAmountMinor,
      method: 'MANUAL',
      raw: { ...dto, approvedBy: user.id },
      approvedBy: user.id,
    });
    return { approved: true };
  }
}
