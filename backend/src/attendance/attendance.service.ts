import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  AttendanceMethod,
  MessageKind,
  Role,
  StudentType,
  UserStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { formatCairoDay } from '../common/utils/cairo-time';
import { OutboxService } from '../messaging/outbox.service';

const TOKEN_PREFIX = 'ATT1';

export type ScanResult =
  | {
      status: 'marked' | 'already';
      student: { id: string; fullName: string; studentType: StudentType };
    }
  | { status: 'wrong_grade'; student: { id: string; fullName: string; grade: string | null } }
  | { status: 'invalid' };

/**
 * Attendance at the center. Every student carries a personal QR (on their
 * phone or a printed card); an assistant scans it at the door and the visit
 * lands in the same account the student uses online, and in the parent's
 * weekly report. The QR is signed, so a code cannot be made up for someone.
 */
@Injectable()
export class AttendanceService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    config: ConfigService,
  ) {
    this.secret = `attendance:${config.get<string>('auth.accessSecret')}`;
  }

  private sign(userId: string): string {
    return createHmac('sha256', this.secret).update(userId).digest('base64url').slice(0, 22);
  }

  /** The text inside a student's QR. Stable, so a printed card keeps working. */
  cardToken(userId: string): string {
    return `${TOKEN_PREFIX}.${userId}.${this.sign(userId)}`;
  }

  private readToken(token: string): string | null {
    const [prefix, userId, signature] = token.trim().split('.');
    if (prefix !== TOKEN_PREFIX || !userId || !signature) return null;
    const expected = Buffer.from(this.sign(userId));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
  }

  async card(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        fullName: true,
        username: true,
        educationSystem: true,
        gradeLevel: true,
        studentType: true,
      },
    });
    const grade =
      user.educationSystem && user.gradeLevel
        ? await this.prisma.grade.findUnique({
            where: {
              educationSystem_level: {
                educationSystem: user.educationSystem,
                level: user.gradeLevel,
              },
            },
            select: { nameAr: true },
          })
        : null;
    return {
      token: this.cardToken(userId),
      fullName: user.fullName,
      username: user.username,
      grade: grade?.nameAr ?? null,
      studentType: user.studentType,
    };
  }

  /** The student's own record: recent visits and how many classes of their grade they attended. */
  async mine(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { educationSystem: true, gradeLevel: true },
    });
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [records, held] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { userId },
        orderBy: { markedAt: 'desc' },
        take: 50,
        select: { markedAt: true, session: { select: { title: true, startsAt: true } } },
      }),
      user.educationSystem && user.gradeLevel
        ? this.prisma.attendanceSession.count({
            where: {
              startsAt: { gte: since, lte: new Date() },
              grade: { educationSystem: user.educationSystem, level: user.gradeLevel },
            },
          })
        : 0,
    ]);
    return {
      lastMonth: {
        held,
        attended: records.filter((record) => record.session.startsAt >= since).length,
      },
      records: records.map((record) => ({
        title: record.session.title,
        startsAt: record.session.startsAt,
        markedAt: record.markedAt,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // Staff
  // --------------------------------------------------------------------------

  async listSessions(gradeId?: string) {
    const sessions = await this.prisma.attendanceSession.findMany({
      where: gradeId ? { gradeId } : {},
      orderBy: { startsAt: 'desc' },
      take: 100,
      include: {
        grade: { select: { id: true, nameAr: true } },
        _count: { select: { records: true } },
      },
    });
    return sessions.map(({ _count, ...session }) => ({ ...session, present: _count.records }));
  }

  async createSession(actorId: string, input: { title: string; gradeId: string; startsAt: Date }) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: input.gradeId },
      select: { id: true },
    });
    if (!grade) throw new BadRequestException('اختار الصف');
    const session = await this.prisma.attendanceSession.create({
      data: {
        title: input.title.trim(),
        gradeId: input.gradeId,
        startsAt: input.startsAt,
        createdById: actorId,
      },
    });
    await this.audit.record(this.prisma, {
      actorId,
      action: 'attendance.session.create',
      entityType: 'AttendanceSession',
      entityId: session.id,
      metadata: { title: session.title },
    });
    return session;
  }

  private async session(id: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        grade: { select: { id: true, nameAr: true, educationSystem: true, level: true } },
      },
    });
    if (!session) throw new NotFoundException('الحصة غير موجودة');
    return session;
  }

  /** Who came, and which center students of the grade did not. */
  async detail(id: string) {
    const session = await this.session(id);
    const [records, centerStudents] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { sessionId: id },
        orderBy: { markedAt: 'desc' },
        select: {
          method: true,
          markedAt: true,
          user: { select: { id: true, fullName: true, phone: true, studentType: true } },
        },
      }),
      this.prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
          studentType: StudentType.CENTER,
          educationSystem: session.grade.educationSystem,
          gradeLevel: session.grade.level,
        },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, phone: true, parentPhone: true },
      }),
    ]);
    const present = new Set(records.map((record) => record.user.id));
    return {
      id: session.id,
      title: session.title,
      startsAt: session.startsAt,
      closedAt: session.closedAt,
      absenceNotifiedAt: session.absenceNotifiedAt,
      grade: { id: session.grade.id, nameAr: session.grade.nameAr },
      present: records.map((record) => ({
        ...record.user,
        method: record.method,
        markedAt: record.markedAt,
      })),
      absent: centerStudents.filter((student) => !present.has(student.id)),
    };
  }

  /** The door scanner: one QR, one answer the assistant can read at a glance. */
  async scan(actorId: string, sessionId: string, token: string): Promise<ScanResult> {
    const userId = this.readToken(token);
    if (!userId) return { status: 'invalid' };
    return this.mark(actorId, sessionId, userId, AttendanceMethod.SCAN);
  }

  async mark(
    actorId: string,
    sessionId: string,
    userId: string,
    method: AttendanceMethod,
  ): Promise<ScanResult> {
    const session = await this.session(sessionId);
    if (session.closedAt) throw new BadRequestException('الحصة اتقفلت، افتحها الأول');
    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        role: true,
        status: true,
        studentType: true,
        educationSystem: true,
        gradeLevel: true,
      },
    });
    if (!student || student.role !== Role.STUDENT || student.status !== UserStatus.ACTIVE) {
      return { status: 'invalid' };
    }
    if (
      student.educationSystem !== session.grade.educationSystem ||
      student.gradeLevel !== session.grade.level
    ) {
      const grade =
        student.educationSystem && student.gradeLevel
          ? await this.prisma.grade.findUnique({
              where: {
                educationSystem_level: {
                  educationSystem: student.educationSystem,
                  level: student.gradeLevel,
                },
              },
              select: { nameAr: true },
            })
          : null;
      return {
        status: 'wrong_grade',
        student: { id: student.id, fullName: student.fullName, grade: grade?.nameAr ?? null },
      };
    }
    const created = await this.prisma.attendance.createMany({
      data: [{ sessionId, userId, method, markedById: actorId }],
      skipDuplicates: true,
    });
    return {
      status: created.count ? 'marked' : 'already',
      student: { id: student.id, fullName: student.fullName, studentType: student.studentType },
    };
  }

  async unmark(sessionId: string, userId: string) {
    const session = await this.session(sessionId);
    if (session.closedAt) throw new BadRequestException('الحصة اتقفلت، افتحها الأول');
    await this.prisma.attendance.deleteMany({ where: { sessionId, userId } });
    return { ok: true };
  }

  /**
   * Ends the class. Optionally tells the parents of absent center students on
   * WhatsApp, once per class.
   */
  async close(actorId: string, id: string, notifyParents: boolean) {
    const session = await this.session(id);
    if (!session.closedAt) {
      await this.prisma.attendanceSession.update({ where: { id }, data: { closedAt: new Date() } });
    }
    let notified = 0;
    if (notifyParents && !session.absenceNotifiedAt) {
      const { absent } = await this.detail(id);
      notified = await this.outbox.enqueue(
        absent.map((student) => ({
          kind: MessageKind.CENTER_ABSENCE,
          userId: student.id,
          phone: student.parentPhone,
          params: [student.fullName, session.title, formatCairoDay(session.startsAt)],
          dedupeKey: `absence:${id}:${student.id}`,
        })),
      );
      await this.prisma.attendanceSession.update({
        where: { id },
        data: { absenceNotifiedAt: new Date() },
      });
    }
    await this.audit.record(this.prisma, {
      actorId,
      action: 'attendance.session.close',
      entityType: 'AttendanceSession',
      entityId: id,
      metadata: { notifyParents, notified },
    });
    return { closed: true, notified };
  }

  async reopen(id: string) {
    await this.session(id);
    await this.prisma.attendanceSession.update({ where: { id }, data: { closedAt: null } });
    return { closed: false };
  }

  async remove(actorId: string, id: string) {
    const session = await this.session(id);
    await this.prisma.attendanceSession.delete({ where: { id } });
    await this.audit.record(this.prisma, {
      actorId,
      action: 'attendance.session.delete',
      entityType: 'AttendanceSession',
      entityId: id,
      metadata: { title: session.title },
    });
    return { ok: true };
  }

  /** Spreadsheet of the class: everyone present, then absent center students. */
  async csv(id: string): Promise<string> {
    const detail = await this.detail(id);
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ['الاسم', 'الموبايل', 'الحالة', 'الوقت', 'الطريقة'],
      ...detail.present.map((student) => [
        student.fullName,
        student.phone,
        'حاضر',
        new Date(student.markedAt).toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' }),
        student.method === AttendanceMethod.SCAN ? 'QR' : 'يدوي',
      ]),
      ...detail.absent.map((student) => [student.fullName, student.phone, 'غايب', '', '']),
    ];
    // BOM so Excel opens Arabic text correctly.
    return `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\r\n')}`;
  }
}
