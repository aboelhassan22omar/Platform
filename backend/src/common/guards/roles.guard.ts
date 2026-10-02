import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Role hierarchy. A SUPER_ADMIN satisfies an @Roles(Role.ADMIN) requirement,
 * an ADMIN satisfies @Roles(Role.CONTENT_MANAGER), and so on. Students sit at
 * the bottom and inherit nothing.
 */
const RANK: Record<Role, number> = {
  STUDENT: 0,
  SUPPORT: 10,
  CONTENT_MANAGER: 20,
  ADMIN: 30,
  SUPER_ADMIN: 40,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('يجب تسجيل الدخول أولاً');

    const actorRank = RANK[user.role] ?? -1;
    const needed = Math.min(...required.map((role) => RANK[role] ?? Number.MAX_SAFE_INTEGER));

    if (actorRank < needed) {
      throw new ForbiddenException('لا تملك صلاحية الوصول لهذه الصفحة');
    }
    return true;
  }
}
