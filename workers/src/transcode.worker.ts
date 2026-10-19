import { Worker } from 'bullmq';
import { processJob, type TranscodeJobData } from './process-video';
import { OFFLINE_QUEUE, prepareOffline, type OfflineJobData } from './prepare-offline';
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

// Offline downloads for the store apps: a stream copy, quick, on its own queue
// so a student's download never waits behind a long transcode.
const offlineWorker = new Worker<OfflineJobData>(OFFLINE_QUEUE, prepareOffline, {
  connection: redisConnection,
  concurrency: 2,
  lockDuration: 10 * 60 * 1000,
});
offlineWorker.on('failed', (job, error) => log(`offline job ${job?.id} failed: ${error.message}`));
offlineWorker.on('error', (error) => log(`offline worker error: ${error.message}`));

log(
  `video worker ready (concurrency=${CONCURRENCY}, renditions=${RENDITIONS.map((r) => r.name).join(',')})`,
);

const shutdown = async (signal: string) => {
  log(`${signal} received, draining...`);
  await Promise.all([worker.close(), offlineWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
