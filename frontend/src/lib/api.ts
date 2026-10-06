/**
 * API client.
 *
 * Auth travels in httpOnly cookies, so every request sets
 * `credentials: 'include'` and no token is ever read or stored by JavaScript.
 *
 * Server components call the API directly over the compose network
 * (INTERNAL_API_URL), skipping the proxy; the browser goes through the public
 * origin so cookies stay first-party.
 */

const BROWSER_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const SERVER_BASE = process.env.INTERNAL_API_URL ?? 'http://backend:4000/api';

let browserRefresh: Promise<boolean> | null = null;

export const apiBase = (): string => (typeof window === 'undefined' ? SERVER_BASE : BROWSER_BASE);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly fieldErrors?: string[],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Forwarded cookies when calling from a server component. */
  cookie?: string;
}

/**
 * Normalises the API's Arabic error shape into a single readable message.
 * class-validator returns `message` as an array when several fields fail.
 */
const readError = async (response: Response): Promise<ApiError> => {
  let payload: {
    message?: string | string[];
    code?: string;
    retryAfterSeconds?: number;
  } = {};
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error (proxy timeout, HTML error page).
  }

  const raw = payload.message;
  const list = Array.isArray(raw) ? raw : undefined;
  const message =
    list?.[0] ??
    (typeof raw === 'string' ? raw : undefined) ??
    (response.status >= 500 ? 'في مشكلة في السيرفر، حاول تاني بعد شوية' : 'حصل خطأ، حاول تاني');

  const headerRetry = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
  const retryAfterSeconds = Number.isFinite(payload.retryAfterSeconds)
    ? payload.retryAfterSeconds
    : Number.isFinite(headerRetry)
      ? headerRetry
      : undefined;
  return new ApiError(response.status, message, payload.code, list, retryAfterSeconds);
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, cookie, headers, ...rest } = options;

  const execute = () =>
    fetch(`${apiBase()}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Authenticated data must never be served from a cache.
      cache: rest.cache ?? 'no-store',
    });

  let response = await execute();

  // A teacher can spend longer than the short access-token lifetime writing an
  // assessment. Renew the httpOnly session and replay the original request once
  // so publishing never loses their work. A shared promise prevents several
  // simultaneous queries from rotating the same refresh token more than once.
  if (response.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    browserRefresh ??= fetch(`${BROWSER_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (refreshResponse) => {
        if (!refreshResponse.ok) return false;
        const payload = (await refreshResponse.json().catch(() => null)) as { ok?: boolean } | null;
        return payload?.ok === true;
      })
      .catch(() => false)
      .finally(() => {
        browserRefresh = null;
      });

    if (await browserRefresh) response = await execute();
  }

  if (!response.ok) throw await readError(response);

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Server-component helper: forwards the incoming cookies so the API sees the
 * signed-in student. Returns null instead of throwing on 401/404, because a
 * signed-out visitor viewing a public page is a normal case, not an error.
 */
export async function apiFetchServer<T>(path: string, cookieHeader: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { cookie: cookieHeader });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
