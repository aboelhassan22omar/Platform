import { Injectable, Logger } from '@nestjs/common';
import { MessageKind, MessageStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { normalizeEgyptianPhone } from '../common/utils/phone.util';
import { cairoParts, startOfCairoDay } from '../common/utils/cairo-time';
import { MESSAGE_TEMPLATES, cleanParam, renderTemplate } from './message-templates';
import { MessagingSettingsService, type MessagingSettings } from './messaging-settings.service';

export interface OutgoingMessage {
  kind: MessageKind;
  /** The student the message is about. */
  userId: string;
  /** Local Egyptian number as stored on the user. */
  phone: string;
  params: string[];
  /** One message per event and recipient; repeats are dropped. */
  dedupeKey: string;
  /** Pointless after this instant, e.g. once the live has started. */
  expiresAt?: Date;
}

/** Time-bound or awaited messages go out even during quiet hours. */
const IGNORES_QUIET_HOURS: ReadonlySet<MessageKind> = new Set([
  MessageKind.LIVE_REMINDER,
  MessageKind.PAYMENT_CONFIRMED,
]);

/** 01012345678 -> 201012345678, the format WhatsApp and wa.me expect. */
export const toWhatsAppNumber = (phone: string): string | null => {
  const local = normalizeEgyptianPhone(phone);
  return local ? `2${local}` : null;
};

export const waMeLink = (to: string, body: string) =>
  `https://wa.me/${to}?text=${encodeURIComponent(body)}`;

/**
 * The single way a WhatsApp message enters the system. Producers describe
 * what happened; this decides whether it goes out at all (mode and per-kind
 * switches), when (quiet hours) and how (automatic or by staff).
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: MessagingSettingsService,
  ) {}

  /** Returns how many new messages were queued. */
  async enqueue(messages: OutgoingMessage[]): Promise<number> {
    if (!messages.length) return 0;
    const settings = await this.settings.get();
    if (settings.mode === 'off') return 0;

    const now = new Date();
    const rows = messages.flatMap((message) => {
      if (!settings.kinds[message.kind]) return [];
      const to = toWhatsAppNumber(message.phone);
      if (!to) return [];
      const template = MESSAGE_TEMPLATES[message.kind];
      const params = message.params.map(cleanParam);
      return [
        {
          kind: message.kind,
          audience: template.audience,
          userId: message.userId,
          toPhone: to,
          templateName: template.name,
          params,
          body: renderTemplate(template.text, params),
          status: settings.mode === 'manual' ? MessageStatus.MANUAL : MessageStatus.PENDING,
          dedupeKey: message.dedupeKey,
          scheduledFor: IGNORES_QUIET_HOURS.has(message.kind)
            ? now
            : this.afterQuietHours(now, settings),
          expiresAt: message.expiresAt,
        },
      ];
    });
    if (!rows.length) return 0;

    let created = 0;
    // Chunked so a weekly run for thousands of parents stays well under
    // Postgres' parameter limit.
    for (let index = 0; index < rows.length; index += 500) {
      const result = await this.prisma.outboundMessage.createMany({
        data: rows.slice(index, index + 500),
        skipDuplicates: true,
      });
      created += result.count;
    }
    if (created) this.logger.log(`Queued ${created} WhatsApp message(s)`);
    return created;
  }

  /** Next allowed sending time: now, or the end of tonight's quiet hours. */
  afterQuietHours(now: Date, settings: MessagingSettings): Date {
    const { enabled, from, to } = settings.quietHours;
    if (!enabled || from === to) return now;
    const hour = cairoParts(now).hour;
    const quiet = from > to ? hour >= from || hour < to : hour >= from && hour < to;
    if (!quiet) return now;
    // Late evening waits for tomorrow morning; after midnight, for this morning.
    const dayOffset = from > to && hour >= from ? 1 : 0;
    return new Date(startOfCairoDay(now, dayOffset).getTime() + to * 3_600_000);
  }
}
