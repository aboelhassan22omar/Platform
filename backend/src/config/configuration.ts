import { resolvePlatformIdentity } from './platform-identity';

/**
 * Central, typed configuration. Every environment variable the backend reads
 * is parsed exactly once here so the rest of the code never touches
 * `process.env` directly.
 *
 * `validateEnv` runs at boot and refuses to start on a misconfiguration that
 * would be unsafe in production (default secrets, dev payment adapter, etc.).
 */

export type PaymentProviderKey = 'dev' | 'paymob' | 'manual';
export type PhoneVerificationMode = 'off' | 'console' | 'sms' | 'whatsapp';

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/** Parses `360p:800:96,480p:1400:128` into a structured HLS ladder. */
export interface HlsRendition {
  name: string;
  height: number;
  videoKbps: number;
  audioKbps: number;
}

export const parseRenditions = (raw: string | undefined): HlsRendition[] => {
  const fallback = '360p:800:96,480p:1400:128,720p:2800:128';
  return list(raw || fallback).map((entry) => {
    const [name, videoKbps, audioKbps] = entry.split(':');
    return {
      name,
      height: int(name.replace(/p$/i, ''), 360),
      videoKbps: int(videoKbps, 800),
      audioKbps: int(audioKbps, 96),
    };
  });
};

export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  platform: resolvePlatformIdentity(),

  publicSiteUrl: process.env.PUBLIC_SITE_URL ?? 'http://localhost:7080',
  corsOrigins: list(process.env.CORS_ORIGINS),

  database: {
    url: process.env.DATABASE_URL ?? '',
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    /** Access token lifetime in seconds. Short — refresh rotates it. */
    accessTtl: int(process.env.JWT_ACCESS_TTL, 900),
    refreshTtl: int(process.env.JWT_REFRESH_TTL, 60 * 60 * 24 * 30),
    cookieSecure: bool(process.env.COOKIE_SECURE, false),
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  },

  playback: {
    secret: process.env.PLAYBACK_TOKEN_SECRET ?? '',
    /** Playback tickets are deliberately short-lived. */
    ttl: int(process.env.PLAYBACK_TOKEN_TTL, 300),
  },

  storage: {
    // Internal endpoint: how the API and worker reach storage.
    endpoint: process.env.S3_ENDPOINT ?? 'minio',
    port: int(process.env.S3_PORT, 9000),
    useSsl: bool(process.env.S3_USE_SSL, false),

    // Public endpoint: what goes into presigned URLs handed to a browser.
    // Defaults to the internal one, which is correct for a real S3 bucket;
    // local MinIO needs them to differ (minio:9000 vs localhost:7900).
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'minio',
    publicPort: int(process.env.S3_PUBLIC_PORT ?? process.env.S3_PORT, 9000),
    publicUseSsl: bool(process.env.S3_PUBLIC_USE_SSL ?? process.env.S3_USE_SSL, false),
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? '',
    videoBucket: process.env.S3_BUCKET_VIDEOS ?? 'amr-videos',
    publicBucket: process.env.S3_BUCKET_PUBLIC ?? 'amr-public',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
    maxUploadBytes: int(process.env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024 * 1024),
  },

  video: {
    renditions: parseRenditions(process.env.HLS_RENDITIONS),
    segmentSeconds: int(process.env.HLS_SEGMENT_SECONDS, 6),
    workerConcurrency: int(process.env.VIDEO_WORKER_CONCURRENCY, 1),
  },

  payments: {
    transferPhone: process.env.PAYMENT_TRANSFER_PHONE ?? '',
    provider: (process.env.PAYMENT_PROVIDER ?? 'dev') as PaymentProviderKey,
    currency: process.env.PAYMENT_CURRENCY ?? 'EGP',
    allowDevInProd: bool(process.env.PAYMENT_ALLOW_DEV_IN_PROD, false),
    paymob: {
      apiKey: process.env.PAYMOB_API_KEY ?? '',
      publicKey: process.env.PAYMOB_PUBLIC_KEY ?? '',
      secretKey: process.env.PAYMOB_SECRET_KEY ?? '',
      hmacSecret: process.env.PAYMOB_HMAC_SECRET ?? '',
      integrationIdCard: process.env.PAYMOB_INTEGRATION_ID_CARD ?? '',
      integrationIdWallet: process.env.PAYMOB_INTEGRATION_ID_WALLET ?? '',
      iframeId: process.env.PAYMOB_IFRAME_ID ?? '',
      baseUrl: process.env.PAYMOB_BASE_URL ?? 'https://accept.paymob.com',
    },
  },

  phoneVerification: (process.env.PHONE_VERIFICATION ?? 'off') as PhoneVerificationMode,
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    token: process.env.WHATSAPP_TOKEN ?? '',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v22.0',
    otpTemplate: process.env.WHATSAPP_OTP_TEMPLATE ?? '',
    otpLanguage: process.env.WHATSAPP_OTP_LANGUAGE ?? 'ar',
  },

  presence: {
    /** A heartbeat older than this means the student is no longer "online". */
    ttlSeconds: int(process.env.PRESENCE_TTL_SECONDS, 120),
    heartbeatSeconds: int(process.env.PRESENCE_HEARTBEAT_SECONDS, 45),
  },

  /**
   * Live classes run on LiveKit Cloud. The API key/secret only ever sign
   * short-lived room tokens server-side; the browser receives the URL and a
   * token, never the secret. Empty values disable going live.
   */
  livekit: {
    url: process.env.LIVEKIT_URL?.trim() ?? '',
    /** Optional server-to-server URL when the API cannot reach LIVEKIT_URL (e.g. a local container). */
    apiUrl: process.env.LIVEKIT_API_URL?.trim() ?? '',
    /**
     * Where LiveKit uploads recordings (S3 API endpoint of the video bucket).
     * Must be reachable from LiveKit's servers; defaults to the public storage
     * endpoint, which is right for a real S3 bucket.
     */
    recordingS3Endpoint: process.env.RECORDING_S3_ENDPOINT?.trim() ?? '',
    apiKey: process.env.LIVEKIT_API_KEY?.trim() ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET?.trim() ?? '',
  },

  rateLimit: {
    ttl: int(process.env.RATE_LIMIT_TTL, 60),
    max: int(process.env.RATE_LIMIT_MAX, 120),
    authMax: int(process.env.AUTH_RATE_LIMIT_MAX, 8),
    authWindow: int(process.env.AUTH_RATE_LIMIT_WINDOW, 600),
    authLock: int(process.env.AUTH_LOCK_SECONDS, 600),
  },

  seedDemoData: bool(process.env.SEED_DEMO_DATA, false),
});

export type AppConfig = ReturnType<typeof configuration>;

/** Secrets shipped in .env.example. Present in dev, fatal in production. */
const PLACEHOLDER_MARKERS = ['dev_only', 'change_me', 'replace_me'];

const isPlaceholder = (value: string): boolean =>
  PLACEHOLDER_MARKERS.some((marker) => value.toLowerCase().includes(marker));

/**
 * Fails fast on configuration that is merely inconvenient in development but
 * dangerous in production. Called from main.ts before the app listens.
 */
export const validateEnv = (config: AppConfig): void => {
  const errors: string[] = [];

  if (!config.database.url) errors.push('DATABASE_URL is required.');
  if (!/^v\d+\.\d+$/.test(config.whatsapp.graphVersion))
    errors.push('WHATSAPP_GRAPH_VERSION must be a pinned API version.');

  if (!config.platform.name) errors.push('PLATFORM_NAME is required.');
  if (!config.platform.teacherName) errors.push('TEACHER_NAME is required.');
  if (!/^[a-z][a-z0-9-]*$/.test(config.platform.subjectKey)) {
    errors.push('SUBJECT_KEY must be a lowercase slug (for example: chemistry).');
  }

  const secrets: Array<[string, string]> = [
    ['JWT_ACCESS_SECRET', config.auth.accessSecret],
    ['JWT_REFRESH_SECRET', config.auth.refreshSecret],
    ['PLAYBACK_TOKEN_SECRET', config.playback.secret],
  ];

  for (const [name, value] of secrets) {
    if (!value) {
      errors.push(`${name} is required.`);
      continue;
    }
    if (value.length < 32) {
      errors.push(`${name} must be at least 32 characters.`);
    }
    if (config.isProduction && isPlaceholder(value)) {
      errors.push(`${name} still holds a placeholder value from .env.example.`);
    }
  }

  if (config.auth.accessSecret && config.auth.accessSecret === config.auth.refreshSecret) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  if (config.rateLimit.authMax < 3) {
    errors.push('AUTH_RATE_LIMIT_MAX must be at least 3 to avoid trivial account lockout abuse.');
  }
  if (config.rateLimit.authWindow < 60) {
    errors.push('AUTH_RATE_LIMIT_WINDOW must be at least 60 seconds.');
  }
  if (config.rateLimit.authLock < 60) {
    errors.push('AUTH_LOCK_SECONDS must be at least 60 seconds.');
  }

  if (config.isProduction) {
    if (!config.auth.cookieSecure) {
      errors.push('COOKIE_SECURE must be true in production.');
    }
    if (config.payments.provider === 'dev' && !config.payments.allowDevInProd) {
      errors.push(
        'PAYMENT_PROVIDER=dev is a sandbox that moves no real money. ' +
          'Set PAYMENT_PROVIDER=paymob, or PAYMENT_ALLOW_DEV_IN_PROD=true to override deliberately.',
      );
    }
    if (config.payments.provider === 'paymob') {
      const { apiKey, hmacSecret, integrationIdCard } = config.payments.paymob;
      if (!apiKey) errors.push('PAYMOB_API_KEY is required when PAYMENT_PROVIDER=paymob.');
      if (!hmacSecret) {
        errors.push('PAYMOB_HMAC_SECRET is required — webhooks cannot be verified without it.');
      }
      if (!integrationIdCard) {
        errors.push('PAYMOB_INTEGRATION_ID_CARD is required when PAYMENT_PROVIDER=paymob.');
      }
    }
    if (!['dev', 'paymob', 'manual'].includes(config.payments.provider)) {
      errors.push('Unknown PAYMENT_PROVIDER.');
    }
    if (
      config.payments.provider === 'manual' &&
      !/^(010|011|012|015)\d{8}$/.test(config.payments.transferPhone)
    ) {
      errors.push('PAYMENT_TRANSFER_PHONE is required for manual transfers.');
    }
    if (config.seedDemoData) {
      errors.push('SEED_DEMO_DATA must be false in production.');
    }
    if (!config.corsOrigins.length) {
      errors.push('CORS_ORIGINS must list the site origin in production.');
    }
  }

  if (errors.length) {
    throw new Error(
      `Invalid configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}\n` +
        'See .env.example for the expected values.',
    );
  }
};
