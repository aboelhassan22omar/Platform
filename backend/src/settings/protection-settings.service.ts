import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Content protection the admin switches on and off from the dashboard. Applied
 * to students only; staff always see the plain site.
 *
 * A web page cannot stop a screenshot or a screen recorder (the operating
 * system takes them, not the browser), so the protection is a moving
 * watermark that makes any leaked recording traceable to the student.
 */
export interface ProtectionSettings {
  /** Moving watermark with the student's name and phone over videos and lives. */
  watermark: boolean;
}

const KEY = 'security.protection';
const DEFAULTS: ProtectionSettings = { watermark: false };

@Injectable()
export class ProtectionSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ProtectionSettings> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<ProtectionSettings>;
    return {
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
