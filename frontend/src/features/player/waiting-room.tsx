'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { PlaybackQueue } from '@/types/api';

/** "حوالي ٧ دقايق" — deliberately approximate, never a promise. */
const n = (value: number) => value.toLocaleString('ar-EG');

export function formatWait(seconds: number): string {
  if (seconds < 60) return 'أقل من دقيقة';
  const minutes = Math.round(seconds / 60);
  if (minutes === 1) return 'حوالي دقيقة';
  if (minutes === 2) return 'حوالي دقيقتين';
  if (minutes < 11) return `حوالي ${n(minutes)} دقايق`;
  if (minutes < 60) return `حوالي ${n(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${n(hours)} ساعات`;
  return rest ? `حوالي ${hourLabel} و${n(rest)} دقيقة` : `حوالي ${hourLabel}`;
}

/**
 * Shown instead of the player while the platform is at its viewer limit.
 * The parent keeps polling; this only renders the student's place in line
 * and a live countdown to the next check, so the wait never feels frozen.
 */
export function WaitingRoom({ queue }: { queue: PlaybackQueue }) {
  const [nextCheck, setNextCheck] = useState(queue.retryAfterSeconds);

  useEffect(() => {
    setNextCheck(queue.retryAfterSeconds);
    const timer = window.setInterval(() => setNextCheck((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [queue]);

  const roomFull = queue.position === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl bg-midnight-950 p-6 text-center sm:p-10"
    >
      <div className="relative grid h-16 w-16 place-items-center">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-gold-400/40"
          animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <span className="grid h-16 w-16 place-items-center rounded-full bg-gold-400/15 text-gold-300">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="8.5" strokeWidth="1.7" />
            <path d="M12 7.5V12l3 2" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div>
        <p className="font-display text-lg font-black text-ivory-50 sm:text-xl">
          المنصة على آخرها دلوقتي
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ivory-200/70">
          {roomFull
            ? 'عدد كبير جدًا بيستنى حاليًا. خليك في الصفحة وهنحاول ندخلك تلقائيًا.'
            : 'عشان الفيديو يشتغل بجودة كويسة للكل، بندخّل الطلاب بالدور. خليك في الصفحة وهيشتغل لوحده أول ما دورك ييجي.'}
        </p>
      </div>

      {!roomFull && (
        <dl className="grid w-full max-w-xs grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-ivory-50/5 px-3 py-3">
            <dt className="text-[11px] font-bold text-ivory-200/60">دورك</dt>
            <dd className="nums-tabular mt-0.5 font-display text-2xl font-black text-gold-300">
              {n(queue.position)}
            </dd>
          </div>
          <div className="rounded-xl bg-ivory-50/5 px-3 py-3">
            <dt className="text-[11px] font-bold text-ivory-200/60">الوقت المتوقع</dt>
            <dd className="mt-1.5 text-sm font-black leading-tight text-ivory-50">
              {formatWait(queue.etaSeconds)}
            </dd>
          </div>
        </dl>
      )}

      <p className="text-[11px] text-ivory-200/50">
        {nextCheck > 0 ? `هنشيّك تاني بعد ${n(nextCheck)} ثانية` : 'بنشيّك دلوقتي…'}
      </p>
    </div>
  );
}
