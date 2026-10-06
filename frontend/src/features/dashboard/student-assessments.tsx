'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { AssessmentKind, StudentAssessment } from '@/types/api';
import { useMutation } from '@tanstack/react-query';
import {
  PaymentMethodDialog,
  type CheckoutPaymentMethod,
} from '@/features/checkout/payment-method-dialog';
import { useState } from 'react';

const labels: Record<AssessmentKind, string> = {
  HOMEWORK: 'واجب',
  LESSON_EXAM: 'اختبار درس',
  UNIT_EXAM: 'امتحان شامل',
};

function BookCheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M9 9l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StudentAssessments() {
  const [buying, setBuying] = useState<StudentAssessment | null>(null);
  const query = useQuery({
    queryKey: ['student-assessments'],
    queryFn: () => api.get<StudentAssessment[]>('/assessments'),
  });
  const items = query.data ?? [];
  const checkout = useMutation({
    mutationFn: ({ productId, method }: { productId: string; method: CheckoutPaymentMethod }) =>
      api.post<{ redirectUrl: string | null }>(
        '/checkout',
        { productIds: [productId], method },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      ),
    onSuccess: (order) => {
      if (order.redirectUrl) window.location.assign(order.redirectUrl);
    },
  });
  const pending = items.filter((item) => !item.latestAttempt && !item.isOverdue).length;
  const completed = items.filter((item) => item.latestAttempt).length;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
          مساحة التدريب
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
          الواجبات والامتحانات
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
          حل واجب كل درس واختباره، واستعد للامتحان الشامل بعد نهاية كل وحدة.
        </p>
      </header>

      <section aria-label="ملخص التقييمات" className="grid gap-3 sm:grid-cols-3">
        {[
          ['مطلوب منك', pending, 'text-amber-700 dark:text-amber-300'],
          ['تم الحل', completed, 'text-emerald-700 dark:text-emerald-300'],
          ['كل التقييمات', items.length, 'text-gold-700 dark:text-gold-300'],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-gold-500/20 bg-white p-5 shadow-card dark:bg-midnight-950/75"
          >
            <p className="text-sm font-bold text-midnight-500 dark:text-ivory-300/65">{label}</p>
            <p className={cn('mt-2 text-3xl font-black', String(color))}>
              {formatNumber(Number(value))}
            </p>
          </div>
        ))}
      </section>

      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/25 bg-red-50 p-5 text-sm font-bold text-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          تعذر تحميل التقييمات. حاول تحديث الصفحة.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gold-500/30 bg-white/70 px-6 py-14 text-center dark:bg-midnight-950/60">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-500/10 text-gold-700 dark:text-gold-300">
            <BookCheckIcon />
          </span>
          <h2 className="mt-4 font-display text-xl font-black">لا توجد واجبات مطلوبة حاليًا</h2>
          <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/65">
            أي واجب أو امتحان جديد لصفك سيظهر هنا مباشرة.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const scope = item.lesson
              ? `${item.lesson.courseTitle} · ${item.lesson.unitTitle} · ${item.lesson.title}`
              : `${item.unit?.courseTitle} · ${item.unit?.title}`;
            const exhausted = item.attemptCount >= item.maxAttempts;
            return (
              <article
                key={item.id}
                className="flex flex-col rounded-2xl border border-gold-500/20 bg-white p-5 shadow-card dark:bg-midnight-950/75"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-black',
                        item.kind === 'HOMEWORK'
                          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                          : item.kind === 'UNIT_EXAM'
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
                            : 'bg-gold-500/10 text-gold-700 dark:text-gold-300',
                      )}
                    >
                      {labels[item.kind]}
                    </span>
                    <h2 className="mt-3 font-display text-xl font-black text-midnight-950 dark:text-ivory-50">
                      {item.title}
                    </h2>
                  </div>
                  {item.latestAttempt && (
                    <span
                      className={cn(
                        'shrink-0 rounded-xl px-3 py-2 text-sm font-black',
                        item.latestAttempt.passed
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 text-red-700 dark:text-red-300',
                      )}
                    >
                      {formatNumber(item.latestAttempt.percentage)}%
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs font-bold text-midnight-500 dark:text-ivory-300/60">
                  {scope}
                </p>
                {item.description && (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-midnight-600 dark:text-ivory-300/75">
                    {item.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-midnight-500 dark:text-ivory-300/65">
                  <span>{formatNumber(item.questionCount)} سؤال</span>
                  <span>
                    {item.timeLimitMinutes
                      ? `${formatNumber(item.timeLimitMinutes)} دقيقة`
                      : 'بدون وقت محدد'}
                  </span>
                  <span>
                    {formatNumber(item.attemptCount)} من {formatNumber(item.maxAttempts)} محاولة
                  </span>
                  {item.dueAt && (
                    <span className={item.isOverdue ? 'text-red-600 dark:text-red-300' : ''}>
                      التسليم:{' '}
                      {new Intl.DateTimeFormat('ar-EG', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.dueAt))}
                    </span>
                  )}
                </div>
                <div className="mt-auto pt-5">
                  {!item.isFree && item.productId ? (
                    <button
                      type="button"
                      onClick={() => setBuying(item)}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gold-500 px-4 text-sm font-black text-midnight-950 hover:bg-gold-400"
                    >
                      شراء الامتحان — {formatNumber((item.priceMinor ?? 0) / 100)} ج.م
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/assessments/${item.id}`}
                      aria-disabled={item.isOverdue}
                      className={cn(
                        'flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
                        item.isOverdue
                          ? 'pointer-events-none bg-midnight-100 text-midnight-400 dark:bg-white/5 dark:text-ivory-300/35'
                          : 'bg-gold-500 text-midnight-950 hover:bg-gold-400',
                      )}
                    >
                      {item.isOverdue
                        ? 'انتهى موعد التسليم'
                        : item.latestAttempt
                          ? 'عرض النتيجة'
                          : exhausted
                            ? 'انتهت المحاولات'
                            : 'ابدأ الحل'}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <PaymentMethodDialog
        open={Boolean(buying)}
        title={buying?.title ?? ''}
        amountMinor={buying?.priceMinor ?? 0}
        isPending={checkout.isPending}
        onClose={() => setBuying(null)}
        onConfirm={(method) =>
          buying?.productId && checkout.mutate({ productId: buying.productId, method })
        }
      />
    </div>
  );
}
