'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ButtonLink } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatEgp } from '@/lib/utils';
import { EASE_ENTRANCE } from '@/lib/motion';
import type { Order } from '@/types/api';
import { TransferForm } from './transfer-form';

/**
 * Landing page after returning from the payment provider.
 *
 * Critically, this page does NOT grant anything. It polls the order until the
 * webhook has been processed server-side. If the webhook has not arrived yet,
 * the student is told the payment is still being confirmed rather than being
 * shown a success screen the backend has not agreed with.
 */
export function CheckoutReturn() {
  const reference = useSearchParams().get('ref') ?? '';

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', reference],
    queryFn: () => api.get<Order>(`/orders/${reference}`),
    enabled: Boolean(reference),
    // Webhooks usually land within a second or two, but retries can take
    // longer; poll briefly rather than claiming failure too early.
    refetchInterval: (query) =>
      query.state.data?.status === 'PAID' || query.state.data?.status === 'FAILED' ? false : 2000,
  });

  if (!reference) {
    return (
      <Shell>
        <p className="font-display text-lg font-bold text-midnight-800">مفيش رقم طلب</p>
      </Shell>
    );
  }

  if (isLoading || !order) {
    return (
      <Shell>
        <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold-500 border-t-transparent" />
        <p className="mt-4 text-sm text-midnight-500">بنجيب تفاصيل طلبك...</p>
      </Shell>
    );
  }

  // ---- Paid -------------------------------------------------------------
  if (order.status === 'PAID') {
    return (
      <Shell>
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          aria-hidden
          className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600"
        >
          <motion.svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <motion.path
              d="M9 19.5L16 26.5L29 12"
              stroke="currentColor"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.25, duration: 0.5, ease: 'easeOut' }}
            />
          </motion.svg>
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE_ENTRANCE }}
          className="mt-6 font-display text-2xl font-black text-midnight-900"
        >
          تم الدفع بنجاح 🎉
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-2 max-w-sm text-sm leading-relaxed text-midnight-500"
        >
          حصصك اتفتحت وجاهزة دلوقتي. تقدر تبدأ تذاكر على طول.
        </motion.p>

        <OrderSummary order={order} />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-7 flex flex-col gap-2.5 sm:flex-row"
        >
          <ButtonLink href="/dashboard/lessons" variant="accent" size="lg">
            روح لحصصي
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="outline" size="lg">
            ملفي الشخصي
          </ButtonLink>
        </motion.div>
      </Shell>
    );
  }

  // ---- Failed -----------------------------------------------------------
  if (order.status === 'FAILED' || order.status === 'CANCELLED') {
    return (
      <Shell>
        <span
          aria-hidden
          className="grid h-20 w-20 place-items-center rounded-full bg-red-100 text-red-600"
        >
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor">
            <path d="M11 11l12 12M23 11L11 23" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className="mt-6 font-display text-2xl font-black text-midnight-900">الدفع ما تمّش</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-midnight-500">
          معملناش أي خصم. تقدر تجرب تاني، ولو المشكلة اتكررت كلّم الدعم.
        </p>
        <OrderSummary order={order} />
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <ButtonLink href="/grades" variant="accent" size="lg">
            جرّب تاني
          </ButtonLink>
          <ButtonLink href="/contact" variant="outline" size="lg">
            تواصل مع الدعم
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  // ---- Still pending ----------------------------------------------------
  if (order.payment.transfer) {
    return (
      <Shell>
        <TransferForm order={order} />
        <OrderSummary order={order} />
      </Shell>
    );
  }
  return (
    <Shell>
      <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-gold-500 border-t-transparent" />
      <h1 className="mt-6 font-display text-xl font-black text-midnight-900">بنأكد عملية الدفع</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-midnight-500">
        استنى ثواني، بنستنى تأكيد من بوابة الدفع. متقفلش الصفحة.
      </p>
      <OrderSummary order={order} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-ivory-100 py-14">
      <div className="container-page flex max-w-lg flex-col items-center text-center">
        {children}
      </div>
    </div>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="mt-7 w-full rounded-2xl border border-ivory-300 bg-white p-5 text-start">
      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-midnight-400">رقم الطلب</dt>
          <dd className="nums-tabular font-bold text-midnight-800">{order.reference}</dd>
        </div>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-4">
            <dt className="text-midnight-500">{item.title}</dt>
            <dd className="shrink-0 font-semibold text-midnight-700">
              {formatEgp(item.totalMinor)}
            </dd>
          </div>
        ))}
        {order.discountMinor > 0 && (
          <div className="flex justify-between text-emerald-700">
            <dt>الخصم</dt>
            <dd className="font-semibold">−{formatEgp(order.discountMinor)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-ivory-200 pt-2.5">
          <dt className="font-bold text-midnight-700">الإجمالي</dt>
          <dd className="font-display text-lg font-black text-midnight-900">
            {formatEgp(order.totalMinor)}
          </dd>
        </div>
      </dl>

      {order.payment.isSandbox && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          {order.payment.notice ?? 'وضع تجريبي: لم تتم أي عملية دفع حقيقية.'}
        </p>
      )}
    </div>
  );
}
