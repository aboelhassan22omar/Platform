import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MessageStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MessagingSettingsService } from './messaging-settings.service';
import { WhatsAppCloudClient, WhatsAppSendError } from './whatsapp-cloud.client';

const LOCK = 'lock:whatsapp-dispatch';
const BATCH = 60;
const MAX_ATTEMPTS = 3;

/**
 * Drains the outbox. Runs every few seconds on every API instance; a Redis
 * lock lets only one of them send at a time, so nothing goes out twice.
 */
@Injectable()
export class WhatsAppDispatcherService {
  private readonly logger = new Logger(WhatsAppDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: MessagingSettingsService,
    private readonly client: WhatsAppCloudClient,
  ) {}

  @Interval('whatsapp-dispatch', 15_000)
  async tick(): Promise<void> {
    const settings = await this.settings.get().catch(() => null);
    if (!settings) return;
    if (settings.mode === 'manual') {
      // Switched from automatic to manual: hand what is left to staff.
      await this.prisma.outboundMessage.updateMany({
        where: { status: MessageStatus.PENDING },
        data: { status: MessageStatus.MANUAL },
      });
      return;
    }
    if (settings.mode !== 'cloud' || !this.client.configured) return;

    const locked = await this.redis.client.set(LOCK, '1', 'EX', 60, 'NX').catch(() => null);
    if (locked !== 'OK') return;
    try {
      await this.drain();
    } finally {
      await this.redis.client.del(LOCK).catch(() => undefined);
    }
  }

  private async drain(): Promise<void> {
    const now = new Date();
    await this.prisma.outboundMessage.updateMany({
      where: {
        status: { in: [MessageStatus.PENDING, MessageStatus.MANUAL] },
        expiresAt: { lt: now },
      },
      data: { status: MessageStatus.CANCELLED, lastError: 'انتهى وقتها قبل ما تتبعت' },
    });

    const due = await this.prisma.outboundMessage.findMany({
      where: { status: MessageStatus.PENDING, scheduledFor: { lte: now } },
      orderBy: { scheduledFor: 'asc' },
      take: BATCH,
      select: { id: true, toPhone: true, templateName: true, params: true, attempts: true },
    });

    for (const message of due) {
      try {
        const providerMessageId = await this.client.sendTemplate(
          message.toPhone,
          message.templateName,
          message.params,
        );
        await this.prisma.outboundMessage.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.SENT,
            providerMessageId,
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
      } catch (error) {
        const attempts = message.attempts + 1;
        const permanent = error instanceof WhatsAppSendError && error.permanent;
        const giveUp = permanent || attempts >= MAX_ATTEMPTS;
        await this.prisma.outboundMessage.update({
          where: { id: message.id },
          data: {
            attempts,
            lastError: (error as Error).message.slice(0, 500),
            ...(giveUp
              ? { status: MessageStatus.FAILED }
              : { scheduledFor: new Date(Date.now() + 2 ** attempts * 60_000) }),
          },
        });
        if (giveUp)
          this.logger.warn(`WhatsApp message ${message.id} failed: ${(error as Error).message}`);
      }
    }
  }
}
