/**
 * Calendar maths in Cairo time. Egypt observes daylight saving again, so the
 * offset is read from Intl for the instant in question, never hard-coded.
 */
const TIME_ZONE = 'Africa/Cairo';

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CairoParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

export function cairoParts(date: Date): CairoParts {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** Minutes Cairo is ahead of UTC at this instant (120 or 180). */
function offsetMinutes(date: Date): number {
  const p = cairoParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

/** The instant a Cairo calendar day starts, `days` days from the given date's day. */
export function startOfCairoDay(date: Date, days = 0): Date {
  const p = cairoParts(date);
  const midnightUtc = Date.UTC(p.year, p.month - 1, p.day + days);
  // Use the offset at that day's midnight, which can differ across a DST change.
  const guess = new Date(midnightUtc - offsetMinutes(date) * 60_000);
  return new Date(midnightUtc - offsetMinutes(guess) * 60_000);
}

/** "2026-10-17" for the Cairo day containing the instant. */
export function cairoDayKey(date: Date): string {
  const p = cairoParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** The same day as a UTC-midnight Date, which is how Postgres DATE columns map. */
export function cairoDateOnly(date: Date): Date {
  return new Date(`${cairoDayKey(date)}T00:00:00.000Z`);
}

const dateTimeAr = new Intl.DateTimeFormat('ar-EG', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
});
const timeAr = new Intl.DateTimeFormat('ar-EG', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});
const dayAr = new Intl.DateTimeFormat('ar-EG', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "الخميس ٢٣ أكتوبر، ٨:٠٠ م" */
export const formatCairoDateTime = (date: Date) => dateTimeAr.format(date);
/** "٨:٠٠ م" */
export const formatCairoTime = (date: Date) => timeAr.format(date);
/** "الخميس ٢٣ أكتوبر" */
export const formatCairoDay = (date: Date) => dayAr.format(date);
