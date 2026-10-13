'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { formatEgp } from '@/lib/utils';

/** CARD is the provider channel currently reserved for the InstaPay option. */
export type CheckoutPaymentMethod = 'WALLET' | 'CARD';

export function PaymentMethodDialog({
  open,
  title,
  amountMinor,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  amountMinor: number;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (method: CheckoutPaymentMethod) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center p-4">
      <button
        type="button"
        aria-label="إغلاق طرق الدفع"
        className="absolute inset-0 bg-midnight-950/70 backdrop-blur-sm"
        onClick={() => !isPending && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-method-title"
        className="relative w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-[var(--accent)]">إتمام الشراء بأمان</p>
            <h2
              id="payment-method-title"
              className="font-display text-xl font-black text-[var(--text-primary)]"
            >
              اختار طريقة الدفع المناسبة
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="إغلاق"
            className="grid h-10 w-10 place-items-center rounded-xl text-xl text-[var(--text-muted)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
          >
            ×
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-3">
          <p className="truncate text-sm font-bold text-[var(--text-secondary)]">{title}</p>
          <p className="mt-1 font-display text-xl font-black text-[var(--accent)]">
            {formatEgp(amountMinor)}
          </p>
        </div>
        <div className="mt-5 space-y-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm('WALLET')}
            className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-[var(--border-subtle)] px-4 text-start transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-50"
          >
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7.5h16v12H4zM6 7.5V5h11v2.5M16 13.5h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-[var(--text-primary)]">
                فودافون كاش
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
                حوّل من فودافون كاش أو أي محفظة إلكترونية
              </span>
            </span>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm('CARD')}
            className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-[var(--border-subtle)] px-4 text-start transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-50"
          >
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 7h10M7 12h7M7 17h10"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="m14.5 9.5 2.5 2.5-2.5 2.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-[var(--text-primary)]">إنستا باي</span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
                تحويل سريع من تطبيق InstaPay أو أي تطبيق بنك
              </span>
            </span>
          </button>
        </div>
        {isPending && (
          <div
            role="status"
            className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[var(--accent)]"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            جاري تجهيز عملية الدفع…
          </div>
        )}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
          بعد التحويل هتبعت صورة الإثبات، والمحتوى هيتفتح أول ما نأكد وصول المبلغ.
        </p>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          className="mt-2"
          disabled={isPending}
          onClick={onClose}
        >
          رجوع
        </Button>
      </motion.div>
    </div>
  );
}
