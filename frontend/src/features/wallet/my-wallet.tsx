'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  PaymentMethodDialog,
  type CheckoutPaymentMethod,
} from '@/features/checkout/payment-method-dialog';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatEgp, toArabicDigits } from '@/lib/utils';
import { EASE_ENTRANCE } from '@/lib/motion';
import type { Order, WalletTransaction } from '@/types/api';
import { useWallet } from './use-wallet';

const PRESETS = [50, 100, 200, 500];
const MIN_POUNDS = 10;
const MAX_POUNDS = 10_000;

const TYPE_LABELS: Record<WalletTransaction['type'], string> = {
  TOPUP: 'شحن رصيد',
  PURCHASE: 'شراء',
  ADMIN_CREDIT: 'إضافة من الإدارة',
  ADMIN_DEBIT: 'خصم من الإدارة',
};

/**
 * The student's balance: top up once by transfer, then buy any lesson,
 * chapter, plan or exam in one tap without sending a transfer each time.
 */
export function MyWallet() {
  const { user } = useAuth();
  const router = useRouter();
  const requested = Number.parseInt(useSearchParams().get('amount') ?? '', 10);
  const [pounds, setPounds] = useState(
    Number.isFinite(requested) && requested > 0
      ? String(Math.min(MAX_POUNDS, Math.max(MIN_POUNDS, requested)))
      : '100',
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wallet = useWallet();

  const amount = Number.parseInt(pounds, 10);
  const amountValid = Number.isFinite(amount) && amount >= MIN_POUNDS && amount <= MAX_POUNDS;

  const topUp = async (method: CheckoutPaymentMethod) => {
    if (!user || !amountValid) return;
    setIsPending(true);
    setError(null);
    try {
      const order = await api.post<Order>(
        '/wallet/topups',
        { amountMinor: amount * 100, method },
        { headers: { 'Idempotency-Key': `${user.id}:topup:${Date.now()}` } },
      );
      if (order.redirectUrl && !order.redirectUrl.includes('/checkout/return')) {
        window.location.href = order.redirectUrl;
      } else {
        router.push(`/checkout/return?ref=${encodeURIComponent(order.reference)}`);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'حصل خطأ، حاول تاني');
      setIsPending(false);
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
          محفظتي
        </h1>
        <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
          اشحن مرة واحدة، واشتري أي حصة أو باقة بضغطة من غير ما تحوّل كل مرة.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* --- Balance --- */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_ENTRANCE }}
          aria-label="رصيدك"
          className="relative overflow-hidden rounded-2xl border border-gold-500/40 bg-gradient-to-br from-midnight-900 via-midnight-950 to-black p-6 text-ivory-50 shadow-card"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20 blur-2xl"
          />
          <p className="text-xs font-black tracking-wide text-gold-300">رصيدك الحالي</p>
          {wallet.isLoading ? (
            <div className="skeleton mt-3 h-12 w-40 rounded-xl" />
          ) : (
            <p className="mt-2 font-display text-4xl font-black text-gold-200">
              {formatEgp(wallet.data?.balanceMinor ?? 0)}
            </p>
          )}
          <ul className="mt-6 space-y-1.5 text-xs leading-6 text-ivory-200/80">
            <li>• الرصيد مش بيخلص ولا بينتهي</li>
            <li>• بتختار «ادفع من رصيدك» وإنت بتشتري، والحصة بتتفتح فورًا</li>
          </ul>
        </motion.section>

        {/* --- Top up --- */}
        <section
          aria-labelledby="topup-heading"
          className="rounded-2xl border border-gold-500/25 bg-white p-5 shadow-card dark:bg-midnight-950/80 sm:p-6"
        >
          <h2
            id="topup-heading"
            className="font-display text-lg font-extrabold text-midnight-950 dark:text-ivory-50"
          >
            اشحن رصيدك
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPounds(String(preset))}
                aria-pressed={amount === preset}
                className={cn(
                  'min-h-11 rounded-xl border-2 px-4 font-display text-base font-black transition-colors',
                  amount === preset
                    ? 'border-gold-500 bg-gold-500/15 text-gold-800 dark:text-gold-200'
                    : 'border-gold-500/20 text-midnight-700 hover:border-gold-500/60 dark:text-ivory-200',
                )}
              >
                {toArabicDigits(preset)} ج
              </button>
            ))}
          </div>
          <label className="mt-4 block max-w-xs">
            <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
              أو اكتب المبلغ بالجنيه
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_POUNDS}
              max={MAX_POUNDS}
              value={pounds}
              onChange={(event) => setPounds(event.target.value)}
              className="input-base text-lg font-bold"
              aria-invalid={!amountValid}
            />
          </label>
          {!amountValid && (
            <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
              المبلغ لازم يكون بين {toArabicDigits(MIN_POUNDS)} و{' '}
              {toArabicDigits(MAX_POUNDS.toLocaleString('en-US'))} جنيه
            </p>
          )}
          <Button
            type="button"
            variant="accent"
            size="lg"
            className="mt-5"
            disabled={!amountValid || isPending}
            onClick={() => setDialogOpen(true)}
          >
            اشحن {amountValid ? formatEgp(amount * 100) : ''}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </section>
      </div>

      {/* --- Statement --- */}
      <section aria-labelledby="statement-heading">
        <h2
          id="statement-heading"
          className="font-display text-lg font-extrabold text-midnight-950 dark:text-ivory-50"
        >
          كشف الحساب
        </h2>
        {wallet.isLoading ? (
          <div className="mt-4 space-y-2">
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
          </div>
        ) : !wallet.data?.transactions.length ? (
          <p className="mt-4 rounded-2xl border border-dashed border-gold-500/30 bg-white p-8 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
            لسه مفيش حركات على محفظتك. أول ما تشحن هتلاقيها هنا.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gold-500/15 overflow-hidden rounded-2xl border border-gold-500/20 bg-white dark:bg-midnight-950/80">
            {wallet.data.transactions.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-midnight-900 dark:text-ivory-100">
                    {TYPE_LABELS[row.type]}
                    {row.items.length > 0 && (
                      <span className="font-normal text-midnight-600 dark:text-ivory-300/75">
                        {' '}
                        — {row.items.join('، ')}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-midnight-500 dark:text-ivory-300/60">
                    {formatDate(row.createdAt)}
                    {row.note ? ` · ${row.note}` : ''}
                    {row.orderReference ? ` · طلب ${row.orderReference}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p
                    dir="ltr"
                    className={cn(
                      'font-display text-base font-black',
                      row.amountMinor > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-midnight-800 dark:text-ivory-200',
                    )}
                  >
                    {row.amountMinor > 0 ? '+' : '−'}
                    {formatEgp(Math.abs(row.amountMinor))}
                  </p>
                  <p className="text-[11px] text-midnight-500 dark:text-ivory-300/60">
                    الرصيد {formatEgp(row.balanceAfterMinor)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PaymentMethodDialog
        open={dialogOpen}
        title="شحن رصيد المحفظة"
        amountMinor={amountValid ? amount * 100 : 0}
        isPending={isPending}
        allowBalance={false}
        heading="هتشحن إزاي؟"
        transferNote="بعد التحويل ابعتلنا صورة التحويل على واتساب، والرصيد هيتضاف أول ما نأكد وصول المبلغ."
        onClose={() => !isPending && setDialogOpen(false)}
        onConfirm={(method) => void topUp(method)}
      />
    </div>
  );
}
