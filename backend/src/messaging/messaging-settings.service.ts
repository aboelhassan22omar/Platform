import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { MessageKind } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * How WhatsApp messages leave the platform:
 *  - off:    nothing is queued.
 *  - manual: messages wait in the dashboard; staff send each with a wa.me link.
 *  - cloud:  the dispatcher sends them through the WhatsApp Cloud API.
 */
export type MessagingMode = 'off' | 'manual' | 'cloud';

export interface MessagingSettings {
  mode: MessagingMode;
  kinds: Record<MessageKind, boolean>;
  weeklyReport: {
    /** 0 = Sunday … 6 = Saturday, Cairo time. */
    weekday: number;
    /** 0-23, Cairo time. */
    hour: number;
    /**
     * paying: students with active access, a subscription, or center students.
     * all: every active student.
     */
    audience: 'paying' | 'all';
  };
  /** No message is sent in this window (Cairo hours); it waits for morning. */
  quietHours: { enabled: boolean; from: number; to: number };
}

const KEY = 'messaging.whatsapp';
const CACHE_MS = 30_000;

export const DEFAULT_MESSAGING_SETTINGS: MessagingSettings = {
  mode: 'off',
  kinds: {
    WEEKLY_REPORT: true,
    NEW_LESSON: true,
    LIVE_REMINDER: true,
    HOMEWORK_DUE: true,
    SUBSCRIPTION_EXPIRING: true,
    PAYMENT_CONFIRMED: true,
    QUESTION_ANSWERED: true,
  },
  weeklyReport: { weekday: 5, hour: 18, audience: 'paying' },
  quietHours: { enabled: true, from: 22, to: 9 },
};

@Injectable()
export class MessagingSettingsService {
  private cached: { value: MessagingSettings; until: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<MessagingSettings> {
    if (this.cached && this.cached.until > Date.now()) return this.cached.value;
    const row = await this.prisma.siteSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<MessagingSettings>;
    const defaults = DEFAULT_MESSAGING_SETTINGS;
    const value: MessagingSettings = {
      mode: stored.mode ?? defaults.mode,
      kinds: { ...defaults.kinds, ...(stored.kinds ?? {}) },
      weeklyReport: { ...defaults.weeklyReport, ...(stored.weeklyReport ?? {}) },
      quietHours: { ...defaults.quietHours, ...(stored.quietHours ?? {}) },
    };
    this.cached = { value, until: Date.now() + CACHE_MS };
    return value;
  }

  async set(settings: MessagingSettings): Promise<MessagingSettings> {
    const value = settings as unknown as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    });
    this.cached = null;
    return this.get();
  }
}
