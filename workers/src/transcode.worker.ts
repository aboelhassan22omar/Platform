import { spawn } from 'node:child_process';
import { mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Worker, type Job } from 'bullmq';
import { Client as MinioClient } from 'minio';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

/**
 * Video transcoding worker.
 *
 * Runs in its own container so ffmpeg — by far the heaviest thing in this
 * stack — never competes with API requests for CPU. Scale it independently:
 *
 *   docker compose up -d --scale worker=3
 *
 * For each job:
 *   1. download the source from private object storage to a temp dir
 *   2. probe it for duration and dimensions
 *   3. build an HLS ladder with ffmpeg, skipping renditions larger than the
 *      source (upscaling wastes CPU and looks worse)
 *   4. extract a poster frame
 *   5. upload the whole output prefix back to private storage
 *   6. mark the asset READY
 *
 * The temp directory is always cleaned up, including on failure.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
};

const DATABASE_URL = requireEnv('DATABASE_URL');
const REDIS_URL = requireEnv('REDIS_URL');

const S3 = {
  endPoint: process.env.S3_ENDPOINT ?? 'minio',
  port: Number(process.env.S3_PORT ?? 9000),
  useSSL: process.env.S3_USE_SSL === 'true',
  accessKey: requireEnv('S3_ACCESS_KEY'),
  secretKey: requireEnv('S3_SECRET_KEY'),
  region: process.env.S3_REGION ?? 'us-east-1',
};

const VIDEO_BUCKET = process.env.S3_BUCKET_VIDEOS ?? 'amr-videos';
const PUBLIC_BUCKET = process.env.S3_BUCKET_PUBLIC ?? 'amr-public';
const SEGMENT_SECONDS = Number(process.env.HLS_SEGMENT_SECONDS ?? 6);
const CONCURRENCY = Number(process.env.VIDEO_WORKER_CONCURRENCY ?? 1);

interface Rendition {
  name: string;
  height: number;
  videoKbps: number;
  audioKbps: number;
}

const RENDITIONS: Rendition[] = (
  process.env.HLS_RENDITIONS ??
  '360p:800:96,480p:1400:128,720p:2800:128,1080p:5000:192'
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

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const storage = new MinioClient({
  ...S3,
  pathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
});

const redisUrl = new URL(REDIS_URL);
const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

const log = (message: string) =>
  console.log(`[worker ${new Date().toISOString()}] ${message}`);

// ---------------------------------------------------------------------------
// ffmpeg helpers
// ---------------------------------------------------------------------------

interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
}

function run(
  command: string,
  args: string[],
  onStderr?: (chunk: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      const text = data.toString();
      // ffmpeg is verbose; keep only the tail for the error message.
      stderr = (stderr + text).slice(-4000);
      onStderr?.(text);
    });

    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} exited with ${code}: ${stderr.slice(-800)}`)),
    );
  });
}

async function probe(filePath: string): Promise<ProbeResult> {
  const output = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json',
    filePath,
  ]);

  const parsed = JSON.parse(output) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };

  const stream = parsed.streams?.[0];
  if (!stream?.width || !stream.height) {
    throw new Error('الملف المرفوع مش فيه مسار فيديو صالح');
  }

  return {
    durationSeconds: Math.round(Number(parsed.format?.duration ?? 0)),
    width: stream.width,
    height: stream.height,
  };
}

/**
 * Builds the HLS ladder in a single ffmpeg invocation.
 *
 * One pass with multiple outputs decodes the source once instead of once per
 * rendition — roughly a 3x saving on a three-rung ladder.
 */
async function transcodeToHls(
  sourcePath: string,
  outputDir: string,
  source: ProbeResult,
  onProgress: (percent: number) => void,
): Promise<Rendition[]> {
  // Never upscale: a 480p source gets 360p and 480p, not a fake 720p.
  const applicable = RENDITIONS.filter((r) => r.height <= source.height);
  const ladder = applicable.length ? applicable : [RENDITIONS[0]];

  const args: string[] = ['-hide_banner', '-y', '-i', sourcePath];

  // Map the same input into each rendition.
  for (let i = 0; i < ladder.length; i += 1) {
    args.push('-map', '0:v:0', '-map', '0:a:0?');
  }

  ladder.forEach((rendition, index) => {
    args.push(
      `-filter:v:${index}`, `scale=-2:${rendition.height}`,
      `-c:v:${index}`, 'libx264',
      `-b:v:${index}`, `${rendition.videoKbps}k`,
      `-maxrate:v:${index}`, `${Math.round(rendition.videoKbps * 1.1)}k`,
      `-bufsize:v:${index}`, `${rendition.videoKbps * 2}k`,
      `-preset:v:${index}`, 'veryfast',
      `-profile:v:${index}`, 'main',
      `-c:a:${index}`, 'aac',
      `-b:a:${index}`, `${rendition.audioKbps}k`,
      `-ac:a:${index}`, '2',
    );
  });

  args.push(
    // Keyframe every segment so players can switch rendition cleanly.
    '-g', String(SEGMENT_SECONDS * 25),
    '-keyint_min', String(SEGMENT_SECONDS * 25),
    '-sc_threshold', '0',
    '-f', 'hls',
    '-hls_time', String(SEGMENT_SECONDS),
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_filename', path.join(outputDir, 'v%v', 'seg_%03d.ts'),
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map',
    ladder.map((_, index) => `v:${index},a:${index}`).join(' '),
    path.join(outputDir, 'v%v', 'playlist.m3u8'),
    '-progress', 'pipe:2',
  );

  const totalMicros = source.durationSeconds * 1_000_000;
  let lastReported = 0;

  await run('ffmpeg', args, (chunk) => {
    // ffmpeg's -progress output reports out_time_us on each tick.
    const match = /out_time_us=(\d+)/.exec(chunk);
    if (!match || !totalMicros) return;

    const percent = Math.min(99, Math.round((Number(match[1]) / totalMicros) * 100));
    // Throttle DB writes: report only on a meaningful change.
    if (percent >= lastReported + 5) {
      lastReported = percent;
      onProgress(percent);
    }
  });

  return ladder;
}

async function extractPoster(sourcePath: string, outputPath: string): Promise<void> {
  await run('ffmpeg', [
    '-hide_banner', '-y',
    // Three seconds in, past any black lead-in.
    '-ss', '3',
    '-i', sourcePath,
    '-frames:v', '1',
    '-vf', 'scale=1280:-2',
    '-q:v', '3',
    outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function downloadToFile(bucket: string, key: string, destination: string) {
  const stream = await storage.getObject(bucket, key);
  await pipeline(stream, createWriteStream(destination));
}

/** Uploads a directory tree, preserving relative paths under `prefix`. */
async function uploadDirectory(dir: string, bucket: string, prefix: string) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const absolute = path.join(entry.parentPath ?? entry.path, entry.name);
    const relative = path.relative(dir, absolute).split(path.sep).join('/');
    const { size } = await stat(absolute);

    await storage.putObject(bucket, `${prefix}${relative}`, createReadStream(absolute), size, {
      'Content-Type': relative.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : 'video/mp2t',
    });
  }
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------

interface TranscodeJobData {
  videoAssetId: string;
  jobId: string;
  sourceKey: string;
}

async function processJob(job: Job<TranscodeJobData>): Promise<void> {
  const { videoAssetId, jobId, sourceKey } = job.data;
  log(`start asset=${videoAssetId} source=${sourceKey}`);

  const workDir = await mkdtemp(path.join(tmpdir(), 'amr-transcode-'));
  const sourcePath = path.join(workDir, 'source');
  const outputDir = path.join(workDir, 'hls');
  const posterPath = path.join(workDir, 'poster.jpg');

  try {
    await prisma.$transaction([
      prisma.videoAsset.update({
        where: { id: videoAssetId },
        data: { status: 'PROCESSING', errorMessage: null },
      }),
      prisma.videoJob.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          attempts: { increment: 1 },
          progress: 0,
        },
      }),
    ]);

    await downloadToFile(VIDEO_BUCKET, sourceKey, sourcePath);
    const source = await probe(sourcePath);
    log(`probed ${source.width}x${source.height} ${source.durationSeconds}s`);

    const ladder = await transcodeToHls(sourcePath, outputDir, source, (percent) => {
      void prisma.videoJob
        .update({ where: { id: jobId }, data: { progress: percent } })
        .catch(() => undefined);
      void job.updateProgress(percent).catch(() => undefined);
    });

    await extractPoster(sourcePath, posterPath).catch(() => {
      log('poster extraction failed; continuing without one');
    });

    const hlsPrefix = `hls/${videoAssetId}/`;
    await uploadDirectory(outputDir, VIDEO_BUCKET, hlsPrefix);

    // The poster goes to the PUBLIC bucket — a thumbnail is not paid content
    // and serving it directly avoids a signed request per card.
    let posterKey: string | null = null;
    try {
      const { size } = await stat(posterPath);
      posterKey = `posters/${videoAssetId}.jpg`;
      await storage.putObject(PUBLIC_BUCKET, posterKey, createReadStream(posterPath), size, {
        'Content-Type': 'image/jpeg',
      });
    } catch {
      posterKey = null;
    }

    await prisma.$transaction(async (tx) => {
      const asset = await tx.videoAsset.update({
        where: { id: videoAssetId },
        data: {
          status: 'READY',
          hlsPrefix,
          masterPlaylist: 'master.m3u8',
          posterKey,
          durationSeconds: source.durationSeconds,
          width: source.width,
          height: source.height,
          renditions: ladder.map((r) => r.name),
          processedAt: new Date(),
          errorMessage: null,
        },
        select: { lessonId: true },
      });

      // Denormalised onto the lesson so listings avoid a join.
      await tx.lesson.update({
        where: { id: asset.lessonId },
        data: { durationSeconds: source.durationSeconds },
      });

      await tx.videoJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', progress: 100, finishedAt: new Date() },
      });
    });

    log(`done asset=${videoAssetId} renditions=${ladder.map((r) => r.name).join(',')}`);
  } catch (error) {
    const message = (error as Error).message.slice(0, 1000);
    log(`FAILED asset=${videoAssetId}: ${message}`);

    await prisma
      .$transaction([
        prisma.videoAsset.update({
          where: { id: videoAssetId },
          data: { status: 'FAILED', errorMessage: message },
        }),
        prisma.videoJob.update({
          where: { id: jobId },
          data: { status: 'FAILED', error: message, finishedAt: new Date() },
        }),
      ])
      .catch(() => undefined);

    // Rethrow so BullMQ applies its retry/backoff policy.
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const worker = new Worker<TranscodeJobData>('video-transcode', processJob, {
  connection: redisConnection,
  concurrency: CONCURRENCY,
  // ffmpeg on a long lesson can legitimately run for a while.
  lockDuration: 30 * 60 * 1000,
  stalledInterval: 60_000,
});

worker.on('completed', (job) => log(`job ${job.id} completed`));
worker.on('failed', (job, error) => log(`job ${job?.id} failed: ${error.message}`));
worker.on('error', (error) => log(`worker error: ${error.message}`));

log(`video worker ready (concurrency=${CONCURRENCY}, renditions=${RENDITIONS.map((r) => r.name).join(',')})`);

const shutdown = async (signal: string) => {
  log(`${signal} received, draining...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
