import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className joiner. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * Prices arrive from the API as integer piastres. Never do arithmetic on the
 * formatted output — format only at the point of display.
 */
export const formatEgp = (minor: number | null | undefined): string => {
  if (minor == null) return '—';
  const pounds = minor / 100;
  // Whole pounds lose the decimals: "١٢٠ ج.م" reads better than "١٢٠٫٠٠".
  const value = Number.isInteger(pounds)
    ? pounds.toLocaleString('ar-EG', { maximumFractionDigits: 0 })
    : pounds.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value} ج.م`;
};

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** `3725` -> `١:٠٢:٠٥`. Used on the player and on lesson cards. */
export const formatDuration = (totalSeconds: number | null | undefined): string => {
  if (!totalSeconds || totalSeconds < 0) return '٠٠:٠٠';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const latin =
    hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return toArabicDigits(latin);
};

/** A friendlier duration for cards: "٤٥ دقيقة", "١ ساعة و٢٠ دقيقة". */
export const formatDurationLabel = (totalSeconds: number | null | undefined): string => {
  if (!totalSeconds) return 'لسه مش متاح';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${toArabicDigits(String(minutes))} دقيقة`;
  if (minutes === 0) return `${toArabicDigits(String(hours))} ساعة`;
  return `${toArabicDigits(String(hours))} ساعة و${toArabicDigits(String(minutes))} دقيقة`;
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** "من ٣ أيام" — relative time for "last watched" labels. */
export const formatRelative = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const then = new Date(value).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'دلوقتي';
  if (minutes < 60) return `من ${toArabicDigits(String(minutes))} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `من ${toArabicDigits(String(hours))} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'إمبارح';
  if (days < 30) return `من ${toArabicDigits(String(days))} يوم`;
  return formatDate(value);
};

// ---------------------------------------------------------------------------
// Arabic numerals
// ---------------------------------------------------------------------------

const EASTERN = '٠١٢٣٤٥٦٧٨٩';

/** Converts ASCII digits to Eastern-Arabic for display in prose. */
export const toArabicDigits = (input: string | number): string =>
  String(input).replace(/\d/g, (d) => EASTERN[Number(d)]);

export const formatNumber = (value: number | null | undefined): string =>
  value == null ? '—' : value.toLocaleString('ar-EG');

/** "٣ حصص" / "حصة واحدة" — Arabic has singular, dual and plural forms. */
export const pluralizeAr = (
  count: number,
  [singular, dual, plural]: [string, string, string],
): string => {
  if (count === 1) return singular;
  if (count === 2) return dual;
  return `${toArabicDigits(String(count))} ${plural}`;
};

export const greetingFor = (hour: number): string => {
  if (hour >= 4 && hour < 12) return 'صباح الخير والهمة';
  if (hour >= 12 && hour < 17) return 'مساء النور والتركيز';
  return 'مساء الخير والمذاكرة الهادية';
};

export const initialsOf = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ع';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
};
