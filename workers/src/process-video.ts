import { mkdtemp, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Job } from 'bullmq';
import { prisma, storage, log } from './infrastructure';
import { VIDEO_BUCKET, PUBLIC_BUCKET, RENDITIONS, SEGMENT_SECONDS } from './config';
import { probe, transcodeToHls, extractPoster } from './media/ffmpeg';
import { downloadToFile, removePrefix, uploadDirectory } from './storage/transfers';

export interface TranscodeJobData {
  videoAssetId: string;
  jobId: string;
  sourceKey: string;
}

export async function processJob(job: Job<TranscodeJobData>): Promise<void> {
  const { videoAssetId, jobId, sourceKey } = job.data;
  log(`start asset=${videoAssetId} source=${sourceKey}`);

  const workDir = await mkdtemp(path.join(tmpdir(), 'amr-transcode-'));
  const sourcePath = path.join(workDir, 'source');
  const outputDir = path.join(workDir, 'hls');
  const posterPath = path.join(workDir, 'poster.jpg');
  const hlsPrefix = `hls/${videoAssetId}.${jobId}/`;
  let published = false;

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

    await downloadToFile(storage, VIDEO_BUCKET, sourceKey, sourcePath);
    const source = await probe(sourcePath);
    log(`probed ${source.width}x${source.height} ${source.durationSeconds}s`);

    const ladder = await transcodeToHls(
      sourcePath,
      outputDir,
      source,
      (percent) => {
        void prisma.videoJob
          .update({ where: { id: jobId }, data: { progress: percent } })
          .catch(() => undefined);
        void job.updateProgress(percent).catch(() => undefined);
      },
      { renditions: RENDITIONS, segmentSeconds: SEGMENT_SECONDS },
    );

    await extractPoster(sourcePath, posterPath, source.durationSeconds).catch(() => {
      log('poster extraction failed; continuing without one');
    });

    // A fresh prefix per job: students keep streaming the published version
    // untouched until the swap below, instead of segments being overwritten
    // under them while the replacement uploads. Sibling (not nested) of the
    // legacy `hls/<asset>/` prefix so removing one never touches the other.
    await uploadDirectory(storage, outputDir, VIDEO_BUCKET, hlsPrefix);

    // The poster goes to the PUBLIC bucket — a thumbnail is not paid content
    // and serving it directly avoids a signed request per card.
    let posterKey: string | null = null;
    try {
      const { size } = await stat(posterPath);
      // Versioned so browsers and caches never keep showing the replaced poster.
      posterKey = `posters/${videoAssetId}.${jobId}.jpg`;
      await storage.putObject(PUBLIC_BUCKET, posterKey, createReadStream(posterPath), size, {
        'Content-Type': 'image/jpeg',
      });
    } catch {
      posterKey = null;
    }

    const previous = await prisma.videoAsset.findUnique({
      where: { id: videoAssetId },
      select: { hlsPrefix: true, posterKey: true },
    });

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
    published = true;

    // The swap is committed; the superseded version is now unreferenced.
    if (previous?.hlsPrefix && previous.hlsPrefix !== hlsPrefix) {
      await removePrefix(storage, VIDEO_BUCKET, previous.hlsPrefix).catch((error: Error) =>
        log(`could not remove superseded ${previous.hlsPrefix}: ${error.message}`),
      );
    }

    if (previous?.posterKey && previous.posterKey !== posterKey) {
      await storage.removeObject(PUBLIC_BUCKET, previous.posterKey).catch(() => undefined);
    }

    log(`done asset=${videoAssetId} renditions=${ladder.map((r) => r.name).join(',')}`);
  } catch (error) {
    const message = (error as Error).message.slice(0, 1000);
    log(`FAILED asset=${videoAssetId}: ${message}`);
    // Partial output of an unpublished attempt is never referenced; drop it.
    if (!published) await removePrefix(storage, VIDEO_BUCKET, hlsPrefix).catch(() => undefined);

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
