import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { OrdersService } from './orders.service';
import { PAYMENT_PROVIDER } from './payments.constants';
import type { IPaymentProvider } from './providers/payment-provider.interface';
import { CreateCheckoutDto } from './dto/checkout.dto';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: IPaymentProvider,
  ) {}

  // --------------------------------------------------------------------------
  // Student-facing
  // --------------------------------------------------------------------------

  @Post('checkout')
  @ApiOperation({ summary: 'إنشاء طلب شراء وبدء الدفع' })
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.createOrder({
      userId: user.id,
      productIds: dto.productIds,
      couponCode: dto.couponCode,
      method: dto.method,
      idempotencyKey: idempotencyKey ?? dto.idempotencyKey,
    });
  }

  @Get('orders')
  @ApiOperation({ summary: 'طلباتي' })
  listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listForUser(user.id);
  }

  @Get('orders/:reference')
  @ApiOperation({ summary: 'تفاصيل طلب' })
  getOrder(@CurrentUser() user: AuthenticatedUser, @Param('reference') reference: string) {
    return this.orders.findByReference(reference, user.id);
  }

  @Get('subscriptions/mine')
  @ApiOperation({ summary: 'اشتراكاتي' })
  mySubscriptions(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listSubscriptions(user.id);
  }

  // --------------------------------------------------------------------------
  // Webhooks
  // --------------------------------------------------------------------------

  /**
   * The ONLY path that grants paid access.
   *
   * A student returning from the payment page grants nothing — the browser is
   * not trusted. Access appears when the provider calls this endpoint and the
   * signature verifies.
   *
   * Processing is idempotent at two levels: the unique index on
   * (provider, eventId) rejects a replayed event outright, and settleOrder
   * returns early for an order that is already PAID.
   */
  @Public()
  @Post('webhooks/payments')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
    @Query('hmac') hmacQuery?: string,
  ) {
    // `rawBody` is preserved by the bodyParser verify hook in main.ts —
    // signatures are computed over the exact bytes, not a re-serialised object.
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      this.logger.error('Webhook received without a raw body — check bodyParser config');
      throw new BadRequestException('Invalid payload');
    }

    // Paymob puts the HMAC in the query string; normalise it into the headers
    // bag so providers share one verification signature.
    const event = await this.provider.verifyWebhook(rawBody, {
      ...headers,
      ...(hmacQuery ? { 'x-paymob-hmac': hmacQuery } : {}),
    });

    if (!event) {
      this.logger.warn('Rejected webhook: signature verification failed');
      throw new BadRequestException('Invalid signature');
    }

    // Record first. If this insert conflicts, the event is a replay and there
    // is nothing more to do.
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: this.provider.key,
          eventId: event.eventId,
          eventType: event.eventType,
          payload: event.raw as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.log(`Duplicate webhook ${event.eventId} ignored`);
        return { received: true, duplicate: true };
      }
      throw error;
    }

    const order = event.orderReference
      ? await this.prisma.order.findUnique({
          where: { reference: event.orderReference },
          select: { id: true },
        })
      : await this.prisma.payment
          .findFirst({
            where: { provider: this.provider.key, providerRef: event.providerRef },
            select: { orderId: true },
          })
          .then((p) => (p ? { id: p.orderId } : null));

    if (!order) {
      await this.markProcessed(event.eventId, 'Order not found for event');
      this.logger.error(`Webhook ${event.eventId} references an unknown order`);
      // 200 so the provider stops retrying something we can never resolve.
      return { received: true, matched: false };
    }

    try {
      await this.orders.settleOrder(order.id, event);
      await this.markProcessed(event.eventId);
      return { received: true, matched: true };
    } catch (error) {
      await this.markProcessed(event.eventId, (error as Error).message);
      throw error;
    }
  }

  private async markProcessed(eventId: string, error?: string): Promise<void> {
    await this.prisma.webhookEvent.updateMany({
      where: { provider: this.provider.key, eventId },
      data: {
        processedAt: error ? null : new Date(),
        error: error?.slice(0, 500),
        attempts: { increment: 1 },
      },
    });
  }
}
