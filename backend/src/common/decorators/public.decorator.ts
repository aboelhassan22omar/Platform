import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without authentication. The global JwtAuthGuard
 * denies everything by default, so access is opt-out rather than opt-in — a
 * new endpoint is protected unless someone deliberately says otherwise.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
