import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

export interface AuditEntry {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Keys that must never reach the audit log, whatever a caller passes. */
const REDACTED_KEYS = [
  'password',
  'passwordhash',
  'token',
  'secret',
  'apikey',
  'hmac',
  'authorization',
  'cookie',
  'card',
  'cvv',
  'pan',
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an audit row. Pass the surrounding transaction client when the
   * action itself is transactional, so the log and the change commit together
   * and the trail can never disagree with reality.
   */
  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          targetUserId: entry.targetUserId,
          metadata: entry.metadata
            ? (this.redact(entry.metadata) as Prisma.InputJsonValue)
            : undefined,
          ip: entry.ip,
        },
      });
    } catch (error) {
      // Never let audit logging break the operation it is describing.
      this.logger.error(`Failed to write audit entry ${entry.action}: ${(error as Error).message}`);
    }
  }

  /** Recursively strips anything that looks like a credential. */
  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => [
          key,
          REDACTED_KEYS.some((needle) => key.toLowerCase().includes(needle))
            ? '[REDACTED]'
            : this.redact(val),
        ]),
      );
    }
    return value;
  }

  async list(params: { page?: number; pageSize?: number; action?: string }) {
    const take = Math.min(Math.max(params.pageSize ?? 50, 1), 200);
    const skip = (Math.max(params.page ?? 1, 1) - 1) * take;
    const where = params.action ? { action: { contains: params.action } } : {};

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          actor: { select: { id: true, fullName: true, username: true, role: true } },
          targetUser: { select: { id: true, fullName: true, username: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: params.page ?? 1, pageSize: take };
  }
}
