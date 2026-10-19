'use client';

import { api } from '@/lib/api';
import { type FsDirectory, nativePlugins } from '@/lib/native-app';

/**
 * Lessons saved on the phone by the store apps.
 *
 * Files live in the app's private storage (on iPhone, excluded from iCloud
 * backup), never in the gallery or the Files app. An index file describes
 * them; the app's bundled library page (mobile/www/library.html) reads the
 * same index to play them with no connection, and writes back how long each
 * was watched so the time can be counted when the phone is online again.
 *
 * Keep the index format in step with mobile/www/library.js.
 */
export const OFFLINE_DIR: FsDirectory = 'LIBRARY_NO_CLOUD';
const INDEX_PATH = 'offline/index.json';

export interface OfflineItem {
  lessonId: string;
  title: string;
  courseTitle: string;
  gradeName: string;
  durationSeconds: number;
  sizeBytes: number;
  quality: string | null;
  /** Path inside OFFLINE_DIR. */
  file: string;
  /** Poster image path inside OFFLINE_DIR, when it could be saved. */
  poster: string | null;
  downloadedAt: string;
  /** After this the library refuses to play it until the phone goes online. */
  expiresAt: string;
  /** Drawn over the video, like the online player's watermark. */
  watermark: string | null;
  /** Watched offline and not yet reported to the server. */
  pendingSeconds: number;
  /** Where the student stopped, to resume. */
  positionSeconds: number;
}

export interface OfflineIndex {
  version: 1;
  /** The account the downloads belong to; another account clears them. */
  userId: string | null;
  items: OfflineItem[];
}

const empty = (): OfflineIndex => ({ version: 1, userId: null, items: [] });

function fs() {
  const plugin = nativePlugins()?.Filesystem;
  if (!plugin) throw new Error('التنزيل متاح في تطبيق الموبايل بس');
  return plugin;
}

export const offlineAvailable = () =>
  Boolean(nativePlugins()?.Filesystem && nativePlugins()?.FileTransfer);

export async function readIndex(): Promise<OfflineIndex> {
  try {
    const { data } = await fs().readFile({
      path: INDEX_PATH,
      directory: OFFLINE_DIR,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(data) as OfflineIndex;
    return parsed?.version === 1 && Array.isArray(parsed.items) ? parsed : empty();
  } catch {
    return empty();
  }
}

export async function writeIndex(index: OfflineIndex) {
  await fs().writeFile({
    path: INDEX_PATH,
    directory: OFFLINE_DIR,
    data: JSON.stringify(index),
    encoding: 'utf8',
    recursive: true,
  });
}

async function deleteQuietly(path: string | null) {
  if (!path) return;
  await fs()
    .deleteFile({ path, directory: OFFLINE_DIR })
    .catch(() => undefined);
}

/** Removes one saved lesson from the phone (and tells the server, when online). */
export async function removeOffline(lessonId: string, opts: { tellServer?: boolean } = {}) {
  const index = await readIndex();
  const item = index.items.find((entry) => entry.lessonId === lessonId);
  if (item) {
    await deleteQuietly(item.file);
    await deleteQuietly(item.poster);
  }
  await writeIndex({ ...index, items: index.items.filter((entry) => entry.lessonId !== lessonId) });
  if (opts.tellServer !== false) {
    await api.delete(`/videos/${encodeURIComponent(lessonId)}/offline`).catch(() => undefined);
  }
}

/** Removes everything (another account signed in, or the account was deleted). */
export async function clearOffline() {
  const index = await readIndex();
  for (const item of index.items) {
    await deleteQuietly(item.file);
    await deleteQuietly(item.poster);
  }
  await writeIndex(empty());
}

interface OfflineTicket {
  status: 'PREPARING' | 'READY';
  retryAfterSeconds?: number;
  url?: string;
  sizeBytes?: number;
  quality?: string | null;
  durationSeconds?: number;
  expiresAt?: string;
}

export type DownloadPhase = 'preparing' | 'downloading' | 'saving';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Saves a lesson on the phone. The server packages it first (a few seconds
 * the first time anyone downloads it), then the native downloader writes it
 * straight to private storage: the video never passes through JavaScript.
 */
export async function downloadLesson(
  lesson: {
    id: string;
    title: string;
    courseTitle: string;
    gradeName: string;
    posterUrl: string | null;
  },
  owner: { userId: string; watermark: string | null },
  onProgress: (phase: DownloadPhase, fraction: number) => void,
): Promise<OfflineItem> {
  const files = fs();
  const transfer = nativePlugins()?.FileTransfer;
  if (!transfer) throw new Error('التنزيل متاح في تطبيق الموبايل بس');

  onProgress('preparing', 0);
  let ticket: OfflineTicket | null = null;
  // Packaging an hour-long lesson takes well under a minute; give it five.
  for (let attempt = 0; attempt < 75; attempt += 1) {
    ticket = await api.post<OfflineTicket>(`/videos/${encodeURIComponent(lesson.id)}/offline`);
    if (ticket.status === 'READY') break;
    await sleep((ticket.retryAfterSeconds ?? 4) * 1000);
  }
  if (!ticket?.url || ticket.status !== 'READY') {
    throw new Error('تجهيز الحصة للتنزيل خد وقت أطول من العادي. جرّب تاني بعد شوية.');
  }

  const index = await readIndex();
  if (index.userId && index.userId !== owner.userId) await clearOffline();

  const file = `offline/${lesson.id}.mp4`;
  const partial = `${file}.part`;
  await files
    .mkdir({ path: 'offline', directory: OFFLINE_DIR, recursive: true })
    .catch(() => undefined);
  const { uri } = await files.getUri({ path: partial, directory: OFFLINE_DIR });

  const url = new URL(ticket.url, window.location.origin).href;
  const total = ticket.sizeBytes ?? 0;
  const listener = await transfer.addListener('progress', (status) => {
    if (status.url !== url) return;
    const size = status.contentLength || total;
    if (size) onProgress('downloading', Math.min(1, status.bytes / size));
  });
  try {
    onProgress('downloading', 0);
    await transfer.downloadFile({ url, path: uri, progress: true });
  } catch (error) {
    await deleteQuietly(partial);
    throw error instanceof Error && /space|ENOSPC|storage/i.test(error.message)
      ? new Error('مفيش مساحة كفاية على الموبايل للحصة دي.')
      : new Error('التنزيل وقف. اتأكد من النت وجرّب تاني.');
  } finally {
    await listener.remove();
  }

  onProgress('saving', 1);
  await deleteQuietly(file);
  await files.rename({ from: partial, to: file, directory: OFFLINE_DIR });

  let poster: string | null = null;
  if (lesson.posterUrl) {
    try {
      const response = await fetch(lesson.posterUrl);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      poster = `offline/${lesson.id}.poster`;
      // Stored as a data URL so the library page can show it without a file server.
      await files.writeFile({
        path: poster,
        directory: OFFLINE_DIR,
        data: dataUrl,
        encoding: 'utf8',
      });
    } catch {
      poster = null;
    }
  }

  const item: OfflineItem = {
    lessonId: lesson.id,
    title: lesson.title,
    courseTitle: lesson.courseTitle,
    gradeName: lesson.gradeName,
    durationSeconds: ticket.durationSeconds ?? 0,
    sizeBytes: total,
    quality: ticket.quality ?? null,
    file,
    poster,
    downloadedAt: new Date().toISOString(),
    expiresAt: ticket.expiresAt ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
    watermark: owner.watermark,
    pendingSeconds: 0,
    positionSeconds: 0,
  };
  const latest = await readIndex();
  await writeIndex({
    version: 1,
    userId: owner.userId,
    items: [item, ...latest.items.filter((entry) => entry.lessonId !== lesson.id)],
  });
  return item;
}

interface SyncResult {
  offlineDays: number;
  items: Array<{ lessonId: string; allowed: boolean; expiresAt: string | null }>;
}

/**
 * Run when the app is online and signed in: reports offline watching, renews
 * lessons the student still has, and deletes the ones they lost.
 */
export async function syncOffline(userId: string): Promise<OfflineIndex> {
  const index = await readIndex();
  if (!index.items.length) return index;
  if (index.userId && index.userId !== userId) {
    await clearOffline();
    return empty();
  }
  const result = await api.post<SyncResult>('/videos/offline/sync', {
    items: index.items.map((item) => ({
      lessonId: item.lessonId,
      watchedSeconds: Math.max(0, Math.round(item.pendingSeconds)),
    })),
  });
  // Re-read: the student may have watched more while the request was in flight.
  const latest = await readIndex();
  const reported = new Map(index.items.map((item) => [item.lessonId, item.pendingSeconds]));
  const verdicts = new Map(result.items.map((item) => [item.lessonId, item]));
  const kept: OfflineItem[] = [];
  for (const item of latest.items) {
    const verdict = verdicts.get(item.lessonId);
    if (verdict && !verdict.allowed) {
      await deleteQuietly(item.file);
      await deleteQuietly(item.poster);
      continue;
    }
    kept.push({
      ...item,
      expiresAt: verdict?.expiresAt ?? item.expiresAt,
      pendingSeconds: Math.max(0, item.pendingSeconds - (reported.get(item.lessonId) ?? 0)),
    });
  }
  const next: OfflineIndex = { version: 1, userId, items: kept };
  await writeIndex(next);
  return next;
}

/** The bundled library page, on the app's own origin. */
export function libraryUrl(): string {
  const ios = /\(ios/.test(navigator.userAgent);
  return ios ? 'capacitor://localhost/library.html' : 'https://localhost/library.html';
}
