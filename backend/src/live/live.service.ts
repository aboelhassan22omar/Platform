import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import {
  AccessToken,
  DataPacket_Kind,
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  type ParticipantInfo,
} from 'livekit-server-sdk';
import {
  LiveEndReason,
  LiveRecordingStatus,
  LiveSessionStatus,
  NotificationKind,
  Role,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import type { AuthenticatedUser } from '../common/decorators';
import type { CreateLiveSessionDto, UpdateLiveSessionDto } from './live.dto';

/** Roles allowed to schedule and present a live class. */
const HOST_ROLES: ReadonlySet<Role> = new Set([Role.CONTENT_MANAGER, Role.ADMIN, Role.SUPER_ADMIN]);

/** A LIVE session older than this is treated as abandoned in student lists. */
const STALE_LIVE_MS = 8 * 60 * 60 * 1000;
/** A scheduled session stays visible this long past its start time. */
const SCHEDULE_GRACE_MS = 6 * 60 * 60 * 1000;
/**
 * How long the presenter may be missing (a refresh, a network blip) before the
 * class is closed for them. The recording stops the moment they drop out.
 */
const HOST_GRACE_MS = 45_000;
/** A freshly started class gets this long for the presenter to connect. */
const JOIN_GRACE_MS = 90_000;
/** After a failed recording start, wait this long before trying again. */
const RECORDING_RETRY_MS = 60_000;

const SESSION_SELECT = {
  id: true,
  title: true,
  description: true,
  scheduledAt: true,
  startedAt: true,
  endedAt: true,
  status: true,
  chatEnabled: true,
  kickedUserIds: true,
  recordingEnabled: true,
  endReason: true,
  roomName: true,
  grade: {
    select: { id: true, nameAr: true, shortNameAr: true, slug: true, themeKey: true, educationSystem: true, level: true },
  },
} as const;

/** Everything the realtime channel carries. Clients switch on `type`. */
export type LiveEvent =
  | { type: 'chat'; message: LiveChatView }
  | { type: 'chat-state'; enabled: boolean }
  | { type: 'reaction'; reaction: { id: string; emoji: string; userId: string; name: string; createdAt: string } }
  | { type: 'recording'; active: boolean }
  | { type: 'ended' };

export interface LiveChatView {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; isHost: boolean };
}

const cairoFormat = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
});

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  static canHost(role: Role) {
    return HOST_ROLES.has(role);
  }

  // -------------------------------------------------------------------------
  // LiveKit plumbing
  // -------------------------------------------------------------------------

  private livekit() {
    const url = this.config.get<string>('livekit.url') ?? '';
    const apiKey = this.config.get<string>('livekit.apiKey') ?? '';
    const apiSecret = this.config.get<string>('livekit.apiSecret') ?? '';
    return { url, apiKey, apiSecret, configured: Boolean(url && apiKey && apiSecret) };
  }

  private roomService() {
    const { url, apiKey, apiSecret, configured } = this.livekit();
    if (!configured) return null;
    const apiUrl = this.config.get<string>('livekit.apiUrl') || url.replace(/^ws/i, 'http');
    return new RoomServiceClient(apiUrl, apiKey, apiSecret);
  }

  /**
   * Sends an event to everyone in the room. Students cannot publish data
   * themselves (their token forbids it), so every chat line and reaction
   * passes through the API, where access and the chat switch are enforced.
   */
  private async broadcast(roomName: string, event: LiveEvent) {
    const service = this.roomService();
    if (!service) return;
    try {
      await service.sendData(roomName, this.encoder.encode(JSON.stringify(event)), DataPacket_Kind.RELIABLE, {
        topic: 'live',
      });
    } catch (error) {
      // An empty room (nobody connected yet) is not an error for the caller.
      this.logger.warn(`broadcast to ${roomName} failed: ${(error as Error).message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Access
  // -------------------------------------------------------------------------

  private async load(id: string) {
    const session = await this.prisma.liveSession.findUnique({ where: { id }, select: SESSION_SELECT });
    if (!session) throw new NotFoundException('اللايف ده مش موجود');
    return session;
  }

  /** Students see only their own grade's lives; staff may observe any. */
  private async assertCanView(user: AuthenticatedUser, session: Awaited<ReturnType<LiveService['load']>>) {
    if (session.kickedUserIds.includes(user.id)) throw new ForbiddenException('المستر أخرجك من اللايف ده');
    if (user.role !== Role.STUDENT) return;
    const student = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { status: true, educationSystem: true, gradeLevel: true },
    });
    const sameGrade =
      student?.status === UserStatus.ACTIVE &&
      student.educationSystem === session.grade.educationSystem &&
      student.gradeLevel === session.grade.level;
    if (!sameGrade) throw new ForbiddenException('اللايف ده مش لصفك');
  }

  private view(session: Awaited<ReturnType<LiveService['load']>>) {
    const { roomName: _room, kickedUserIds: _kicked, grade, ...rest } = session;
    return {
      ...rest,
      grade: { id: grade.id, nameAr: grade.nameAr, shortNameAr: grade.shortNameAr, slug: grade.slug, themeKey: grade.themeKey },
    };
  }

  // -------------------------------------------------------------------------
  // Students and hosts
  // -------------------------------------------------------------------------

  async upcomingFor(user: AuthenticatedUser) {
    const now = Date.now();
    let gradeFilter = {};
    if (user.role === Role.STUDENT) {
      const student = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { educationSystem: true, gradeLevel: true },
      });
      if (!student?.educationSystem || !student.gradeLevel) return [];
      gradeFilter = { grade: { educationSystem: student.educationSystem, level: student.gradeLevel } };
    }

    const sessions = await this.prisma.liveSession.findMany({
      where: {
        ...gradeFilter,
        OR: [
          { status: LiveSessionStatus.LIVE, startedAt: { gte: new Date(now - STALE_LIVE_MS) } },
          { status: LiveSessionStatus.SCHEDULED, scheduledAt: { gte: new Date(now - SCHEDULE_GRACE_MS) } },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
      select: SESSION_SELECT,
    });

    // A class that is on air outranks anything merely scheduled.
    return sessions
      .sort((a, b) => Number(b.status === LiveSessionStatus.LIVE) - Number(a.status === LiveSessionStatus.LIVE))
      .map((session) => this.view(session));
  }

  async detail(user: AuthenticatedUser, id: string) {
    const session = await this.load(id);
    await this.assertCanView(user, session);
    const isHost = LiveService.canHost(user.role);
    const recording = isHost
      ? (await this.prisma.liveRecording.count({ where: { sessionId: id, status: LiveRecordingStatus.RECORDING } })) > 0
      : false;
    return { ...this.view(session), isHost, recording, streamingReady: this.livekit().configured };
  }

  async token(user: AuthenticatedUser, id: string) {
    const { url, apiKey, apiSecret, configured } = this.livekit();
    if (!configured) throw new ServiceUnavailableException('البث المباشر لسه مش متفعّل على المنصة');

    const session = await this.load(id);
    await this.assertCanView(user, session);
    if (session.status === LiveSessionStatus.ENDED || session.status === LiveSessionStatus.CANCELLED) {
      throw new GoneException('اللايف ده خلص');
    }
    if (session.status !== LiveSessionStatus.LIVE) throw new ConflictException('اللايف لسه مبدأش');

    const host = LiveService.canHost(user.role);
    const person = await this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });

    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: person?.fullName ?? user.username,
      ttl: '6h',
      metadata: JSON.stringify({ host }),
    });
    token.addGrant({
      room: session.roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: host,
      canPublishData: host,
      roomAdmin: host,
      canUpdateOwnMetadata: false,
    });

    return { url, token: await token.toJwt(), isHost: host };
  }

  async chatHistory(user: AuthenticatedUser, id: string): Promise<LiveChatView[]> {
    const session = await this.load(id);
    await this.assertCanView(user, session);
    const rows = await this.prisma.liveChatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, body: true, createdAt: true, user: { select: { id: true, fullName: true, role: true } } },
    });
    return rows.reverse().map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      user: { id: row.user.id, name: row.user.fullName, isHost: row.user.role !== Role.STUDENT },
    }));
  }

  async postChat(user: AuthenticatedUser, id: string, rawBody: string): Promise<LiveChatView> {
    const session = await this.load(id);
    await this.assertCanView(user, session);
    if (session.status !== LiveSessionStatus.LIVE) throw new ConflictException('اللايف مش شغال دلوقتي');

    const host = LiveService.canHost(user.role);
    if (!session.chatEnabled && !host) throw new ForbiddenException('المستر قافل الشات دلوقتي');

    const body = rawBody.replace(/\s+/g, ' ').trim();
    if (!body) throw new BadRequestException('اكتب رسالتك الأول');

    const row = await this.prisma.liveChatMessage.create({
      data: { sessionId: id, userId: user.id, body },
      select: { id: true, body: true, createdAt: true, user: { select: { id: true, fullName: true, role: true } } },
    });
    const message: LiveChatView = {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      user: { id: row.user.id, name: row.user.fullName, isHost: row.user.role !== Role.STUDENT },
    };
    await this.broadcast(session.roomName, { type: 'chat', message });
    return message;
  }

  async react(user: AuthenticatedUser, id: string, emoji: string) {
    const session = await this.load(id);
    await this.assertCanView(user, session);
    if (session.status !== LiveSessionStatus.LIVE) throw new ConflictException('اللايف مش شغال دلوقتي');

    const row = await this.prisma.liveReaction.create({
      data: { sessionId: id, userId: user.id, emoji },
      select: { id: true, emoji: true, createdAt: true, user: { select: { id: true, fullName: true } } },
    });
    const reaction = {
      id: row.id,
      emoji: row.emoji,
      userId: row.user.id,
      name: row.user.fullName,
      createdAt: row.createdAt.toISOString(),
    };
    await this.broadcast(session.roomName, { type: 'reaction', reaction });
    return { id: row.id };
  }

  // -------------------------------------------------------------------------
  // Host / admin
  // -------------------------------------------------------------------------

  async listForAdmin() {
    const sessions = await this.prisma.liveSession.findMany({
      orderBy: { scheduledAt: 'desc' },
      take: 100,
      select: {
        ...SESSION_SELECT,
        _count: { select: { messages: true, reactions: true } },
        recordings: {
          orderBy: { startedAt: 'asc' },
          select: { id: true, status: true, startedAt: true, endedAt: true, durationSeconds: true, sizeBytes: true, error: true },
        },
      },
    });
    return {
      streamingReady: this.livekit().configured,
      items: sessions.map(({ _count, recordings, ...session }) => ({
        ...this.view(session),
        counts: _count,
        recordings: recordings.map((r) => ({ ...r, sizeBytes: r.sizeBytes === null ? null : Number(r.sizeBytes) })),
      })),
    };
  }

  private async notifyGrade(gradeId: string, title: string, body: string, href: string) {
    const grade = await this.prisma.grade.findUnique({ where: { id: gradeId }, select: { educationSystem: true, level: true } });
    if (!grade) return;
    const students = await this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        educationSystem: grade.educationSystem,
        gradeLevel: grade.level,
      },
      select: { id: true },
    });
    if (!students.length) return;
    await this.prisma.notification.createMany({
      data: students.map((student) => ({ userId: student.id, kind: NotificationKind.CONTENT, title, body, href })),
    });
  }

  async create(actor: AuthenticatedUser, dto: CreateLiveSessionDto) {
    const grade = await this.prisma.grade.findUnique({ where: { id: dto.gradeId }, select: { id: true } });
    if (!grade) throw new BadRequestException('اختار صف صحيح');
    const scheduledAt = new Date(dto.scheduledAt);

    const created = await this.prisma.$transaction(async (tx) => {
      const session = await tx.liveSession.create({
        data: {
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          gradeId: dto.gradeId,
          scheduledAt,
          recordingEnabled: dto.recordingEnabled ?? false,
          roomName: `live-${randomUUID()}`,
          createdById: actor.id,
        },
        select: { id: true },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'live.create',
        entityType: 'LiveSession',
        entityId: session.id,
        metadata: { title: dto.title, gradeId: dto.gradeId, scheduledAt: dto.scheduledAt },
      });
      return session;
    });

    await this.notifyGrade(
      dto.gradeId,
      `لايف جديد: ${dto.title.trim()}`,
      `المستر هيطلع لايف ${cairoFormat.format(scheduledAt)}. هتلاقي عداد تنازلي في صفحتك.`,
      `/live/${created.id}`,
    ).catch((error) => this.logger.warn(`live notify failed: ${(error as Error).message}`));

    return this.view(await this.load(created.id));
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateLiveSessionDto) {
    const session = await this.load(id);
    if (session.status !== LiveSessionStatus.SCHEDULED) {
      throw new ConflictException('تقدر تعدّل اللايف قبل ما يبدأ بس');
    }
    if (dto.gradeId) {
      const grade = await this.prisma.grade.findUnique({ where: { id: dto.gradeId }, select: { id: true } });
      if (!grade) throw new BadRequestException('اختار صف صحيح');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.liveSession.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description === undefined ? undefined : dto.description.trim() || null,
          gradeId: dto.gradeId,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          recordingEnabled: dto.recordingEnabled,
        },
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'live.update',
        entityType: 'LiveSession',
        entityId: id,
        metadata: { ...dto },
      });
    });
    return this.view(await this.load(id));
  }

  private async transition(
    actor: AuthenticatedUser,
    id: string,
    from: LiveSessionStatus[],
    to: LiveSessionStatus,
    error: string,
  ) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.liveSession.updateMany({
        where: { id, status: { in: from } },
        data: {
          status: to,
          ...(to === LiveSessionStatus.LIVE ? { startedAt: now } : {}),
          ...(to === LiveSessionStatus.ENDED ? { endedAt: now } : {}),
        },
      });
      if (changed.count) {
        await this.audit.record(tx, {
          actorId: actor.id,
          action: `live.${to.toLowerCase()}`,
          entityType: 'LiveSession',
          entityId: id,
        });
      }
      return changed.count;
    });
    if (!result) {
      await this.load(id); // 404 when it does not exist at all
      throw new ConflictException(error);
    }
    return this.load(id);
  }

  async start(actor: AuthenticatedUser, id: string) {
    const { configured } = this.livekit();
    if (!configured) throw new ServiceUnavailableException('البث المباشر لسه مش متفعّل على المنصة');
    const session = await this.transition(actor, id, [LiveSessionStatus.SCHEDULED], LiveSessionStatus.LIVE, 'اللايف ده مينفعش يبدأ');
    await this.notifyGrade(
      session.grade.id,
      `اللايف بدأ: ${session.title}`,
      'المستر على الهوا دلوقتي، ادخل حالاً.',
      `/live/${session.id}`,
    ).catch((error) => this.logger.warn(`live notify failed: ${(error as Error).message}`));
    return this.view(session);
  }

  async end(actor: AuthenticatedUser, id: string) {
    const ended = await this.finish(id, LiveEndReason.HOST_ENDED, actor.id);
    if (!ended) {
      await this.load(id);
      throw new ConflictException('اللايف مش شغال');
    }
    return this.view(await this.load(id));
  }

  /**
   * Closes a class: status, recordings, the room. Returns false when it was
   * not live (already ended by the teacher or by the monitor).
   */
  private async finish(id: string, reason: LiveEndReason, actorId?: string) {
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.liveSession.updateMany({
        where: { id, status: LiveSessionStatus.LIVE },
        data: { status: LiveSessionStatus.ENDED, endedAt: new Date(), endReason: reason, hostAbsentSince: null },
      });
      if (result.count) {
        await this.audit.record(tx, {
          actorId,
          action: reason === LiveEndReason.HOST_LEFT ? 'live.auto_end' : 'live.ended',
          entityType: 'LiveSession',
          entityId: id,
        });
      }
      return result.count;
    });
    if (!changed) return false;

    const session = await this.load(id);
    await this.stopRecordings(id);
    await this.broadcast(session.roomName, { type: 'ended' });
    try {
      await this.roomService()?.deleteRoom(session.roomName);
    } catch (error) {
      this.logger.warn(`deleteRoom ${session.roomName} failed: ${(error as Error).message}`);
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Recording (LiveKit egress → the private video bucket)
  // -------------------------------------------------------------------------

  private egressClient() {
    const { url, apiKey, apiSecret, configured } = this.livekit();
    if (!configured) return null;
    const apiUrl = this.config.get<string>('livekit.apiUrl') || url.replace(/^ws/i, 'http');
    return new EgressClient(apiUrl, apiKey, apiSecret);
  }

  /** The S3 API endpoint LiveKit uploads to. Must be reachable from LiveKit. */
  private recordingEndpoint() {
    const override = this.config.get<string>('livekit.recordingS3Endpoint');
    if (override) return override;
    const host = this.config.get<string>('storage.publicEndpoint') ?? '';
    const port = this.config.get<number>('storage.publicPort');
    const ssl = this.config.get<boolean>('storage.publicUseSsl');
    const defaultPort = ssl ? 443 : 80;
    return `${ssl ? 'https' : 'http'}://${host}${port && port !== defaultPort ? `:${port}` : ''}`;
  }

  private async startRecording(session: { id: string; roomName: string }) {
    const egress = this.egressClient();
    if (!egress) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const objectKey = `live-recordings/${session.id}/${stamp}.mp4`;
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: objectKey,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: this.config.get<string>('storage.accessKey') ?? '',
          secret: this.config.get<string>('storage.secretKey') ?? '',
          region: this.config.get<string>('storage.region') ?? 'us-east-1',
          bucket: this.config.get<string>('storage.videoBucket') ?? '',
          endpoint: this.recordingEndpoint(),
          forcePathStyle: this.config.get<boolean>('storage.forcePathStyle') ?? true,
        }),
      },
    });
    try {
      // "speaker" puts a shared screen front and centre with the camera beside it.
      const info = await egress.startRoomCompositeEgress(session.roomName, output, { layout: 'speaker' });
      await this.prisma.liveRecording.create({
        data: { sessionId: session.id, egressId: info.egressId, objectKey, status: LiveRecordingStatus.RECORDING },
      });
      await this.broadcast(session.roomName, { type: 'recording', active: true });
      this.logger.log(`recording started for ${session.id} (${info.egressId})`);
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`recording start failed for ${session.id}: ${message}`);
      await this.prisma.liveRecording.create({
        data: {
          sessionId: session.id,
          egressId: `failed-${randomUUID()}`,
          objectKey,
          status: LiveRecordingStatus.FAILED,
          endedAt: new Date(),
          error: message.slice(0, 500),
        },
      });
    }
  }

  /** Stops every running segment; the files finish uploading in the background. */
  private async stopRecordings(sessionId: string) {
    const active = await this.prisma.liveRecording.findMany({
      where: { sessionId, status: LiveRecordingStatus.RECORDING },
      select: { id: true, egressId: true, session: { select: { roomName: true } } },
    });
    if (!active.length) return;
    const egress = this.egressClient();
    for (const recording of active) {
      try {
        await egress?.stopEgress(recording.egressId);
      } catch (error) {
        // Already stopping (e.g. the room closed first): the sync settles it.
        this.logger.warn(`stopEgress ${recording.egressId}: ${(error as Error).message}`);
      }
      await this.prisma.liveRecording.update({
        where: { id: recording.id },
        data: { status: LiveRecordingStatus.PROCESSING, endedAt: new Date() },
      });
    }
    await this.broadcast(active[0].session.roomName, { type: 'recording', active: false });
  }

  /** Moves stopped segments to READY / FAILED once LiveKit reports the result. */
  private async syncRecordings() {
    const egress = this.egressClient();
    if (!egress) return;
    const pending = await this.prisma.liveRecording.findMany({
      where: { status: { in: [LiveRecordingStatus.RECORDING, LiveRecordingStatus.PROCESSING] } },
      select: { id: true, egressId: true, status: true, startedAt: true },
      take: 50,
    });
    for (const recording of pending) {
      let info;
      try {
        [info] = await egress.listEgress({ egressId: recording.egressId });
      } catch (error) {
        this.logger.warn(`listEgress ${recording.egressId}: ${(error as Error).message}`);
        continue;
      }
      if (!info) {
        if (Date.now() - recording.startedAt.getTime() > 60 * 60 * 1000) {
          await this.prisma.liveRecording.update({
            where: { id: recording.id },
            data: { status: LiveRecordingStatus.FAILED, error: 'LiveKit مبقاش عارف التسجيل ده' },
          });
        }
        continue;
      }
      if (info.status === EgressStatus.EGRESS_COMPLETE || info.status === EgressStatus.EGRESS_LIMIT_REACHED) {
        const file = info.fileResults[0];
        await this.prisma.liveRecording.update({
          where: { id: recording.id },
          data: {
            status: file ? LiveRecordingStatus.READY : LiveRecordingStatus.FAILED,
            endedAt: info.endedAt ? new Date(Number(info.endedAt / 1_000_000n)) : new Date(),
            durationSeconds: file ? Math.round(Number(file.duration) / 1e9) : null,
            sizeBytes: file ? file.size : null,
            error: file ? null : info.error || 'التسجيل خلص من غير ملف',
          },
        });
      } else if (info.status === EgressStatus.EGRESS_FAILED || info.status === EgressStatus.EGRESS_ABORTED) {
        await this.prisma.liveRecording.update({
          where: { id: recording.id },
          data: {
            status: LiveRecordingStatus.FAILED,
            endedAt: new Date(),
            error: (info.error || 'فشل التسجيل').slice(0, 500),
          },
        });
      } else if (info.status === EgressStatus.EGRESS_ENDING && recording.status === LiveRecordingStatus.RECORDING) {
        await this.prisma.liveRecording.update({
          where: { id: recording.id },
          data: { status: LiveRecordingStatus.PROCESSING, endedAt: new Date() },
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Monitor: presenter presence, recording segments, auto-close
  // -------------------------------------------------------------------------

  private monitoring = false;

  private static isPresenter(participant: ParticipantInfo) {
    try {
      if (JSON.parse(participant.metadata || '{}').host) return true;
    } catch {
      // fall through to the permission check
    }
    return Boolean(participant.permission?.canPublish);
  }

  @Interval('live-monitor', 10_000)
  async monitor() {
    if (this.monitoring || !this.livekit().configured) return;
    this.monitoring = true;
    try {
      await this.watchLiveSessions();
      await this.syncRecordings();
    } catch (error) {
      this.logger.error(`live monitor: ${(error as Error).message}`);
    } finally {
      this.monitoring = false;
    }
  }

  private async watchLiveSessions() {
    const rooms = this.roomService();
    if (!rooms) return;
    const sessions = await this.prisma.liveSession.findMany({
      where: { status: LiveSessionStatus.LIVE },
      select: {
        id: true,
        roomName: true,
        startedAt: true,
        hostAbsentSince: true,
        recordingEnabled: true,
        kickedUserIds: true,
        recordings: {
          where: { status: { in: [LiveRecordingStatus.RECORDING, LiveRecordingStatus.FAILED] } },
          select: { status: true, startedAt: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const session of sessions) {
      let participants: ParticipantInfo[] = [];
      try {
        participants = await rooms.listParticipants(session.roomName);
      } catch (error) {
        // Only a confirmed missing room proves absence. Network/auth failures
        // must not stop recordings or close a class whose host is still online.
        if ((error as { code?: string })?.code !== 'not_found') {
          this.logger.warn(`listParticipants ${session.roomName} failed: ${(error as Error).message}`);
          continue;
        }
        participants = [];
      }
      // Also catch joins already in flight when the teacher kicked the student.
      for (const participant of participants) {
        if (session.kickedUserIds.includes(participant.identity)) {
          try { await rooms.removeParticipant(session.roomName, participant.identity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) }); }
          catch (error) { this.logger.warn(`remove banned participant failed: ${(error as Error).message}`); }
        }
      }
      const presenter = participants.find((p) => !session.kickedUserIds.includes(p.identity) && LiveService.isPresenter(p));
      const latest = session.recordings[0];
      const recording = latest?.status === LiveRecordingStatus.RECORDING;

      if (presenter) {
        if (session.hostAbsentSince) {
          await this.prisma.liveSession.update({ where: { id: session.id }, data: { hostAbsentSince: null } });
        }
        const publishing = presenter.tracks.length > 0;
        const recentlyFailed =
          latest?.status === LiveRecordingStatus.FAILED && Date.now() - latest.startedAt.getTime() < RECORDING_RETRY_MS;
        if (session.recordingEnabled && publishing && !recording && !recentlyFailed) {
          await this.startRecording(session);
        }
        continue;
      }

      // Presenter missing: the recording ends here, exactly where they left.
      if (recording) await this.stopRecordings(session.id);

      const now = Date.now();
      const absentSince = session.hostAbsentSince ?? new Date(now);
      if (!session.hostAbsentSince) {
        await this.prisma.liveSession.update({ where: { id: session.id }, data: { hostAbsentSince: absentSince } });
      }
      const joinWindowOpen = now - (session.startedAt?.getTime() ?? now) < JOIN_GRACE_MS;
      if (!joinWindowOpen && now - absentSince.getTime() >= HOST_GRACE_MS) {
        this.logger.log(`auto-closing ${session.id}: presenter left`);
        await this.finish(session.id, LiveEndReason.HOST_LEFT);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Recordings, for the teacher only
  // -------------------------------------------------------------------------

  async recordingUrl(id: string, download: boolean) {
    const recording = await this.prisma.liveRecording.findUnique({
      where: { id },
      select: { objectKey: true, status: true, session: { select: { title: true } } },
    });
    if (!recording) throw new NotFoundException('التسجيل ده مش موجود');
    if (recording.status !== LiveRecordingStatus.READY) throw new ConflictException('التسجيل لسه مش جاهز');
    const bucket = this.config.get<string>('storage.videoBucket') ?? '';
    const filename = `${recording.session.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'live'}.mp4`;
    const url = await this.storage.presignDownload(
      bucket,
      recording.objectKey,
      2 * 60 * 60,
      download
        ? { 'response-content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }
        : undefined,
    );
    return { url };
  }

  async deleteRecording(actor: AuthenticatedUser, id: string) {
    const recording = await this.prisma.liveRecording.findUnique({
      where: { id },
      select: { id: true, status: true, objectKey: true, sessionId: true },
    });
    if (!recording) throw new NotFoundException('التسجيل ده مش موجود');
    if (recording.status === LiveRecordingStatus.RECORDING || recording.status === LiveRecordingStatus.PROCESSING) {
      throw new ConflictException('استنى لحد ما التسجيل يخلص وبعدين امسحه');
    }
    if (recording.status === LiveRecordingStatus.READY) {
      try {
        await this.storage.removeObject(this.config.get<string>('storage.videoBucket') ?? '', recording.objectKey);
      } catch (error) {
        this.logger.warn(`remove ${recording.objectKey}: ${(error as Error).message}`);
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.liveRecording.delete({ where: { id } });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'live.recording.delete',
        entityType: 'LiveRecording',
        entityId: id,
        metadata: { sessionId: recording.sessionId },
      });
    });
    return { deleted: true };
  }

  async cancel(actor: AuthenticatedUser, id: string) {
    const session = await this.transition(
      actor,
      id,
      [LiveSessionStatus.SCHEDULED],
      LiveSessionStatus.CANCELLED,
      'مينفعش تلغي لايف بدأ أو خلص',
    );
    return this.view(session);
  }

  async setChat(actor: AuthenticatedUser, id: string, enabled: boolean) {
    const session = await this.load(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.liveSession.update({ where: { id }, data: { chatEnabled: enabled } });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: enabled ? 'live.chat.open' : 'live.chat.close',
        entityType: 'LiveSession',
        entityId: id,
      });
    });
    await this.broadcast(session.roomName, { type: 'chat-state', enabled });
    return { chatEnabled: enabled };
  }

  /** Who reacted with what — shown to the teacher only. */
  async reactionsFor(id: string) {
    await this.load(id);
    const [recent, grouped] = await Promise.all([
      this.prisma.liveReaction.findMany({
        where: { sessionId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, emoji: true, createdAt: true, user: { select: { id: true, fullName: true } } },
      }),
      this.prisma.liveReaction.groupBy({ by: ['emoji'], where: { sessionId: id }, _count: { _all: true } }),
    ]);
    return {
      totals: grouped.map((row) => ({ emoji: row.emoji, count: row._count._all })),
      recent: recent.map((row) => ({
        id: row.id,
        emoji: row.emoji,
        userId: row.user.id,
        name: row.user.fullName,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async participantsFor(id: string) {
    const session = await this.load(id);
    const rooms = this.roomService();
    if (!rooms) throw new ServiceUnavailableException('البث مش متفعّل');
    let participants: ParticipantInfo[];
    try { participants = await rooms.listParticipants(session.roomName); }
    catch (error) {
      if ((error as { code?: string })?.code === 'not_found') participants = [];
      else throw new ServiceUnavailableException('مقدرناش نجيب الحاضرين، حاول تاني');
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: participants.map((p) => p.identity) } },
      select: { id: true, fullName: true, role: true },
    });
    const items = participants.flatMap((participant) => {
      const user = users.find((u) => u.id === participant.identity);
      return user ? [{ id: user.id, name: user.fullName, isHost: LiveService.canHost(user.role), canKick: user.role === Role.STUDENT }] : [];
    });
    return { title: session.title, status: session.status, count: items.length, studentCount: items.filter((p) => p.canKick).length, items };
  }

  async kickParticipant(actor: AuthenticatedUser, id: string, userId: string) {
    if (!LiveService.canHost(actor.role)) throw new ForbiddenException('غير مسموح');
    const session = await this.load(id);
    if (session.status !== LiveSessionStatus.LIVE) throw new ConflictException('اللايف مش شغال');
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target || target.role !== Role.STUDENT || userId === actor.id) throw new BadRequestException('تقدر تطرد طالب بس');
    const rooms = this.roomService();
    if (!rooms) throw new ServiceUnavailableException('البث مش متفعّل');
    // Persist the ban before revoking tokens so no new join ticket is issued.
    await this.prisma.$transaction(async (tx) => {
      await tx.liveSession.updateMany({ where: { id, NOT: { kickedUserIds: { has: userId } } }, data: { kickedUserIds: { push: userId } } });
      await this.audit.record(tx, { actorId: actor.id, action: 'live.participant.kick', entityType: 'LiveSession', entityId: id, metadata: { userId } });
    });
    try { await rooms.removeParticipant(session.roomName, userId, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1) }); }
    catch { throw new ServiceUnavailableException('اتمنع دخوله، لكن فصل الاتصال فشل؛ اضغط طرد تاني'); }
    return { kicked: true };
  }
}
