'use client';

import { useEffect, useState } from 'react';
import { cn, toArabicDigits } from '@/lib/utils';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  done: boolean;
}

const split = (ms: number): CountdownParts => {
  const total = Math.max(0, ms);
  const seconds = Math.floor(total / 1000);
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    totalMs: total,
    done: total <= 0,
  };
};

/**
 * Ticks once a second towards `target`. Returns null until mounted so the
 * server render and the first client render agree.
 */
export function useCountdown(target: string | Date | null | undefined): CountdownParts | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!target || now === null) return null;
  return split(new Date(target).getTime() - now);
}

/** "الاتنين ٦ أكتوبر · ٨:٠٠ م" */
export const formatLiveDate = (iso: string) =>
  new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

const pad = (value: number) => toArabicDigits(String(value).padStart(2, '0'));

export function CountdownDisplay({
  parts,
  size = 'md',
  className,
}: {
  parts: CountdownParts | null;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const units: Array<[string, number | null]> = [
    ['يوم', parts?.days ?? null],
    ['ساعة', parts?.hours ?? null],
    ['دقيقة', parts?.minutes ?? null],
    ['ثانية', parts?.seconds ?? null],
  ];

  return (
    <div
      className={cn('grid grid-cols-4 gap-2', size === 'lg' && 'gap-3', className)}
      role="timer"
      aria-live="off"
      aria-label={
        parts
          ? `باقي ${parts.days} يوم و${parts.hours} ساعة و${parts.minutes} دقيقة`
          : 'جاري حساب الوقت المتبقي'
      }
    >
      {units.map(([label, value]) => (
        <div
          key={label}
          className={cn(
            'rounded-xl border border-gold-500/25 bg-midnight-950/5 text-center dark:bg-white/5',
            size === 'lg' ? 'px-2 py-3 sm:py-4' : 'px-1.5 py-2',
          )}
        >
          <span
            className={cn(
              'nums-tabular block font-display font-black text-midnight-950 dark:text-ivory-50',
              size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl',
            )}
          >
            {value === null ? '--' : pad(value)}
          </span>
          <span className="mt-0.5 block text-[11px] font-bold text-midnight-500 dark:text-ivory-300/70">{label}</span>
        </div>
      ))}
    </div>
  );
}
