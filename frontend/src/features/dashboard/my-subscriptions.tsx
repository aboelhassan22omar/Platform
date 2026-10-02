'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import { cn, formatDate, formatEgp, toArabicDigits } from '@/lib/utils';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import type { Order, Subscription } from '@/types/api';

const ORDER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PAID: {
    label: 'مدفوع',
    className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  },
  PENDING: {
    label: 'في الانتظار',
    className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-500/20',
  },
  FAILED: {
    label: 'فشل',
    className: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-500/20',
  },
  CANCELLED: {
    label: 'ملغي',
    className: 'bg-ivory-200 dark:bg-midnight-900 text-midnight-600 dark:text-ivory-300 border border-gold-500/20',
  },
};

export function MySubscriptions() {
  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.get<Subscription[]>('/subscriptions/mine'),
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders-mine'],
    queryFn: () => api.get<Order[]>('/orders/mine'),
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
          اشتراكاتي ومشترياتي
        </h1>
        <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
          سجل الباقات المفعّلة وفواتير الحصص والطلبات الإلكترونية.
        </p>
      </div>

      {/* --- Subscriptions --- */}
      <section aria-labelledby="subs-heading">
        <h2
          id="subs-heading"
          className="font-display text-lg font-extrabold text-midnight-950 dark:text-ivory-50"
        >
          الباقات
        </h2>

        {subsLoading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="skeleton h-44 rounded-2xl" />
            <div className="skeleton h-44 rounded-2xl" />
          </div>
        ) : !subscriptions?.length ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gold-500/30 bg-white dark:bg-midnight-950/80 p-8 text-center transition-colors">
            <p className="font-display text-base font-bold text-midnight-900 dark:text-ivory-100">
              لسه مشتركتش في أي باقة
            </p>
            <p className="mt-1.5 text-sm text-midnight-500 dark:text-ivory-300/70">
              الاشتراك بيفتحلك كل حصص صفك دفعة واحدة مع المتابعة المستمرة.
            </p>
            <ButtonLink href="/grades" variant="accent" size="sm" className="mt-4">
              شوف الباقات المتاحة
            </ButtonLink>
          </div>
        ) : (
          <motion.ul
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="visible"
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            {subscriptions.map((sub) => (
              <motion.li
                key={sub.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.4, ease: EASE_ENTRANCE },
                  },
                }}
                className={cn(
                  'rounded-2xl border p-5 shadow-card transition-colors',
                  sub.isActive
                    ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-midnight-950/80'
                    : 'border-gold-500/25 bg-white dark:bg-midnight-950/80',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-extrabold text-midnight-950 dark:text-ivory-50">
                      {sub.plan.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-midnight-500 dark:text-ivory-300/60">
                      {sub.plan.kind === 'YEARLY_PLAN' ? 'اشتراك سنوي' : 'اشتراك شهري'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold',
                      sub.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-ivory-200 dark:bg-midnight-900 text-midnight-600 dark:text-ivory-300 border border-gold-500/20',
                    )}
                  >
                    {sub.isActive ? 'فعّال' : 'منتهي'}
                  </span>
                </div>

                <dl className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-midnight-500 dark:text-ivory-300/60">بدأ في</dt>
                    <dd className="font-semibold text-midnight-800 dark:text-ivory-200">
                      {formatDate(sub.startsAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-midnight-500 dark:text-ivory-300/60">ينتهي في</dt>
                    <dd className="font-semibold text-midnight-800 dark:text-ivory-200">
                      {formatDate(sub.expiresAt)}
                    </dd>
                  </div>
                  {sub.order && (
                    <div className="flex justify-between">
                      <dt className="text-midnight-500 dark:text-ivory-300/60">رقم الطلب</dt>
                      <dd className="nums-tabular font-semibold text-midnight-800 dark:text-ivory-200">
                        {sub.order.reference}
                      </dd>
                    </div>
                  )}
                </dl>

                {sub.isActive ? (
                  <div className="mt-4 flex items-center justify-between text-[11px]">
                    <span className="text-midnight-500 dark:text-ivory-300/60">المتبقي</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {toArabicDigits(String(sub.daysRemaining))} يوم
                    </span>
                  </div>
                ) : (
                  <ButtonLink
                    href="/grades"
                    variant="accent"
                    size="sm"
                    fullWidth
                    className="mt-4"
                  >
                    جدّد الاشتراك
                  </ButtonLink>
                )}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>

      {/* --- Purchase history --- */}
      {orders && orders.length > 0 && (
        <section aria-labelledby="orders-heading">
          <h2
            id="orders-heading"
            className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
          >
            سجل المشتريات
          </h2>

          <div className="mt-4 overflow-hidden rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 shadow-sm transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-start text-sm">
                <thead className="bg-ivory-100/70 dark:bg-midnight-900/90 text-xs text-midnight-700 dark:text-gold-300 border-b border-gold-500/20">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-bold">رقم الطلب</th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">المحتوى</th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">المبلغ</th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">الحالة</th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200/70 dark:divide-midnight-800">
                  {orders.map((order) => {
                    const status =
                      ORDER_STATUS_LABELS[order.status] ??
                      ORDER_STATUS_LABELS.PENDING;
                    return (
                      <tr key={order.id} className="hover:bg-ivory-50/50 dark:hover:bg-midnight-900/40 transition-colors">
                        <td className="nums-tabular px-4 py-3 font-semibold text-midnight-800 dark:text-ivory-200">
                          {order.reference}
                        </td>
                        <td className="px-4 py-3 text-midnight-700 dark:text-ivory-200">
                          {order.items.map((item) => item.title).join('، ')}
                        </td>
                        <td className="px-4 py-3 font-bold text-midnight-950 dark:text-ivory-50">
                          {formatEgp(order.totalMinor)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-bold',
                              status.className,
                            )}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-midnight-500 dark:text-ivory-300/70">
                          {formatDate(order.paidAt ?? order.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
