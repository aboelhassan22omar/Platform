import { BadRequestException } from '@nestjs/common';
import { PublishStatus } from '../../generated/prisma/enums';

/** One rule for course, unit, chapter and lesson scheduled publication. */
export function resolvePublicationSchedule(
  status?: PublishStatus,
  scheduledAt?: string,
): Date | null {
  if (status !== PublishStatus.SCHEDULED) return null;
  if (!scheduledAt) throw new BadRequestException('حدد تاريخ ووقت النشر المجدول');
  const date = new Date(scheduledAt);
  if (!Number.isFinite(date.getTime()))
    throw new BadRequestException('تاريخ النشر المجدول غير صالح');
  if (date <= new Date()) throw new BadRequestException('وقت النشر المجدول لازم يكون في المستقبل');
  return date;
}
