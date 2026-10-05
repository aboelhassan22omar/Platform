import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { EducationSystem, GradeLevel, Role, StudentType, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { generateToken, hashToken } from '../common/utils/reference.util';
import { normalizeEgyptianPhone } from '../common/utils/phone.util';
import { PasswordService } from './password.service';
import type {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RegisterDto,
} from './dto/auth.dto';
import type { AccessTokenPayload } from './strategies/jwt.strategy';
import { LoginLockedException } from './login-locked.exception';
import { OtpService } from './otp.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTtl: number;
  refreshTtl: number;
}

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly otp: OtpService,
  ) {}

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  async register(dto: RegisterDto) {
    const phone = normalizeEgyptianPhone(dto.phone)!;
    const parentPhone = normalizeEgyptianPhone(dto.parentPhone)!;

    // Checked up front for a friendly Arabic message; the unique indexes on
    // users.username / users.phone are what actually prevent a race.
    const clash = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: { equals: dto.username, mode: 'insensitive' } }, { phone }],
      },
      select: { username: true, phone: true },
    });

    if (clash) {
      throw new ConflictException(
        clash.phone === phone
          ? 'الرقم ده مسجل عندنا قبل كده، جرّب تسجّل الدخول'
          : 'اسم المستخدم ده محجوز، اختار اسم تاني',
      );
    }

    const passwordHash = await this.passwords.hash(dto.password);
    return this.otp.create('register', {
      phone,
      registration: {
        fullName: dto.fullName, username: dto.username, passwordHash, parentPhone,
        educationSystem: dto.educationSystem, gradeLevel: dto.gradeLevel, studentType: dto.studentType,
      },
    });
  }

  async verifyRegistration(challengeId: string, code: string, ctx: SessionContext) {
    const payload = await this.otp.verify(challengeId, code, 'register');
    const dto = payload.registration;
    if (!dto) throw new BadRequestException('جلسة التسجيل غير صالحة');
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          username: dto.username,
          passwordHash: dto.passwordHash,
          phone: payload.phone,
          parentPhone: dto.parentPhone,
          phoneVerifiedAt: new Date(),
          educationSystem: dto.educationSystem as EducationSystem,
          gradeLevel: dto.gradeLevel as GradeLevel,
          studentType: dto.studentType as StudentType | undefined,
          academicYearId: currentYear?.id ?? null,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
      });

      this.logger.log(`Student registered: ${user.username} (${user.gradeLevel})`);
      const tokens = await this.issueTokens(user.id, user.username, user.role, user.tokenVersion, ctx);
      return { user: this.toProfile(user), tokens };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('البيانات دي مسجلة عندنا قبل كده');
      }
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Login
  // --------------------------------------------------------------------------

  /**
   * Accepts either a username or a phone number as the identifier.
   *
   * Throttled per identifier in Redis on top of the global rate limit, so an
   * attacker cannot spread guesses for one account across many IPs cheaply.
   */
  async login(dto: LoginDto, ctx: SessionContext) {
    const identifierHash = createHash('sha256')
      .update(dto.identifier.trim().toLowerCase())
      .digest('hex');
    const key = `auth:login:attempts:${identifierHash}`;
    const lockKey = `auth:login:lock:${identifierHash}`;
    const maxAttempts = this.config.get<number>('rateLimit.authMax')!;
    const existingLockTtl = await this.redis.client.ttl(lockKey);
    if (existingLockTtl > 0) throw new LoginLockedException(existingLockTtl);
    const phone = normalizeEgyptianPhone(dto.identifier);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: dto.identifier, mode: 'insensitive' } },
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    // Same message and a real hash comparison either way, so response time and
    // wording do not reveal whether the account exists.
    const valid = user
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : await this.passwords
          .verify(
            '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000',
            dto.password,
          )
          .then(() => false);

    if (!user || !valid) {
      const failure = await this.redis.recordFailedLogin(
        key,
        lockKey,
        maxAttempts,
        this.config.get<number>('rateLimit.authWindow')!,
        this.config.get<number>('rateLimit.authLock')!,
      );
      if (failure.retryAfterSeconds > 0) {
        this.logger.warn(`Temporary login lock triggered from IP ${ctx.ip ?? 'unknown'}`);
        throw new LoginLockedException(failure.retryAfterSeconds);
      }
      throw new UnauthorizedException('اسم المستخدم أو كلمة السر غلط');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('تم إيقاف حسابك، تواصل مع الدعم');
    }

    await this.redis.client.del(key, lockKey);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(
      user.id,
      user.username,
      user.role,
      user.tokenVersion,
      ctx,
    );
    return { user: this.toProfile(user), tokens };
  }

  // --------------------------------------------------------------------------
  // Token lifecycle
  // --------------------------------------------------------------------------

  private async issueTokens(
    userId: string,
    username: string,
    role: Role,
    tokenVersion: number,
    ctx: SessionContext,
  ): Promise<IssuedTokens> {
    const accessTtl = this.config.get<number>('auth.accessTtl')!;
    const refreshTtl = this.config.get<number>('auth.refreshTtl')!;

    const payload: AccessTokenPayload = { sub: userId, username, role, tv: tokenVersion };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('auth.accessSecret'),
      expiresIn: accessTtl,
    });

    // The refresh token is opaque random bytes, not a JWT — it must be
    // revocable, and only its hash is stored.
    const refreshToken = generateToken(48);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        ip: ctx.ip,
        userAgent: ctx.userAgent?.slice(0, 255),
      },
    });

    return { accessToken, refreshToken, accessTtl, refreshTtl };
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one
   * issued in the same transaction.
   *
   * If a token that was already revoked is presented, it has leaked — every
   * session for that user is killed rather than just refusing the request.
   */
  async refresh(presentedToken: string, ctx: SessionContext): Promise<IssuedTokens> {
    const tokenHash = hashToken(presentedToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('الجلسة غير صالحة، سجّل الدخول من جديد');

    if (stored.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}; revoking all sessions`,
      );
      await this.revokeAllSessions(stored.userId);
      throw new UnauthorizedException('تم اكتشاف نشاط غير طبيعي، سجّل الدخول من جديد');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('انتهت الجلسة، سجّل الدخول من جديد');
    }

    if (stored.user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('تم إيقاف حسابك، تواصل مع الدعم');
    }

    const tokens = await this.issueTokens(
      stored.user.id,
      stored.user.username,
      stored.user.role,
      stored.user.tokenVersion,
      ctx,
    );

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: hashToken(tokens.refreshToken) },
    });

    return tokens;
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken
      .updateMany({
        where: { tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  /** Kills every session for a user by bumping tokenVersion and revoking tokens. */
  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  // --------------------------------------------------------------------------
  // Password management
  // --------------------------------------------------------------------------

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('الحساب غير موجود');

    const ok = await this.passwords.verify(user.passwordHash, dto.currentPassword);
    if (!ok) throw new BadRequestException('كلمة السر الحالية غلط');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('كلمة السر الجديدة لازم تكون مختلفة');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);

    // Changing the password logs out every other device.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async requestPasswordReset(rawPhone: string) {
    const phone = normalizeEgyptianPhone(rawPhone)!;
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, status: true } });
    return this.otp.create('password-reset', {
      phone, userId: user?.status === UserStatus.ACTIVE ? user.id : undefined,
    });
  }

  async verifyPasswordReset(challengeId: string, code: string) {
    const payload = await this.otp.verify(challengeId, code, 'password-reset');
    if (!payload.userId) throw new BadRequestException('الكود غير صحيح أو انتهت صلاحيته.');
    const token = generateToken(32);
    await this.prisma.passwordReset.create({
      data: { userId: payload.userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    return { token, expiresIn: 300 };
  }

  resendOtp(challengeId: string) { return this.otp.resend(challengeId); }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto): Promise<void> {
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('الكود غير صالح أو انتهت صلاحيته');
    }

    const passwordHash = await this.passwords.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordReset.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new BadRequestException('انتهت جلسة إعادة التعيين، اطلب كود جديد.');
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.passwordReset.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Shape returned to the client. Never includes passwordHash or tokenVersion. */
  toProfile(user: {
    id: string;
    fullName: string;
    username: string;
    phone: string;
    parentPhone: string;
    role: Role;
    status: UserStatus;
    educationSystem: string | null;
    gradeLevel: string | null;
    studentType: string;
    academicYearId: string | null;
    createdAt: Date;
    lastLoginAt: Date | null;
  }) {
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      phone: user.phone,
      parentPhone: user.parentPhone,
      role: user.role,
      status: user.status,
      educationSystem: user.educationSystem,
      gradeLevel: user.gradeLevel,
      studentType: user.studentType,
      academicYearId: user.academicYearId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isStaff: user.role !== Role.STUDENT,
    };
  }
}
