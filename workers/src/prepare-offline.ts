import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Job } from 'bullmq';
import { prisma, storage, log } from './infrastructure';
import { VIDEO_BUCKET } from './config';
import { remuxToMp4 } from './media/ffmpeg';
import { downloadToFile } from './storage/transfers';

export const OFFLINE_QUEUE = 'video-offline';

export interface OfflineJobData {
  videoAssetId: string;
  /** The published version the request was made against. */
  hlsPrefix: string;
  /** Rendition to package, e.g. "480p". */
  quality: string;
}

/**
 * Packages a lesson for the store apps' offline downloads: fetches one
 * rendition's segments, remuxes them into a single MP4 next to the HLS
 * version (so replacing the video removes it too), and records it. The API
 * deletes it again once it goes unused for a few days.
 */
export async function prepareOffline(job: Job<OfflineJobData>): Promise<void> {
  const { videoAssetId, hlsPrefix, quality } = job.data;
  const asset = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
    select: { hlsPrefix: true, renditions: true, offlineKey: true },
  });
  // Replaced since the request, or already done by an earlier job.
  if (!asset || asset.hlsPrefix !== hlsPrefix) return;
  if (asset.offlineKey?.startsWith(hlsPrefix)) return;

  const index = asset.renditions.indexOf(quality);
  if (index === -1) throw new Error(`rendition ${quality} not found`);

  const workDir = await mkdtemp(path.join(tmpdir(), 'amr-offline-'));
  try {
    const playlistPath = path.join(workDir, 'playlist.m3u8');
    await downloadToFile(
      storage,
      VIDEO_BUCKET,
      `${hlsPrefix}v${index}/playlist.m3u8`,
      playlistPath,
    );
    const segments = (await readFile(playlistPath, 'utf8'))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    for (const segment of segments) {
      // Playlists written by the transcoder only ever name files beside them.
      if (segment.includes('/') || segment.includes('..'))
        throw new Error('unexpected segment path');
      await downloadToFile(
        storage,
        VIDEO_BUCKET,
        `${hlsPrefix}v${index}/${segment}`,
        path.join(workDir, segment),
      );
    }

    const outputPath = path.join(workDir, 'lesson.mp4');
    await remuxToMp4(playlistPath, outputPath);
    const { size } = await stat(outputPath);
    const key = `${hlsPrefix}offline-${quality}.mp4`;
    await storage.putObject(VIDEO_BUCKET, key, createReadStream(outputPath), size, {
      'Content-Type': 'video/mp4',
    });

    const updated = await prisma.videoAsset.updateMany({
      where: { id: videoAssetId, hlsPrefix },
      data: {
        offlineKey: key,
        offlineSize: BigInt(size),
        offlineQuality: quality,
        offlineUsedAt: new Date(),
      },
    });
    // The video was replaced while packaging: the file went with the old prefix.
    if (!updated.count) await storage.removeObject(VIDEO_BUCKET, key).catch(() => undefined);
    log(`offline ready asset=${videoAssetId} ${quality} ${Math.round(size / 1048576)}MB`);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
