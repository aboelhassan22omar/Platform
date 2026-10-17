import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { generateToken, hashToken } from '../common/utils/reference.util';
import { AccessSettingsService } from '../settings/access-settings.service';

/** httpOnly cookie naming the browser. Sent only to the auth endpoints. */
export const DEVICE_COOKIE = 'device_id';
/** Browsers cap cookie lifetime at about 400 days; every sign-in renews it. */
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 400 * 86_400;

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32,128}$/;

export class DeviceLimitException extends ForbiddenException {
  constructor(limit: number) {
    super({
      message:
        limit === 1
          ? 'حسابك مفتوح على جهاز تاني. الحساب بيشتغل على جهاز واحد بس، ولو غيّرت جهازك كلّم الدعم يشيلوا الجهاز القديم.'
          : `حسابك مفتوح على ${limit} أجهزة، ودي أقصى عدد مسموح. لو غيّرت جهاز كلّم الدعم يشيلوا جهاز قديم.`,
      code: 'DEVICE_LIMIT',
      limit,
    });
  }
}

export interface DeviceContext {
  ip?: string;
  userAgent?: string;
  /** Raw value of the device cookie, when the browser sent one. */
  deviceToken?: string;
}

/** "Chrome على Android" — enough for a student or support to recognise a device. */
export function describeDevice(userAgent?: string): string {
  const ua = userAgent ?? '';
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser\//.test(ua)
        ? 'Samsung Internet'
        : /CriOS\/|Chrome\//.test(ua)
          ? 'Chrome'
          : /FxiOS\/|Firefox\//.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'متصفح';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Mac OS X|Macintosh/.test(ua)
              ? 'Mac'
              : /Linux/.test(ua)
                ? 'Linux'
                : 'جهاز غير معروف';
  return `${browser} على ${os}`;
}

/**
 * Limits how many browsers one student account signs in from, so a paid
 * account cannot be handed around. A browser is named by a random httpOnly
 * cookie (only its hash is stored); each session (refresh token) belongs to
 * a device, so removing a device signs that browser out.
 *
 * Staff devices are recorded too but never limited.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessSettingsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Finds the device a sign-in comes from, or registers it if the account has
   * room. Returns the device id and the cookie value to (re)set.
   */
  async register(
    user: { id: string; role: Role },
    ctx: DeviceContext,
  ): Promise<{ deviceId: string; token: string }> {
    const token =
      ctx.deviceToken && TOKEN_SHAPE.test(ctx.deviceToken) ? ctx.deviceToken : generateToken(32);
    const tokenHash = hashToken(token);
    const seen = { lastSeenAt: new Date(), ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 255) };

    const deviceId = await this.prisma.$transaction(async (tx) => {
      // One registration per account at a time, so two new browsers signing in
      // together cannot both take the last free place.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
      const existing = await tx.userDevice.findUnique({
        where: { userId_tokenHash: { userId: user.id, tokenHash } },
        select: { id: true },
      });
      if (existing) {
        await tx.userDevice.update({ where: { id: existing.id }, data: seen });
        return existing.id;
      }

      if (user.role === Role.STUDENT) {
        const { maxDevices } = await this.access.get();
        if (maxDevices > 0) {
          const count = await tx.userDevice.count({ where: { userId: user.id } });
          if (count >= maxDevices) throw new DeviceLimitException(maxDevices);
        }
      }

      const created = await tx.userDevice.create({
        data: { userId: user.id, tokenHash, label: describeDevice(ctx.userAgent), ...seen },
        select: { id: true },
      });
      return created.id;
    });

    return { deviceId, token };
  }

  /** Marks a device as used now (called on every session refresh). */
  async touch(deviceId: string, ctx: DeviceContext): Promise<void> {
    await this.prisma.userDevice
      .update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date(), ip: ctx.ip },
      })
      .catch(() => undefined);
  }

  async list(userId: string) {
    const [devices, { maxDevices }] = await Promise.all([
      this.prisma.userDevice.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true, label: true, ip: true, firstSeenAt: true, lastSeenAt: true },
      }),
      this.access.get(),
    ]);
    return { limit: maxDevices, devices };
  }

  /** Which of the user's devices a request comes from, if any. */
  async currentDeviceId(userId: string, deviceToken?: string): Promise<string | null> {
    if (!deviceToken || !TOKEN_SHAPE.test(deviceToken)) return null;
    const device = await this.prisma.userDevice.findUnique({
      where: { userId_tokenHash: { userId, tokenHash: hashToken(deviceToken) } },
      select: { id: true },
    });
    return device?.id ?? null;
  }

  /**
   * Frees a device's place (or every place when deviceId is omitted). Its
   * sessions are deleted with it, and tokenVersion is bumped so live access
   * tokens die at once: the student's other devices quietly refresh, the
   * removed one is signed out.
   */
  async remove(input: { actorId: string; userId: string; deviceId?: string; ip?: string }) {
    const removed = await this.prisma.$transaction(async (tx) => {
      const where = { userId: input.userId, ...(input.deviceId ? { id: input.deviceId } : {}) };
      const devices = await tx.userDevice.findMany({ where, select: { id: true, label: true } });
      if (input.deviceId && !devices.length) throw new NotFoundException('الجهاز غير موجود');
      if (!devices.length) return [];
      await tx.userDevice.deleteMany({ where: { id: { in: devices.map((d) => d.id) } } });
      await tx.user.update({
        where: { id: input.userId },
        data: { tokenVersion: { increment: 1 } },
      });
      await this.audit.record(tx, {
        actorId: input.actorId,
        action: input.deviceId ? 'user.device.removed' : 'user.devices.reset',
        entityType: 'User',
        entityId: input.userId,
        targetUserId: input.userId,
        metadata: { devices: devices.map((d) => d.label) },
        ip: input.ip,
      });
      return devices;
    });
    return { removed: removed.length };
  }
}
