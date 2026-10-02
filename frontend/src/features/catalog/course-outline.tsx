'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { PaymentMethodDialog, type CheckoutPaymentMethod } from '@/features/checkout/payment-method-dialog';
import { api, ApiError } from '@/lib/api';
import { cn, formatDuration, formatEgp, pluralizeAr } from '@/lib/utils';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import { getTheme } from '@/themes/registry';
import type { CourseDetail, LessonSummary, Order, Unit } from '@/types/api';

interface UnitOffer {
  id: string;
  title: string;
  amountMinor: number;
  productIds: string[];
}

/**
 * Course syllabus: units → chapters → lessons.
 *
 * Every lesson row shows a lock state derived from the API's `isAccessible`
 * flag. That flag is a rendering hint — the playback endpoint re-checks the
 * entitlement server-side, so a tampered client still cannot watch anything.
 */
export function CourseOutline({ course }: { course: CourseDetail }) {
  const theme = getTheme(course.grade.themeKey);
  const { user } = useAuth();
  const router = useRouter();
  const [openUnits, setOpenUnits] = useState<Set<string>>(
    // First unit open by default so the page never looks empty.
    () => new Set(course.units.slice(0, 1).map((unit) => unit.id)),
  );
  const [selectedOffer, setSelectedOffer] = useState<UnitOffer | null>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const toggleUnit = (unitId: string) => {
    setOpenUnits((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const buyUnit = async (offer: UnitOffer, method: CheckoutPaymentMethod) => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setPendingOfferId(offer.id);
    setCheckoutError(null);
    try {
      const order = await api.post<Order>(
        '/checkout',
        { productIds: offer.productIds, method },
        { headers: { 'Idempotency-Key': `${user.id}:unit:${offer.id}:${Date.now()}` } },
      );
      if (order.redirectUrl) window.location.href = order.redirectUrl;
      else router.push(`/checkout/return?ref=${encodeURIComponent(order.reference)}`);
    } catch (error) {
      setCheckoutError(
        error instanceof ApiError ? error.message : 'حصل خطأ أثناء بدء الدفع، حاول تاني.',
      );
      setPendingOfferId(null);
    }
  };

  return (
    <div data-theme={course.grade.themeKey} className="bg-ivory-100">
      {/* ------------------------------------------------------------------
          Course header
          ------------------------------------------------------------------ */}
      <section
        className={`relative overflow-hidden bg-gradient-to-b ${theme.heroSurface} py-12 sm:py-16`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--hero-wash)' }}
        />
        <div className="texture-parchment pointer-events-none absolute inset-0" aria-hidden />

        <div className="container-page relative">
          <nav
            aria-label="مسار التنقل"
            className="flex flex-wrap items-center gap-2 text-xs text-ivory-200/60"
          >
            <Link href="/grades" className="transition-colors hover:text-ivory-50">
              الصفوف
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={`/grades/${course.grade.slug}`}
              className="transition-colors hover:text-ivory-50"
            >
              {course.grade.nameAr}
            </Link>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_ENTRANCE }}
            className="mt-5"
          >
            {course.isProvisional && (
              <span className="mb-3 inline-flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-1.5 text-[11px] font-bold text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                محتوى مبدئي — قيد المراجعة مقابل المنهج الرسمي
              </span>
            )}

            <h1 className="font-display text-3xl font-black text-ivory-50 sm:text-4xl">
              {course.title}
            </h1>

            {course.description && (
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-ivory-200/75">
                {course.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Stat label="الوحدات" value={String(course.units.length)} />
              <Stat label="الحصص" value={String(course.lessonCount)} />
              <Stat label="العام الدراسي" value={course.academicYear} />
              {course.accessibleCount > 0 && (
                <Stat
                  label="متاح لك"
                  value={`${course.accessibleCount} / ${course.lessonCount}`}
                  highlight
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#course-units"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-black text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
              >
                اختار الوحدة المناسبة
              </a>
              <Link
                href={`/grades/${course.grade.slug}#plans`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ivory-50/25 px-5 text-sm font-bold text-ivory-50 transition-colors hover:border-[var(--accent)]"
              >
                الاشتراك الشهري والسنوي
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Syllabus
          ------------------------------------------------------------------ */}
      <div id="course-units" className="container-page scroll-mt-24 py-10 sm:py-14">
        <div className="mb-7">
          <h2 className="font-display text-2xl font-black text-midnight-900">وحدات الكورس</h2>
          <p className="mt-2 text-sm text-midnight-500">
            تصفّح المحتوى مجانًا، وادفع فقط للوحدة اللي محتاجها أو اشترك لفتح الصف كاملًا.
          </p>
          {checkoutError && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {checkoutError}
            </p>
          )}
        </div>
        <motion.div
          variants={staggerContainer(0.07)}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {course.units.map((unit, unitIndex) => {
            const isOpen = openUnits.has(unit.id);
            const unitLessons = unit.chapters.flatMap((chapter) => chapter.lessons);
            const isFullyAccessible = unitLessons.length > 0 && unitLessons.every((lesson) => lesson.isAccessible);
            const offer = getUnitOffer(unit);

            return (
              <motion.section
                key={unit.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.45, ease: EASE_ENTRANCE },
                  },
                }}
                className="overflow-hidden rounded-2xl border border-ivory-300 bg-white shadow-card"
              >
                <h2>
                  <div className="flex w-full flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => toggleUnit(unit.id)}
                      aria-expanded={isOpen}
                      aria-controls={`unit-panel-${unit.id}`}
                      className="flex min-h-11 flex-1 items-center gap-4 text-start"
                    >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] font-display text-sm font-black text-[var(--accent)]"
                    >
                      {unitIndex + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-extrabold text-midnight-900">
                        {unit.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-midnight-400">
                        {pluralizeAr(unitLessons.length, ['حصة واحدة', 'حصتان', 'حصة'])}
                      </span>
                    </span>

                    <motion.span
                      aria-hidden
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="shrink-0 text-midnight-400"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path
                          d="M4.5 6.75L9 11.25l4.5-4.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.span>
                    </button>

                    {isFullyAccessible ? (
                      <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700">
                        ✓ الوحدة متاحة لك
                      </span>
                    ) : offer ? (
                      <Button
                        variant="accent"
                        className="shrink-0 sm:min-w-44"
                        isLoading={pendingOfferId === offer.id}
                        onClick={() => {
                          if (!user) {
                            router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
                            return;
                          }
                          setCheckoutError(null);
                          setSelectedOffer(offer);
                        }}
                      >
                        اشترِ الوحدة — {formatEgp(offer.amountMinor)}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-midnight-400">السعر غير مفعّل</span>
                    )}
                  </div>
                </h2>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`unit-panel-${unit.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_ENTRANCE }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-ivory-200">
                        {unit.chapters.map((chapter) => (
                          <div key={chapter.id}>
                            <div className="flex items-center justify-between gap-3 bg-ivory-50 px-5 py-3">
                              <h3 className="text-sm font-bold text-midnight-700">
                                {chapter.title}
                              </h3>
                              {unit.chapters.length > 1 && chapter.priceMinor != null && (
                                <span className="shrink-0 text-xs font-bold text-[var(--accent)]">
                                  ضمن الوحدة: {formatEgp(chapter.priceMinor)}
                                </span>
                              )}
                            </div>

                            <ul className="divide-y divide-ivory-200">
                              {chapter.lessons.map((lesson) => (
                                <LessonRow key={lesson.id} lesson={lesson} courseId={course.id} />
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            );
          })}
        </motion.div>

        {course.units.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ivory-400 bg-white p-10 text-center">
            <p className="font-display text-base font-bold text-midnight-700">
              لسه مفيش وحدات منشورة في الكورس ده
            </p>
          </div>
        )}
      </div>
      <PaymentMethodDialog
        open={Boolean(selectedOffer)}
        title={selectedOffer?.title ?? ''}
        amountMinor={selectedOffer?.amountMinor ?? 0}
        isPending={Boolean(pendingOfferId)}
        onClose={() => {
          if (!pendingOfferId) setSelectedOffer(null);
        }}
        onConfirm={(method) => selectedOffer && void buyUnit(selectedOffer, method)}
      />
    </div>
  );
}

function getUnitOffer(unit: Unit): UnitOffer | null {
  const purchasable = unit.chapters.filter(
    (chapter) => chapter.productId && chapter.priceMinor != null && chapter.priceMinor > 0,
  );
  if (!purchasable.length) return null;

  return {
    id: unit.id,
    title: `الوحدة: ${unit.title}`,
    amountMinor: purchasable.reduce((total, chapter) => total + (chapter.priceMinor ?? 0), 0),
    productIds: purchasable.map((chapter) => chapter.productId!),
  };
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-2.5',
        highlight
          ? 'border-[var(--accent)]/45 bg-[var(--accent)]/12'
          : 'border-ivory-50/12 bg-ivory-50/5',
      )}
    >
      <span className="block text-[11px] text-ivory-200/60">{label}</span>
      <span className="nums-tabular block font-display text-sm font-black text-ivory-50">
        {value}
      </span>
    </div>
  );
}

function LessonRow({ lesson, courseId }: { lesson: LessonSummary; courseId: string }) {
  const canOpen = lesson.isAccessible;

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
          canOpen
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'bg-ivory-200 text-midnight-400',
        )}
      >
        {canOpen ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3l8 5-8 5z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" strokeWidth="1.5" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold',
              canOpen ? 'text-midnight-900' : 'text-midnight-500',
            )}
          >
            {lesson.title}
          </span>
          {lesson.isFreePreview && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              مجانية
            </span>
          )}
          {lesson.progress?.completed && (
            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
              اتشافت
            </span>
          )}
        </span>

        {lesson.progress && !lesson.progress.completed && lesson.progress.percent > 0 && (
          <span className="mt-1.5 block h-1 w-28 overflow-hidden rounded-full bg-ivory-200">
            <span
              className="block h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${lesson.progress.percent}%` }}
            />
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {lesson.durationSeconds > 0 && (
          <span className="nums-tabular text-xs text-midnight-400">
            {formatDuration(lesson.durationSeconds)}
          </span>
        )}
        {!canOpen && lesson.priceMinor != null && (
          <span className="text-xs font-bold text-[var(--accent)]">
            {formatEgp(lesson.priceMinor)}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li>
      {/* Locked lessons still link through — the lesson page explains why it is
          locked and offers the purchase, which is more useful than a dead row. */}
      <Link
        href={`/lessons/${lesson.id}`}
        className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-ivory-50"
      >
        {content}
      </Link>
    </li>
  );
}
