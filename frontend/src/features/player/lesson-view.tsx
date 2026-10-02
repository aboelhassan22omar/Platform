'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { VideoPlayer } from './video-player';
import { LockedLesson } from './locked-lesson';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { formatDate, formatDurationLabel } from '@/lib/utils';
import { EASE_ENTRANCE } from '@/lib/motion';
import type { LessonDetail, Order } from '@/types/api';
import { PaymentMethodDialog, type CheckoutPaymentMethod } from '@/features/checkout/payment-method-dialog';

export function LessonView({ lesson }: { lesson: LessonDetail }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  const buy = async (method: CheckoutPaymentMethod) => {
    if (!lesson.productId) return;
    if (!user) {
      router.push(`/login?next=/lessons/${lesson.id}`);
      return;
    }

    setIsBuying(true);
    setError(null);
    try {
      const order = await api.post<Order>(
        '/checkout',
        { productIds: [lesson.productId], method },
        { headers: { 'Idempotency-Key': `${user.id}:${lesson.productId}:${Date.now()}` } },
      );
      if (order.redirectUrl) window.location.href = order.redirectUrl;
      else router.push(`/checkout/return?ref=${order.reference}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حصل خطأ، حاول تاني');
      setIsBuying(false);
    }
  };

  const canWatch = lesson.access.allowed && lesson.isPlayable;

  return (
    <div data-theme={lesson.course.themeKey} className="bg-ivory-100">
      <div className="container-page py-6 sm:py-10">
        {/* --- Breadcrumb --- */}
        <nav
          aria-label="مسار التنقل"
          className="flex flex-wrap items-center gap-2 text-xs text-midnight-400"
        >
          <Link href="/grades" className="transition-colors hover:text-midnight-700">
            الصفوف
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/grades/${lesson.course.gradeSlug}`}
            className="transition-colors hover:text-midnight-700"
          >
            {lesson.course.gradeName}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/grades/${lesson.course.gradeSlug}/courses/${encodeURIComponent(lesson.course.slug)}`}
            className="transition-colors hover:text-midnight-700"
          >
            {lesson.course.title}
          </Link>
        </nav>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          {/* ---------------------------------------------------------------
              Player / paywall
              --------------------------------------------------------------- */}
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_ENTRANCE }}
            >
              {canWatch ? (
                <VideoPlayer
                  lessonId={lesson.id}
                  title={lesson.title}
                  posterUrl={lesson.thumbnailUrl}
                />
              ) : (
                <LockedLesson
                  lesson={lesson}
                  onBuy={() => {
                    if (!user) {
                      router.push(`/login?next=/lessons/${lesson.id}`);
                      return;
                    }
                    setShowPaymentMethods(true);
                  }}
                  isBuying={isBuying}
                  error={error}
                />
              )}
            </motion.div>

            {/* --- Lesson meta --- */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: EASE_ENTRANCE }}
              className="mt-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                {lesson.isFreePreview && (
                  <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    حصة مجانية
                  </span>
                )}
                <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-midnight-500">
                  {lesson.unit.title}
                </span>
                <span className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-midnight-500">
                  {lesson.chapter.title}
                </span>
              </div>

              <h1 className="mt-3 font-display text-2xl font-black text-midnight-900 sm:text-3xl">
                {lesson.title}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-midnight-500">
                <span>{formatDurationLabel(lesson.durationSeconds)}</span>
                {lesson.progress?.lastWatchedAt && (
                  <span>آخر مشاهدة: {formatDate(lesson.progress.lastWatchedAt)}</span>
                )}
              </div>

              {lesson.description && (
                <p className="mt-4 leading-relaxed text-midnight-600">
                  {lesson.description}
                </p>
              )}

              {/* --- Attachments --- */}
              {lesson.attachments.length > 0 && (
                <section className="mt-7" aria-labelledby="attachments-heading">
                  <h2
                    id="attachments-heading"
                    className="font-display text-base font-extrabold text-midnight-900"
                  >
                    ملفات الحصة
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {lesson.attachments.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center gap-3 rounded-xl border border-ivory-300 bg-white px-4 py-3"
                      >
                        <span
                          aria-hidden
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"
                        >
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M5 2.5h6l4 4v11H5z" strokeWidth="1.5" />
                            <path d="M11 2.5v4h4" strokeWidth="1.5" />
                          </svg>
                        </span>
                        <a
                          className="flex-1 text-sm font-semibold text-midnight-800 underline-offset-4 hover:underline"
                          href={`/api/lessons/${lesson.id}/attachments/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >{file.title}</a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </motion.div>
          </div>

          {/* ---------------------------------------------------------------
              Sidebar
              --------------------------------------------------------------- */}
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: EASE_ENTRANCE }}
            className="lg:sticky lg:top-24 lg:self-start"
          >
            <div className="rounded-2xl border border-ivory-300 bg-white p-5 shadow-card">
              <h2 className="font-display text-base font-extrabold text-midnight-900">
                {lesson.course.title}
              </h2>
              <p className="mt-1 text-xs text-midnight-400">{lesson.course.gradeName}</p>

              {lesson.progress && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-midnight-600">تقدمك في الحصة</span>
                    <span className="font-black text-[var(--accent)]">
                      {lesson.progress.percent}٪
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ivory-200">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: lesson.progress.percent / 100 }}
                      transition={{ duration: 0.9, ease: EASE_ENTRANCE }}
                      style={{ transformOrigin: 'right center' }}
                      className="h-full rounded-full bg-[var(--accent)]"
                    />
                  </div>
                </div>
              )}

              <Link
                href={`/grades/${lesson.course.gradeSlug}/courses/${encodeURIComponent(lesson.course.slug)}`}
                className="mt-5 block rounded-xl border border-ivory-300 px-4 py-3 text-center text-sm font-bold text-midnight-700 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                كل حصص الكورس
              </Link>

              {lesson.access.allowed && (
                <Link
                  href="/dashboard/lessons"
                  className="mt-2 block rounded-xl px-4 py-3 text-center text-sm font-bold text-midnight-500 transition-colors hover:text-midnight-800"
                >
                  الرجوع لحصصي
                </Link>
              )}
            </div>

            {/* Subscription expiry warning — real data from the entitlement. */}
            {lesson.access.allowed && lesson.access.expiresAt && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-800">
                  وصولك للحصة دي من خلال اشتراك
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  ينتهي في {formatDate(lesson.access.expiresAt)}
                </p>
              </div>
            )}
          </motion.aside>
        </div>
      </div>
      <PaymentMethodDialog
        open={showPaymentMethods}
        title={lesson.title}
        amountMinor={lesson.priceMinor ?? 0}
        isPending={isBuying}
        onClose={() => !isBuying && setShowPaymentMethods(false)}
        onConfirm={(method) => void buy(method)}
      />
    </div>
  );
}
