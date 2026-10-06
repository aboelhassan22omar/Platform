'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { formatEgp } from '@/lib/utils';
import type { LessonDetail } from '@/types/api';

/**
 * Shown instead of the player when the student is not entitled.
 *
 * The message is chosen from the reason the API returned, so "your
 * subscription lapsed" prompts a renewal while "you never had this" prompts a
 * purchase. No video URL exists at this point — the paywall is not a curtain
 * over a loaded stream.
 */
const REASON_COPY: Record<string, { title: string; body: string; cta: 'buy' | 'renew' | 'none' }> =
  {
    NO_ENTITLEMENT: {
      title: 'الحصة دي مقفولة',
      body: 'اشترِ الحصة لوحدها، أو اشترك في باقة الصف وافتح كل الحصص مرة واحدة.',
      cta: 'buy',
    },
    EXPIRED: {
      title: 'انتهت صلاحية اشتراكك',
      body: 'جدّد اشتراكك عشان ترجع تتفرج على الحصة دي وباقي حصص الصف.',
      cta: 'renew',
    },
    NOT_PUBLISHED: {
      title: 'الحصة لسه مش منشورة',
      body: 'الحصة دي لسه بتتجهز، هتكون متاحة قريب.',
      cta: 'none',
    },
    WRONG_GRADE: {
      title: 'الحصة دي مش تابعة لصفك',
      body: 'تقدر تشاهد حصص الصف الدراسي المسجل في حسابك فقط، بما فيها الحصص المجانية.',
      cta: 'none',
    },
  };

export function LockedLesson({
  lesson,
  onBuy,
  isBuying,
  error,
}: {
  lesson: LessonDetail;
  onBuy: () => void;
  isBuying: boolean;
  error: string | null;
}) {
  // A lesson the student owns but whose video is still transcoding.
  if (lesson.access.allowed && !lesson.isPlayable) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-midnight-950 p-8 text-center">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-gold-400 border-t-transparent" />
        <p className="font-display text-base font-bold text-ivory-50">الفيديو لسه بيتجهز</p>
        <p className="max-w-xs text-sm text-ivory-200/65">
          بنحضّر جودات مختلفة عشان تشتغل كويس على أي نت. جرّب تحدّث الصفحة بعد شوية.
        </p>
      </div>
    );
  }

  const copy = REASON_COPY[lesson.access.reason] ?? REASON_COPY.NO_ENTITLEMENT;

  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-bl from-midnight-900 via-midnight-950 to-midnight-900 p-6 text-center sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--hero-wash)' }}
      />
      <div className="texture-parchment pointer-events-none absolute inset-0" aria-hidden />

      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        aria-hidden
        className="relative grid h-14 w-14 place-items-center rounded-2xl border border-[var(--accent)]/35 bg-[var(--accent)]/15 text-[var(--accent)]"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" strokeWidth="1.7" />
          <path d="M8 10V7a4 4 0 118 0v3" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </motion.div>

      <h2 className="relative mt-5 font-display text-xl font-black text-ivory-50 sm:text-2xl">
        {copy.title}
      </h2>
      <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-ivory-200/70">
        {copy.body}
      </p>

      {error && (
        <p
          role="alert"
          className="relative mt-4 rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {copy.cta !== 'none' && (
        <div className="relative mt-6 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row sm:justify-center">
          {copy.cta === 'buy' && lesson.productId && lesson.priceMinor != null && (
            <Button variant="accent" size="lg" isLoading={isBuying} onClick={onBuy}>
              اشترِ الحصة — {formatEgp(lesson.priceMinor)}
            </Button>
          )}
          <Link
            href={`/grades/${lesson.course.gradeSlug}#plans`}
            className="inline-flex min-h-13 items-center justify-center rounded-xl border border-ivory-50/20 bg-ivory-50/5 px-7 text-base font-semibold text-ivory-50 transition-colors hover:bg-ivory-50/10"
          >
            {copy.cta === 'renew' ? 'جدّد الاشتراك' : 'شوف الباقات'}
          </Link>
        </div>
      )}
    </div>
  );
}
