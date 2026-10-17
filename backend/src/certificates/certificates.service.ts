import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { AssessmentAttemptStatus } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { CertificateTemplateService } from './certificate-template.service';

/** No 0/O, 1/I/L: the serial is read off paper and typed back in. */
const SERIAL_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** 10 random characters as XXXX-XXXX-XX (31^10 ≈ 8e14 combinations). */
export function newCertificateSerial(): string {
  const chars = Array.from(
    { length: 10 },
    () => SERIAL_ALPHABET[randomInt(SERIAL_ALPHABET.length)],
  ).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

const FINISHED: AssessmentAttemptStatus[] = [
  AssessmentAttemptStatus.SUBMITTED,
  AssessmentAttemptStatus.TIMED_OUT,
];

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly template: CertificateTemplateService,
  ) {}

  /**
   * Issues (or upgrades) the student's certificate for a finished attempt that
   * reaches the exam's minimum score. Returns null when the attempt does not
   * qualify. Safe to call more than once for the same attempt.
   */
  async issueForAttempt(attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        userId: true,
        status: true,
        percentage: true,
        user: { select: { fullName: true } },
        assessment: {
          select: {
            id: true,
            title: true,
            certificateEnabled: true,
            certificateMinScore: true,
          },
        },
      },
    });
    if (!attempt || !FINISHED.includes(attempt.status)) return null;
    const { assessment } = attempt;
    if (!assessment.certificateEnabled || attempt.percentage < assessment.certificateMinScore)
      return null;

    const where = { userId_assessmentId: { userId: attempt.userId, assessmentId: assessment.id } };
    const existing = await this.prisma.certificate.findUnique({ where });
    if (existing) {
      if (existing.percentage >= attempt.percentage) return existing;
      // A better attempt: same serial, new score and date.
      return this.prisma.certificate.update({
        where,
        data: {
          attemptId: attempt.id,
          percentage: attempt.percentage,
          recipientName: attempt.user.fullName,
          assessmentTitle: assessment.title,
          issuedAt: new Date(),
        },
      });
    }

    for (let tries = 0; tries < 3; tries += 1) {
      try {
        return await this.prisma.certificate.create({
          data: {
            serial: newCertificateSerial(),
            userId: attempt.userId,
            assessmentId: assessment.id,
            attemptId: attempt.id,
            recipientName: attempt.user.fullName,
            assessmentTitle: assessment.title,
            percentage: attempt.percentage,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Two submissions racing for the same student, or a serial collision.
        const raced = await this.prisma.certificate.findUnique({ where });
        if (raced) return raced;
      }
    }
    return null;
  }

  /**
   * Certificates for students who already reached the minimum score before
   * the admin switched certificates on (or lowered the minimum).
   */
  async backfill(assessmentId: string): Promise<number> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { certificateEnabled: true, certificateMinScore: true },
    });
    if (!assessment?.certificateEnabled) return 0;
    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: {
        assessmentId,
        status: { in: FINISHED },
        percentage: { gte: assessment.certificateMinScore },
      },
      orderBy: [{ percentage: 'desc' }, { submittedAt: 'asc' }],
      select: { id: true, userId: true },
    });
    const best = new Map<string, string>();
    for (const attempt of attempts)
      if (!best.has(attempt.userId)) best.set(attempt.userId, attempt.id);
    let issued = 0;
    for (const attemptId of best.values()) if (await this.issueForAttempt(attemptId)) issued += 1;
    return issued;
  }

  mine(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      select: {
        serial: true,
        assessmentId: true,
        assessmentTitle: true,
        percentage: true,
        issuedAt: true,
      },
    });
  }

  /** What the public certificate page shows; anyone holding the serial can verify it. */
  async publicView(serial: string) {
    const normalized = serial.trim().toUpperCase();
    const certificate = await this.prisma.certificate.findUnique({
      where: { serial: normalized },
      select: {
        serial: true,
        recipientName: true,
        assessmentTitle: true,
        percentage: true,
        issuedAt: true,
      },
    });
    if (!certificate) throw new NotFoundException('الشهادة غير موجودة. اتأكد من الكود.');
    return { ...certificate, template: await this.template.get() };
  }
}
