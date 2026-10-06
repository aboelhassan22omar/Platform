export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/** Only allow same-origin application routes in the post-auth redirect. */
export function safeRedirectTarget(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export function authSwitchHref(path: '/login' | '/register', rawNext: string | null): string {
  const next = safeRedirectTarget(rawNext, '');
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
