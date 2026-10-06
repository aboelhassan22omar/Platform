'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api';
import { cn, formatEgp, formatNumber, toArabicDigits } from '@/lib/utils';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import type { AdminPlan } from '@/types/api';

export function AdminPricing() {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState<string>('');
  const [toggleTarget, setToggleTarget] = useState<AdminPlan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get<AdminPlan[]>('/admin/pricing/plans'),
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { priceMinor?: number; isActive?: boolean } }) =>
      api.patch<AdminPlan>(`/admin/pricing/plans/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      setEditing(null);
      setToggleTarget(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  // Group by grade so the five levels read as five sections.
  const byGrade = new Map<string, AdminPlan[]>();
  for (const plan of plans ?? []) {
    const list = byGrade.get(plan.grade.nameAr) ?? [];
    list.push(plan);
    byGrade.set(plan.grade.nameAr, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
          إدارة الأسعار والاشتراكات
        </h1>
        <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
          الباقات بتتنشأ غير مفعّلة تلقائياً. حدّد السعر المناسب ثم اضغط تفعيل لتظهر للطلاب في
          المتجر.
        </p>
      </div>

      {[...byGrade.entries()].map(([gradeName, gradePlans]) => (
        <section key={gradeName} aria-labelledby={`grade-${gradeName}`}>
          <h2
            id={`grade-${gradeName}`}
            className="font-display text-base font-extrabold text-midnight-900 dark:text-ivory-100 flex items-center gap-2"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden />
            {gradeName}
          </h2>

          <motion.ul
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="visible"
            className="mt-3 grid gap-3 lg:grid-cols-2"
          >
            {gradePlans.map((plan) => (
              <motion.li
                key={plan.id}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.35, ease: EASE_ENTRANCE },
                  },
                }}
                className={cn(
                  'rounded-2xl border bg-white dark:bg-midnight-950/80 p-5 shadow-card transition-colors',
                  plan.isActive
                    ? 'border-emerald-500/50 dark:border-emerald-500/40'
                    : 'border-gold-500/25',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-extrabold text-midnight-950 dark:text-ivory-50">
                      {plan.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-midnight-500 dark:text-ivory-300/60">
                      {plan.kind === 'YEARLY_PLAN' ? 'سنوي' : 'شهري'}
                      {plan.durationDays && ` · ${toArabicDigits(String(plan.durationDays))} يوم`}
                      {' · '}
                      {plan.academicYear.label}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold',
                      plan.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-ivory-200/80 dark:bg-midnight-900 text-midnight-600 dark:text-ivory-300 border border-gold-500/20',
                    )}
                  >
                    {plan.isActive ? 'مفعّلة' : 'غير مفعّلة'}
                  </span>
                </div>

                {/* Price, inline-editable */}
                <div className="mt-4">
                  {editing === plan.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const pounds = Number(draftPrice);
                        if (!Number.isFinite(pounds) || pounds < 0) return;
                        updatePlan.mutate({
                          id: plan.id,
                          body: { priceMinor: Math.round(pounds * 100) },
                        });
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draftPrice}
                        onChange={(event) => setDraftPrice(event.target.value)}
                        aria-label="السعر بالجنيه"
                        dir="ltr"
                        className="min-h-10 w-32 rounded-lg border-2 border-gold-500 bg-white dark:bg-midnight-900 px-3 text-sm text-midnight-900 dark:text-ivory-50 focus:outline-none"
                        autoFocus
                      />
                      <span className="text-xs text-midnight-500 dark:text-ivory-300/70">ج.م</span>
                      <Button
                        type="submit"
                        variant="accent"
                        size="sm"
                        isLoading={updatePlan.isPending}
                      >
                        احفظ
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(null)}
                      >
                        إلغاء
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
                        {formatEgp(plan.priceMinor)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(plan.id);
                          setDraftPrice(String(plan.priceMinor / 100));
                        }}
                        className="rounded-lg px-2.5 py-1 text-xs font-bold text-gold-700 dark:text-gold-400 transition-colors hover:bg-gold-500/10"
                      >
                        عدّل السعر
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gold-500/20 pt-3">
                  <span className="text-[11px] text-midnight-500 dark:text-ivory-300/60">
                    {formatNumber(plan._count.subscriptions)} اشتراك
                  </span>

                  <Button
                    variant={plan.isActive ? 'outline' : 'accent'}
                    size="sm"
                    onClick={() => setToggleTarget(plan)}
                  >
                    {plan.isActive ? 'إيقاف الباقة' : 'تفعيل الباقة'}
                  </Button>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      ))}

      <ConfirmDialog
        open={toggleTarget !== null}
        title={toggleTarget?.isActive ? 'إيقاف الباقة؟' : 'تفعيل الباقة؟'}
        body={
          toggleTarget?.isActive
            ? `هتختفي "${toggleTarget.title}" من صفحات الأسعار ومش هيقدر حد يشتريها. الاشتراكات القائمة هتفضل شغالة لحد ما تنتهي.`
            : `هتظهر "${toggleTarget?.title}" للطلاب بسعر ${formatEgp(toggleTarget?.priceMinor ?? 0)} ويقدروا يشتروها فوراً. اتأكد إن السعر صح.`
        }
        confirmLabel={toggleTarget?.isActive ? 'إيقاف' : 'تفعيل'}
        destructive={toggleTarget?.isActive}
        isPending={updatePlan.isPending}
        onCancel={() => setToggleTarget(null)}
        onConfirm={() => {
          if (!toggleTarget) return;
          updatePlan.mutate({
            id: toggleTarget.id,
            body: { isActive: !toggleTarget.isActive },
          });
        }}
      />
    </div>
  );
}
