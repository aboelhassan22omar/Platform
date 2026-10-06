const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
};

export const DATABASE_URL = requireEnv('DATABASE_URL');
export const REDIS_URL = requireEnv('REDIS_URL');

export const S3 = {
  endPoint: process.env.S3_ENDPOINT ?? 'minio',
  port: Number(process.env.S3_PORT ?? 9000),
  useSSL: process.env.S3_USE_SSL === 'true',
  accessKey: requireEnv('S3_ACCESS_KEY'),
  secretKey: requireEnv('S3_SECRET_KEY'),
  region: process.env.S3_REGION ?? 'us-east-1',
};

export const VIDEO_BUCKET = process.env.S3_BUCKET_VIDEOS ?? 'amr-videos';
export const PUBLIC_BUCKET = process.env.S3_BUCKET_PUBLIC ?? 'amr-public';
export const SEGMENT_SECONDS = Number(process.env.HLS_SEGMENT_SECONDS ?? 6);
export const CONCURRENCY = Number(process.env.VIDEO_WORKER_CONCURRENCY ?? 1);

export interface Rendition {
  name: string;
  height: number;
  videoKbps: number;
  audioKbps: number;
}

export const RENDITIONS: Rendition[] = (
  process.env.HLS_RENDITIONS ?? '360p:800:96,480p:1400:128,720p:2800:128,1080p:5000:192'
)
  .split(',')
  .map((entry) => {
    const [name, videoKbps, audioKbps] = entry.trim().split(':');
    return {
      name,
      height: Number.parseInt(name.replace(/p$/i, ''), 10),
      videoKbps: Number(videoKbps),
      audioKbps: Number(audioKbps),
    };
  });
