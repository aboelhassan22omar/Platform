'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { formatEgp } from '@/lib/utils';
import { EASE_ENTRANCE } from '@/lib/motion';

/**
 * Development-only payment simulation.
 *
 * Confirming here calls the backend's sandbox endpoint, which builds a signed
 * payload and pushes it through the SAME settlement path a real provider
 * webhook would take. The purchase journey being tested is therefore the
 * production one, not a shortcut that grants access directly.
 */
export function SandboxCheckout() {
  const params = useSearchParams();
  const router = useRouter();

  const reference = params.get('ref') ?? '';
  const providerRef = params.get('providerRef') ?? '';
  const amountMinor = Number(params.get('amount') ?? 0);
  const paymentMethod = params.get('method') === 'WALLET' ? 'محفظة إلكترونية' : 'إنستا باي';

  const [isPending, setIsPending] = useState<'success' | 'fail' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settle = async (success: boolean) => {
    setIsPending(success ? 'success' : 'fail');
    setError(null);

    try {
      await api.post('/payments/sandbox/confirm', { reference, providerRef, success });
      router.push(`/checkout/return?ref=${encodeURIComponent(reference)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حصل خطأ في المحاكاة');
      setIsPending(null);
    }
  };

  if (!reference || !providerRef) {
    return (
      <div className="container-page py-20 text-center">
        <p className="font-display text-lg font-bold text-midnight-800">
          بيانات الطلب ناقصة
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-ivory-100 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_ENTRANCE }}
        className="container-page max-w-md"
      >
        {/* Unmissable development banner. */}
        <div className="rounded-t-2xl border-2 border-b-0 border-amber-400 bg-amber-100 px-5 py-4 text-center">
          <p className="font-display text-sm font-black text-amber-900">
            ⚠️ وضع التطوير — محاكاة دفع
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            دي مش بوابة دفع حقيقية. مفيش أي مبلغ بيتخصم، ومفيش أي بيانات بنكية
            بتتسجّل. الصفحة دي موجودة عشان اختبار المنصة قبل تفعيل الدفع الحقيقي.
          </p>
        </div>

        <div className="rounded-b-2xl border-2 border-amber-400 bg-white p-6 sm:p-7">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-midnight-400">رقم الطلب</dt>
              <dd className="nums-tabular font-bold text-midnight-800">{reference}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-ivory-200 pt-3">
              <dt className="text-midnight-400">المبلغ</dt>
              <dd className="font-display text-xl font-black text-midnight-900">
                {formatEgp(amountMinor)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-ivory-200 pt-3">
              <dt className="text-midnight-400">طريقة الدفع</dt>
              <dd className="font-bold text-midnight-800">{paymentMethod}</dd>
            </div>
          </dl>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            >
              {error}
            </p>
          )}

          <div className="mt-6 space-y-2.5">
            <Button
              variant="accent"
              size="lg"
              fullWidth
              isLoading={isPending === 'success'}
              disabled={isPending !== null}
              onClick={() => void settle(true)}
            >
              محاكاة دفع ناجح
            </Button>
            <Button
              variant="outline"
              fullWidth
              isLoading={isPending === 'fail'}
              disabled={isPending !== null}
              onClick={() => void settle(false)}
            >
              محاكاة دفع فاشل
            </Button>
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-midnight-400">
            لتفعيل الدفع الحقيقي، اضبط <code className="font-mono">PAYMENT_PROVIDER=paymob</code>{' '}
            مع بيانات التاجر. راجع <code className="font-mono">docs/deployment/payments.md</code>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
