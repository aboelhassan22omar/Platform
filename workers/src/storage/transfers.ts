import { readdir, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { Client as MinioClient } from 'minio';

export async function downloadToFile(
  storage: MinioClient,
  bucket: string,
  key: string,
  destination: string,
) {
  const stream = await storage.getObject(bucket, key);
  await pipeline(stream, createWriteStream(destination));
}

/** Uploads a directory tree, preserving relative paths under `prefix`. */
export async function uploadDirectory(
  storage: MinioClient,
  dir: string,
  bucket: string,
  prefix: string,
) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const absolute = path.join(entry.parentPath ?? entry.path, entry.name);
    const relative = path.relative(dir, absolute).split(path.sep).join('/');
    const { size } = await stat(absolute);

    await storage.putObject(bucket, `${prefix}${relative}`, createReadStream(absolute), size, {
      'Content-Type': relative.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
    });
  }
}
