import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Limits that stop one paid account from being shared. Applied to students
 * only; staff are never limited.
 */
export interface AccessSettings {
  /** Devices a student may sign in from. 0 = unlimited. */
  maxDevices: number;
  /**
   * Times a student may watch a lesson video, unless the lesson sets its own
   * number. 0 = unlimited. One view = the video's length in streamed time.
   */
  defaultMaxViews: number;
}

const KEY = 'security.access';
const DEFAULTS: AccessSettings = { maxDevices: 2, defaultMaxViews: 0 };
/** Read on every streamed segment, so it is cached briefly per API instance. */
const CACHE_MS = 30_000;

@Injectable()
export class AccessSettingsService {
  private cached: { value: AccessSettings; until: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AccessSettings> {
    if (this.cached && this.cached.until > Date.now()) return this.cached.value;
    const row = await this.prisma.siteSetting.findUnique({ where: { key: KEY } });
    const stored = (row?.value ?? {}) as Partial<AccessSettings>;
    const value = {
      maxDevices: stored.maxDevices ?? DEFAULTS.maxDevices,
      defaultMaxViews: stored.defaultMaxViews ?? DEFAULTS.defaultMaxViews,
    };
    this.cached = { value, until: Date.now() + CACHE_MS };
    return value;
  }

  async set(settings: AccessSettings): Promise<AccessSettings> {
    const value = { ...settings } as unknown as Prisma.InputJsonValue;
    await this.prisma.siteSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    });
    this.cached = null;
    return this.get();
  }
}
