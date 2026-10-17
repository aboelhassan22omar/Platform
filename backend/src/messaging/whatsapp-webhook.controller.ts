import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MessageStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { Public } from '../common/decorators';
import type { AppConfig } from '../config/configuration';

interface StatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  errors?: Array<{ title?: string; message?: string }>;
}

/**
 * Delivery receipts from WhatsApp, so the log shows delivered / read /
 * failed. Subscribe the "messages" field of the app to
 * <PUBLIC_SITE_URL>/api/webhooks/whatsapp with WHATSAPP_VERIFY_TOKEN.
 */
@ApiExcludeController()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  private readonly cfg: AppConfig['whatsapp'];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.cfg = config.get<AppConfig['whatsapp']>('whatsapp')!;
  }

  /** One-time subscription handshake. */
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    if (mode !== 'subscribe' || !this.cfg.verifyToken || token !== this.cfg.verifyToken) {
      throw new ForbiddenException('Verification failed');
    }
    return challenge ?? '';
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: Request, @Headers('x-hub-signature-256') signature?: string) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !this.cfg.appSecret || !this.validSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid signature');
    }

    const body = req.body as {
      entry?: Array<{ changes?: Array<{ value?: { statuses?: StatusUpdate[] } }> }>;
    };
    const statuses = (body.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) => change.value?.statuses ?? []),
    );
    for (const update of statuses) await this.apply(update);
    return { received: true };
  }

  private validSignature(rawBody: Buffer, signature?: string): boolean {
    if (!signature?.startsWith('sha256=')) return false;
    const expected = Buffer.from(
      `sha256=${createHmac('sha256', this.cfg.appSecret).update(rawBody).digest('hex')}`,
    );
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private async apply(update: StatusUpdate): Promise<void> {
    const at = update.timestamp ? new Date(Number(update.timestamp) * 1000) : new Date();
    // Receipts can arrive out of order: never move a read message back to delivered.
    const data =
      update.status === 'delivered'
        ? { status: MessageStatus.DELIVERED, deliveredAt: at }
        : update.status === 'read'
          ? { status: MessageStatus.READ, readAt: at }
          : update.status === 'failed'
            ? {
                status: MessageStatus.FAILED,
                lastError: (
                  update.errors?.[0]?.message ??
                  update.errors?.[0]?.title ??
                  'failed'
                ).slice(0, 500),
              }
            : null;
    if (!data) return;
    const allowedFrom =
      update.status === 'read'
        ? [MessageStatus.SENT, MessageStatus.DELIVERED]
        : update.status === 'delivered'
          ? [MessageStatus.SENT]
          : [MessageStatus.SENT, MessageStatus.DELIVERED];
    const { count } = await this.prisma.outboundMessage.updateMany({
      where: { providerMessageId: update.id, status: { in: allowedFrom } },
      data,
    });
    if (!count)
      this.logger.debug(`No message to update for receipt ${update.id} (${update.status})`);
  }
}
