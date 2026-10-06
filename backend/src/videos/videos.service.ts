import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { JobStatus, VideoStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { EntitlementsService, ACCESS_MESSAGES } from '../entitlements/entitlements.service';
import { generateToken, hashToken } from '../common/utils';

export const VIDEO_QUEUE = 'video-transcode';

/** File types accepted for a lesson video upload. */
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
  'video/x-msvideo',
]);

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementsService,
    private readonly config: ConfigService,
  ) {
    const url = new URL(config.get<string>('redis.url')!);
    this.queue = new Queue(VIDEO_QUEUE, {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        password: url.password || undefined,
        // BullMQ requires this to be null for blocking commands.
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400, count: 500 },
        removeOnFail: false,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Upload (admin)
  // --------------------------------------------------------------------------

  /**
   * Issues a presigned PUT so the browser streams the file straight to object
   * storage. The API process never buffers a multi-gigabyte upload, which is
   * what keeps a lesson upload from blocking the whole server.
   */
  async createUploadTicket(
    lessonId: string,
    input: { fileName: string; contentType: string; sizeBytes: number },
  ) {
    if (!ALLOWED_VIDEO_TYPES.has(input.contentType)) {
      throw new BadRequestException('نوع الملف غير مدعوم. استخدم MP4 أو MOV أو MKV أو WEBM.');
    }

    const maxBytes = this.config.get<number>('storage.maxUploadBytes')!;
    if (input.sizeBytes > maxBytes) {
      throw new BadRequestException(
        `حجم الملف أكبر من الحد المسموح (${Math.floor(maxBytes / 1024 / 1024 / 1024)} جيجا)`,
      );
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('الحصة غير موجودة');

    const extension = input.fileName.split('.').pop()?.toLowerCase() ?? 'mp4';
    const sourceKey = `sources/${lessonId}/${Date.now()}.${extension}`;

    const asset = await this.prisma.videoAsset.upsert({
      where: { lessonId },
      create: {
        lessonId,
        status: VideoStatus.AWAITING_UPLOAD,
        sourceKey,
        originalName: input.fileName.slice(0, 255),
        sizeBytes: BigInt(input.sizeBytes),
      },
      update: {
        status: VideoStatus.AWAITING_UPLOAD,
        sourceKey,
        originalName: input.fileName.slice(0, 255),
        sizeBytes: BigInt(input.sizeBytes),
        errorMessage: null,
      },
    });

    const upload = await this.storage.presignUpload(this.storage.videoBucket, sourceKey, 3600);

    return {
      assetId: asset.id,
      uploadUrl: upload.url,
      key: sourceKey,
      expiresIn: upload.expiresIn,
      method: 'PUT' as const,
      headers: { 'Content-Type': input.contentType },
    };
  }

  /**
   * Called once the browser finishes the PUT. Verifies the object really
   * landed, then queues transcoding — the API never runs ffmpeg itself.
   */
  async completeUpload(lessonId: string) {
    const asset = await this.prisma.videoAsset.findUnique({ where: { lessonId } });
    if (!asset?.sourceKey) throw new NotFoundException('مفيش ملف مرفوع للحصة دي');

    const stat = await this.storage
      .statObject(this.storage.videoBucket, asset.sourceKey)
      .catch(() => null);

    if (!stat) {
      throw new BadRequestException('الملف لم يصل للتخزين، جرّب الرفع تاني');
    }

    const updated = await this.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: VideoStatus.QUEUED,
        sizeBytes: BigInt(stat.size),
        errorMessage: null,
      },
    });

    const job = await this.prisma.videoJob.create({
      data: { videoAssetId: asset.id, status: JobStatus.QUEUED },
    });

    const queued = await this.queue.add(
      'transcode',
      { videoAssetId: asset.id, jobId: job.id, sourceKey: asset.sourceKey },
      { jobId: job.id },
    );

    await this.prisma.videoJob.update({
      where: { id: job.id },
      data: { queueJobId: String(queued.id) },
    });

    this.logger.log(`Queued transcode for lesson ${lessonId} (asset ${asset.id})`);
    return { assetId: updated.id, jobId: job.id, status: updated.status };
  }

  async getProcessingStatus(lessonId: string) {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { lessonId },
      include: { jobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!asset) return { status: VideoStatus.AWAITING_UPLOAD, progress: 0 };

    return {
      assetId: asset.id,
      status: asset.status,
      progress: asset.jobs[0]?.progress ?? (asset.status === VideoStatus.READY ? 100 : 0),
      durationSeconds: asset.durationSeconds,
      renditions: asset.renditions,
      error: asset.errorMessage,
      jobStatus: asset.jobs[0]?.status ?? null,
      attempts: asset.jobs[0]?.attempts ?? 0,
    };
  }

  async requeue(lessonId: string) {
    const asset = await this.prisma.videoAsset.findUnique({ where: { lessonId } });
    if (!asset?.sourceKey) throw new NotFoundException('مفيش ملف مرفوع للحصة دي');
    return this.completeUpload(lessonId);
  }

  // --------------------------------------------------------------------------
  // Playback authorisation (student)
  // --------------------------------------------------------------------------

  /**
   * Issues a short-lived playback ticket after a server-side entitlement check.
   *
   * The ticket is a random opaque token; only its hash is stored. It is bound
   * to one student and one lesson and expires in PLAYBACK_TOKEN_TTL seconds.
   *
   * What this protects against: hotlinking, sharing a URL that keeps working,
   * and any attempt to read a paid video straight out of the bucket.
   *
   * What it does NOT protect against: a paying student screen-recording the
   * lesson or re-streaming it. Preventing that requires DRM (Widevine /
   * FairPlay), which is a separate commercial integration and is not claimed
   * here. See docs/architecture/video-pipeline.md.
   */
  async issuePlaybackTicket(
    userId: string,
    lessonId: string,
    opts: { isStaff?: boolean; ip?: string } = {},
  ) {
    const decision = await this.entitlements.checkLessonAccess(userId, lessonId, {
      isStaff: opts.isStaff,
    });

    if (!decision.allowed) {
      throw new ForbiddenException(ACCESS_MESSAGES[decision.reason]);
    }

    const asset = await this.prisma.videoAsset.findUnique({
      where: { lessonId },
      select: {
        id: true,
        status: true,
        hlsPrefix: true,
        masterPlaylist: true,
        durationSeconds: true,
        posterKey: true,
        renditions: true,
      },
    });

    if (!asset || asset.status !== VideoStatus.READY || !asset.hlsPrefix) {
      throw new NotFoundException('الفيديو لسه بيتجهز، جرّب بعد شوية');
    }

    const ttl = this.config.get<number>('playback.ttl')!;
    const token = generateToken(32);

    await this.prisma.playbackTicket.create({
      data: {
        userId,
        lessonId,
        tokenHash: hashToken(token),
        ip: opts.ip,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });

    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { positionSeconds: true, percent: true, completed: true },
    });

    return {
      ticket: token,
      expiresIn: ttl,
      // The player appends `?ticket=` to every segment request.
      manifestUrl: `/api/videos/${lessonId}/manifest.m3u8?ticket=${token}`,
      posterUrl: this.storage.publicUrl(asset.posterKey),
      durationSeconds: asset.durationSeconds ?? 0,
      renditions: asset.renditions,
      accessReason: decision.reason,
      resumeAtSeconds: progress?.completed ? 0 : (progress?.positionSeconds ?? 0),
    };
  }

  /** Validates a ticket on every manifest/segment request. */
  async resolveTicket(lessonId: string, token: string) {
    const ticket = await this.prisma.playbackTicket.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, userId: true, lessonId: true, expiresAt: true },
    });

    if (!ticket || ticket.lessonId !== lessonId) {
      throw new ForbiddenException('رابط المشاهدة غير صالح');
    }
    if (ticket.expiresAt < new Date()) {
      throw new ForbiddenException('انتهت صلاحية رابط المشاهدة، حدّث الصفحة');
    }

    return ticket;
  }

  /**
   * Streams an HLS object (playlist or segment) through the API after the
   * ticket checks out. Going through the API rather than handing the browser a
   * presigned bucket URL keeps the storage layer completely private.
   */
  async streamObject(lessonId: string, relativePath: string) {
    const asset = await this.prisma.videoAsset.findUnique({
      where: { lessonId },
      select: { hlsPrefix: true, masterPlaylist: true, status: true },
    });

    if (!asset?.hlsPrefix || asset.status !== VideoStatus.READY) {
      throw new NotFoundException('الفيديو غير متاح');
    }

    // Path traversal guard: a segment name may not climb out of its prefix.
    const safe = relativePath.replace(/\\/g, '/');
    if (safe.includes('..') || safe.startsWith('/')) {
      throw new ForbiddenException('مسار غير صالح');
    }

    const key = `${asset.hlsPrefix}${safe}`;
    const stream = await this.storage
      .getObjectStream(this.storage.videoBucket, key)
      .catch(() => null);

    if (!stream) throw new NotFoundException('الملف غير موجود');

    return {
      stream,
      contentType: safe.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
    };
  }

  /** Housekeeping: drop expired tickets so the table stays small. */
  async purgeExpiredTickets(): Promise<number> {
    const { count } = await this.prisma.playbackTicket.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }

  async purgeAbandonedUploads(): Promise<number> {
    const assets = await this.prisma.videoAsset.findMany({
      where: {
        status: VideoStatus.AWAITING_UPLOAD,
        updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true, sourceKey: true },
    });
    for (const asset of assets) {
      if (asset.sourceKey) {
        await this.storage
          .removeObject(this.storage.videoBucket, asset.sourceKey)
          .catch(() => undefined);
      }
    }
    if (assets.length) {
      await this.prisma.videoAsset.deleteMany({
        where: { id: { in: assets.map((asset) => asset.id) } },
      });
    }
    return assets.length;
  }
}
