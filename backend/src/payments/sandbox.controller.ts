import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { DevSandboxProvider } from './providers/dev-sandbox.provider';
import { OrdersService } from './orders.service';

class SandboxConfirmDto {
  @IsString()
  reference!: string;

  @IsString()
  providerRef!: string;

  @IsOptional()
  @IsBoolean()
  success?: boolean;
}

/**
 * Development-only endpoint that stands in for the payment provider calling
 * our webhook. It lets the whole purchase journey be tested locally.
 *
 * It does NOT shortcut authorisation: it builds the same signed payload the
 * real provider would send and feeds it through the same settlement path, so
 * what is exercised in development is the production code path.
 *
 * Refuses to run unless the dev sandbox provider is the active one.
 */
@ApiExcludeController()
@Controller('payments/sandbox')
export class SandboxController {
  private readonly logger = new Logger(SandboxController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sandbox: DevSandboxProvider,
    private readonly orders: OrdersService,
  ) {}

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SandboxConfirmDto,
  ) {
    if (this.config.get<string>('payments.provider') !== 'dev') {
      throw new ForbiddenException('Sandbox confirmation is disabled.');
    }

    const order = await this.prisma.order.findUnique({
      where: { reference: dto.reference },
      select: { id: true, userId: true, totalMinor: true },
    });

    if (!order) throw new BadRequestException('الطلب غير موجود');
    // A student may only confirm their own sandbox order.
    if (order.userId !== user.id) throw new ForbiddenException('الطلب ده مش بتاعك');

    const payload = JSON.stringify({
      eventId: `dev_evt_${dto.providerRef}`,
      providerRef: dto.providerRef,
      reference: dto.reference,
      success: dto.success !== false,
      amountMinor: order.totalMinor,
    });

    const event = await this.sandbox.verifyWebhook(Buffer.from(payload, 'utf8'), {
      'x-sandbox-signature': this.sandbox.sign(payload),
    });

    if (!event) throw new BadRequestException('Sandbox signature failure');

    // Record the event so replays are caught exactly as in production.
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: this.sandbox.key, eventId: event.eventId } },
    });

    if (existing?.processedAt) {
      return { ok: true, duplicate: true };
    }

    if (!existing) {
      await this.prisma.webhookEvent.create({
        data: {
          provider: this.sandbox.key,
          eventId: event.eventId,
          eventType: event.eventType,
          payload: JSON.parse(payload),
        },
      });
    }

    await this.orders.settleOrder(order.id, event);
    await this.prisma.webhookEvent.updateMany({
      where: { provider: this.sandbox.key, eventId: event.eventId },
      data: { processedAt: new Date(), attempts: { increment: 1 } },
    });

    this.logger.warn(
      `[SANDBOX] Settled order ${dto.reference} — no real payment was taken.`,
    );

    return {
      ok: true,
      sandbox: true,
      notice: 'تمت المحاكاة في وضع التطوير فقط — لم يتم خصم أي مبلغ حقيقي.',
    };
  }
}
