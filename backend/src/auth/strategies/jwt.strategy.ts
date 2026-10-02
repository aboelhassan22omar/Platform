import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
  /** Incremented on password change / forced logout to kill live tokens. */
  tv: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // The access token is read from an httpOnly cookie, with the Authorization
      // header as a fallback so the Swagger UI and integration tests work.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.accessSecret')!,
    });
  }

  /**
   * Re-reads the user on every request. This costs one indexed lookup but is
   * what makes suspension and forced logout take effect immediately rather
   * than whenever the access token happens to expire.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, status: true, tokenVersion: true },
    });

    if (!user) throw new UnauthorizedException('الحساب غير موجود');
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('تم إيقاف حسابك، تواصل مع الدعم');
    }
    if (user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('انتهت الجلسة، سجّل الدخول من جديد');
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
  }
}
