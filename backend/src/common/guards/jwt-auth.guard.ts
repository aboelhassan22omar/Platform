import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Registered globally in AppModule. Every route requires a valid access token
 * unless it carries @Public(). Failing closed is the whole point: forgetting a
 * guard on a new endpoint leaves it protected, not exposed.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Public routes still run the JWT strategy when a cookie is present. This
    // lets catalogue pages recognise staff and show their unrestricted preview,
    // while handleRequest below keeps the same routes open to signed-out users.
    if (isPublic) return super.canActivate(context);
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser | null {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return user || null;
    return super.handleRequest(err, user, info, context, status as never);
  }
}
