import { Worker } from 'bullmq';
import { processJob, type TranscodeJobData } from './process-video';
import { prisma, redisConnection, log } from './infrastructure';
import { CONCURRENCY, RENDITIONS } from './config';

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

log(
  `video worker ready (concurrency=${CONCURRENCY}, renditions=${RENDITIONS.map((r) => r.name).join(',')})`,
);

const shutdown = async (signal: string) => {
  log(`${signal} received, draining...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
