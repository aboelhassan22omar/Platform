'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { formatEgp } from '@/lib/utils';

/** CARD is the provider channel currently reserved for the InstaPay option. */
export type CheckoutPaymentMethod = 'WALLET' | 'CARD';

export function PaymentMethodDialog({ open, title, amountMinor, isPending, onClose, onConfirm }: {
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
      <button type="button" aria-label="إغلاق طرق الدفع" className="absolute inset-0 bg-midnight-950/70 backdrop-blur-sm" onClick={() => !isPending && onClose()} />
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} role="dialog" aria-modal="true" aria-labelledby="payment-method-title" className="relative w-full max-w-md rounded-2xl border border-gold-500/30 bg-white p-5 shadow-2xl dark:bg-midnight-950 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black text-gold-700 dark:text-gold-300">إتمام الشراء بأمان</p><h2 id="payment-method-title" className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50">اختار طريقة الدفع المناسبة</h2></div>
          <button type="button" onClick={onClose} disabled={isPending} aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-xl text-xl text-midnight-500 hover:bg-midnight-50 disabled:opacity-50 dark:text-ivory-300 dark:hover:bg-midnight-800">×</button>
        </div>
        <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4 py-3"><p className="truncate text-sm font-bold text-midnight-800 dark:text-ivory-200">{title}</p><p className="mt-1 font-display text-xl font-black text-gold-700 dark:text-gold-300">{formatEgp(amountMinor)}</p></div>
        <div className="mt-5 space-y-3">
          <button type="button" disabled={isPending} onClick={() => onConfirm('WALLET')} className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-gold-500/30 px-4 text-start transition-colors hover:border-gold-500 hover:bg-gold-500/5 disabled:opacity-50">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-300"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M4 7.5h16v12H4zM6 7.5V5h11v2.5M16 13.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black text-midnight-900 dark:text-ivory-50">المحافظ الإلكترونية</span><span className="mt-0.5 block text-xs leading-5 text-midnight-500 dark:text-ivory-300/70">فودافون كاش، أورنج كاش، اتصالات كاش أو WE Pay</span></span>
          </button>
          <button type="button" disabled={isPending} onClick={() => onConfirm('CARD')} className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-midnight-100 px-4 text-start transition-colors hover:border-gold-500 hover:bg-gold-500/5 disabled:opacity-50 dark:border-midnight-800">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 7h10M7 12h7M7 17h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /><path d="m14.5 9.5 2.5 2.5-2.5 2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black text-midnight-900 dark:text-ivory-50">إنستا باي</span><span className="mt-0.5 block text-xs leading-5 text-midnight-500 dark:text-ivory-300/70">تحويل سريع وآمن من تطبيق InstaPay</span></span>
          </button>
        </div>
        {isPending && <div role="status" className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-gold-700 dark:text-gold-300"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />جاري تجهيز عملية الدفع…</div>}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-midnight-400 dark:text-ivory-300/60">لن يُفتح المحتوى إلا بعد وصول تأكيد الدفع رسميًا.</p>
        <Button type="button" variant="ghost" fullWidth className="mt-2" disabled={isPending} onClick={onClose}>رجوع</Button>
      </motion.div>
    </div>
  );
}
