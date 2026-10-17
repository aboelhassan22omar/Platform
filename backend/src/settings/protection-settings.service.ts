import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Content protection the admin switches on and off from the dashboard. Applied
 * to students only; staff always see the plain site.
 *
 * A web page cannot truly stop a screenshot or a screen recorder — the
 * operating system takes them, not the browser. These switches turn on the
 * deterrents a browser does allow (hide the page while it is not focused,
 * catch PrintScreen, block copy / right-click / print) and a moving watermark
 * that makes any leaked recording traceable to the student who made it.
 */
export interface ProtectionSettings {
  /** Hide content on focus loss, catch PrintScreen, block copy/right-click/print. */
  blockCapture: boolean;
  /** Moving watermark with the student's name and phone over videos and lives. */
  watermark: boolean;
}

const KEY = 'security.protection';
const DEFAULTS: ProtectionSettings = { blockCapture: false, watermark: false };

@Injectable()
export class ProtectionSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ProtectionSettings> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<ProtectionSettings>;
    return {
      blockCapture: stored.blockCapture ?? DEFAULTS.blockCapture,
      watermark: stored.watermark ?? DEFAULTS.watermark,
    };
  }

  async set(settings: ProtectionSettings): Promise<ProtectionSettings> {
    const value = { ...settings } as unknown as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    });
    return this.get();
  }
}
