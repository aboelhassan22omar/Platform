import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentUser, Public } from '../common/decorators';
import type { AuthenticatedUser } from '../common/decorators';
import { AuthService, type IssuedTokens, type SessionContext } from './auth.service';
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RegisterDto,
  RequestPasswordResetDto,
  UpdateProfileDto,
  VerifyOtpDto,
  OtpChallengeDto,
} from './dto/auth.dto';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

/**
 * Per-route throttle limits.
 *
 * `@Throttle` is evaluated when the class is defined, so these are read from
 * the environment at module load rather than injected. The defaults are the
 * production-appropriate values; an automated test environment raises
 * AUTH_RATE_LIMIT_MAX because every request arrives from one IP.
 *
 * Note this is only the coarse per-IP limit. Login is additionally throttled
 * per identifier in Redis (see AuthService.login), so spreading guesses for one
 * account across many IPs does not help an attacker.
 */
const AUTH_WINDOW_MS = 600_000;
const authLimit = (fallback: number): number => {
  const configured = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '', 10);
  return Number.isFinite(configured) && configured > 0
    ? Math.max(configured, fallback)
    : fallback;
};

const REGISTER_LIMIT = authLimit(5);
const LOGIN_LIMIT = authLimit(10);
const RESET_REQUEST_LIMIT = authLimit(4);
const RESET_CONFIRM_LIMIT = authLimit(6);

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // --------------------------------------------------------------------------
  // Cookie handling
  //
  // Tokens live in httpOnly cookies rather than localStorage so that an XSS
  // bug cannot read them. SameSite=Lax keeps them off cross-site requests
  // while still surviving the redirect back from the payment provider.
  // --------------------------------------------------------------------------

  private cookieOptions(maxAgeSeconds: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('auth.cookieSecure')!,
      sameSite: 'lax',
      domain: this.config.get<string>('auth.cookieDomain') || undefined,
      path: '/',
      maxAge: maxAgeSeconds * 1000,
    };
  }

  private setAuthCookies(res: Response, tokens: IssuedTokens): void {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, this.cookieOptions(tokens.accessTtl));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(tokens.refreshTtl),
      // The refresh cookie is only ever sent to the refresh/logout endpoints.
      path: '/api/auth',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...this.cookieOptions(0), maxAge: undefined });
    res.clearCookie(REFRESH_COOKIE, {
      ...this.cookieOptions(0),
      maxAge: undefined,
      path: '/api/auth',
    });
  }

  private sessionContext(req: Request): SessionContext {
    return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
  }

  // --------------------------------------------------------------------------
  // Endpoints
  // --------------------------------------------------------------------------

  @Public()
  @Post('register')
  @Throttle({ default: { limit: REGISTER_LIMIT, ttl: AUTH_WINDOW_MS } })
  @ApiOperation({ summary: 'تسجيل طالب جديد' })
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: authLimit(10), ttl: AUTH_WINDOW_MS } })
  async verifyRegistration(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.verifyRegistration(dto.challengeId, dto.code, this.sessionContext(req));
    this.setAuthCookies(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: AUTH_WINDOW_MS } })
  @ApiOperation({ summary: 'تسجيل الدخول' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(dto, this.sessionContext(req));
    this.setAuthCookies(res, tokens);
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تجديد الجلسة' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!presented) {
      this.clearAuthCookies(res);
      return { ok: false };
    }

    try {
      const tokens = await this.auth.refresh(presented, this.sessionContext(req));
      this.setAuthCookies(res, tokens);
      return { ok: true, accessToken: tokens.accessToken };
    } catch (error) {
      this.clearAuthCookies(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تسجيل الخروج' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'بيانات الحساب الحالي' })
  async me(@CurrentUser() actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) throw new NotFoundException('الحساب غير موجود');
    return this.auth.toProfile(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'تعديل البيانات الشخصية' })
  async updateProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    // Deliberately narrow: a student may change their display name and their
    // guardian's phone. Academic grade is NOT editable here — moving grade
    // would change which paid content is in scope, so it goes through support.
    const user = await this.prisma.user.update({
      where: { id: actor.id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.parentPhone ? { parentPhone: dto.parentPhone } : {}),
      },
    });
    return this.auth.toProfile(user);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تغيير كلمة السر' })
  async changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(actor.id, dto);
    this.clearAuthCookies(res);
    return { ok: true, message: 'تم تغيير كلمة السر، سجّل الدخول من جديد' };
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: RESET_REQUEST_LIMIT, ttl: AUTH_WINDOW_MS } })
  @ApiOperation({ summary: 'طلب إعادة تعيين كلمة السر' })
  async requestReset(@Body() dto: RequestPasswordResetDto) {
    const result = await this.auth.requestPasswordReset(dto.phone);
    return {
      // Always the same response, whether or not the phone is registered.
      message: 'لو الرقم مسجل عندنا هيوصلك كود التحقق على واتساب.',
      ...result,
    };
  }

  @Public()
  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: authLimit(5), ttl: AUTH_WINDOW_MS } })
  resendOtp(@Body() dto: OtpChallengeDto) {
    return this.auth.resendOtp(dto.challengeId);
  }

  @Public()
  @Post('password/reset/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: authLimit(10), ttl: AUTH_WINDOW_MS } })
  verifyReset(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyPasswordReset(dto.challengeId, dto.code);
  }

  @Public()
  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: RESET_CONFIRM_LIMIT, ttl: AUTH_WINDOW_MS } })
  @ApiOperation({ summary: 'تأكيد إعادة تعيين كلمة السر' })
  async confirmReset(@Body() dto: ConfirmPasswordResetDto) {
    await this.auth.confirmPasswordReset(dto);
    return { ok: true, message: 'تم تغيير كلمة السر، تقدر تسجّل الدخول دلوقتي' };
  }
}
