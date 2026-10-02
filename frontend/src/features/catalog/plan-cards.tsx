'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatEgp, toArabicDigits } from '@/lib/utils';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Order, Plan } from '@/types/api';
import { PaymentMethodDialog, type CheckoutPaymentMethod } from '@/features/checkout/payment-method-dialog';

/**
 * Subscription packages for one grade.
 *
 * The API only ever returns ACTIVE plans, so an empty list means the teacher
 * has not activated pricing yet — which is said plainly rather than hidden.
 */
export function PlanCards({ plans, gradeName }: { plans: Plan[]; gradeName: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (plan: Plan, method: CheckoutPaymentMethod) => {
    if (!plan.productId) return;

    if (!user) {
      // Bounce through login, then come straight back to this grade.
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setPendingId(plan.id);
    setError(null);

    try {
      const order = await api.post<Order>(
        '/checkout',
        { productIds: [plan.productId], method },
        // Prevents a double-tap creating two orders.
        { headers: { 'Idempotency-Key': `${user.id}:${plan.productId}:${Date.now()}` } },
      );

      if (order.redirectUrl) {
        window.location.href = order.redirectUrl;
      } else {
        router.push(`/checkout/return?ref=${order.reference}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'حصل خطأ، حاول تاني بعد شوية',
      );
      setPendingId(null);
    }
  };

  if (!plans.length) {
    return (
      <aside className="h-fit lg:sticky lg:top-28" aria-labelledby="plans-heading">
        <div className="rounded-2xl border border-dashed border-ivory-400 bg-ivory-100 p-7 text-center">
          <h2 id="plans-heading" className="font-display text-lg font-bold text-midnight-700">
            الاشتراكات لسه مش مفعّلة للصف ده
          </h2>
          <p className="mt-2 text-sm text-midnight-500">
            تقدر دلوقتي تشتري الحصص فرادى، والباقات هتظهر هنا أول ما تتفعّل.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      id="plans"
      className="plans-edge-aligned relative h-fit w-full self-start overflow-hidden rounded-3xl border border-[var(--accent)]/35 bg-midnight-950 p-5 shadow-lifted sm:p-7 lg:sticky lg:top-28 lg:-mt-20 xl:-mt-24"
      aria-labelledby="plans-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--hero-wash)' }}
      />

      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -12% 0px' }}
          transition={{ duration: 0.6, ease: EASE_ENTRANCE }}
          className="text-center"
        >
          <h2 id="plans-heading" className="font-display text-2xl font-black text-ivory-50">
            اشترك في {gradeName}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ivory-200/70">
            افتح كل حصص الصف باشتراك واحد، أو اشترِ الحصص اللي محتاجها بس.
          </p>
        </motion.div>

        {error && (
          <p
            role="alert"
            className="mx-auto mt-6 max-w-md rounded-xl bg-red-500/15 px-4 py-3 text-center text-sm text-red-200"
          >
            {error}
          </p>
        )}

        <motion.ul
          variants={staggerContainer(0.1, 0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-7 grid items-stretch gap-4 lg:grid-cols-2"
        >
          {plans.map((plan, index) => {
            const isYearly = plan.kind === 'YEARLY_PLAN';
            return (
              <motion.li
                key={plan.id}
                variants={{
                  hidden: { opacity: 0, y: 28 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: EASE_ENTRANCE },
                  },
                }}
                whileHover={{ y: -6 }}
                className={cn(
                  'relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 sm:p-6',
                  isYearly
                    ? 'border-[var(--accent)] bg-gradient-to-b from-[var(--accent)]/12 to-transparent'
                    : 'border-ivory-50/12 bg-ivory-50/[0.04]',
                )}
              >
                {isYearly && (
                  <span className="absolute left-5 top-5 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-black text-[var(--accent-contrast)]">
                    الأوفر
                  </span>
                )}

                <h3 className="font-display text-xl font-extrabold text-ivory-50">
                  {plan.title}
                </h3>
                {plan.description && (
                  <p className="mt-2 text-sm leading-relaxed text-ivory-200/65">
                    {plan.description}
                  </p>
                )}

                <p className="mt-5 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-black text-ivory-50">
                    {formatEgp(plan.priceMinor)}
                  </span>
                  {plan.durationDays && (
                    <span className="text-sm text-ivory-200/55">
                      / {toArabicDigits(String(plan.durationDays))} يوم
                    </span>
                  )}
                </p>

                {plan.highlights.length > 0 && (
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-start gap-2.5 text-sm text-ivory-200/80"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden
                          className="mt-1 shrink-0 text-[var(--accent)]"
                        >
                          <path
                            d="M2.5 8.5L6 12l7.5-8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  variant={isYearly ? 'accent' : 'outline'}
                  fullWidth
                  className={cn(
                    'mt-6',
                    !isYearly && 'border-ivory-50/25 text-ivory-50 hover:border-[var(--accent)]',
                  )}
                  isLoading={pendingId === plan.id}
                  disabled={!plan.productId}
                  onClick={() => {
                    if (!user) {
                      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
                      return;
                    }
                    setSelectedPlan(plan);
                  }}
                >
                  {plan.productId ? 'اشترك دلوقتي' : 'غير متاح حالياً'}
                </Button>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
      <PaymentMethodDialog
        open={Boolean(selectedPlan)}
        title={selectedPlan?.title ?? ''}
        amountMinor={selectedPlan?.priceMinor ?? 0}
        isPending={Boolean(pendingId)}
        onClose={() => !pendingId && setSelectedPlan(null)}
        onConfirm={(method) => selectedPlan && void buy(selectedPlan, method)}
      />
    </aside>
  );
}
