'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatEgp, formatNumber, toArabicDigits } from '@/lib/utils';
import type { Paginated } from '@/types/api';
import { PendingTransfers } from './admin-transfers';

interface PaymentRow {
  id: string;
  reference: string;
  totalMinor: number;
  discountMinor: number;
  paidAt: string;
  user: { fullName: string; username: string; phone: string };
  items: Array<{ titleSnapshot: string; kindSnapshot: string }>;
  provider: string | null;
  method: string | null;
  purpose: 'PURCHASE' | 'WALLET_TOPUP';
  paidFromWallet: boolean;
}

/** A top-up has no items; show it as one line. */
const linesOf = (row: PaymentRow) =>
  row.purpose === 'WALLET_TOPUP'
    ? [{ titleSnapshot: 'شحن رصيد المحفظة', kindSnapshot: 'WALLET_TOPUP' }]
    : row.items;

const KIND_LABELS: Record<string, string> = {
  LESSON: 'حصة',
  CHAPTER_BUNDLE: 'فصل كامل',
  COURSE: 'كورس',
  MONTHLY_PLAN: 'اشتراك شهري',
  YEARLY_PLAN: 'اشتراك سنوي',
  ASSESSMENT: 'امتحان',
  WALLET_TOPUP: 'محفظة',
};

function methodLabel(row: PaymentRow): string {
  if (row.totalMinor === 0) return 'مجاني بكوبون';
  // Spending money already counted at top-up, so not part of the total above.
  if (row.paidFromWallet) return 'من رصيد المحفظة';
  if (row.provider === 'DEV_SANDBOX') return 'تجريبي';
  if (row.provider === 'MANUAL') return 'تحويل يدوي';
  if (row.method === 'WALLET') return 'محفظة إلكترونية';
  if (row.method === 'KIOSK') return 'فوري';
  return row.provider === 'KASHIER' ? 'إنستا باي' : 'كارت';
}

const formatPaidAt = (value: string) =>
  new Date(value).toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** Who paid, how much, for what — read-only, newest first. */
export function AdminPayments() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (search.trim()) params.set('search', search.trim());

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-payments', params.toString()],
    queryFn: () =>
      api.get<Paginated<PaymentRow> & { totalPaidMinor: number }>(`/admin/payments?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
            سجل المدفوعات
          </h1>
          <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
            كل عملية دفع اتأكدت: مين دفع، دفع كام، وعلى إيه.
          </p>
        </div>
        {data && (
          <dl className="flex gap-3">
            <div className="rounded-xl border border-gold-500/25 bg-white px-4 py-2.5 dark:bg-midnight-950/80">
              <dt className="text-[11px] font-bold text-midnight-500 dark:text-ivory-300/60">
                {search.trim() ? 'عمليات مطابقة' : 'عدد العمليات'}
              </dt>
              <dd className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
                {formatNumber(data.total)}
              </dd>
            </div>
            <div className="rounded-xl border border-gold-500/25 bg-white px-4 py-2.5 dark:bg-midnight-950/80">
              <dt className="text-[11px] font-bold text-midnight-500 dark:text-ivory-300/60">
                الإجمالي
              </dt>
              <dd className="font-display text-lg font-black text-gold-700 dark:text-gold-300">
                {formatEgp(data.totalPaidMinor)}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <PendingTransfers />

      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="ابحث باسم الطالب، الموبايل، اسم الحصة، أو رقم الطلب"
        aria-label="بحث في سجل المدفوعات"
        className="min-h-11 w-full rounded-xl border-2 border-ivory-300 bg-white px-4 py-2.5 text-sm text-midnight-900 transition-colors placeholder:text-midnight-400 focus:border-gold-500 focus:outline-none dark:border-midnight-700 dark:bg-midnight-900/90 dark:text-ivory-50 dark:placeholder:text-midnight-500 sm:max-w-md"
      />

      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-gold-500/25 bg-white shadow-sm transition-all dark:bg-midnight-950/80',
          isFetching && !isLoading && 'opacity-60',
        )}
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="p-8 text-center text-sm text-red-600 dark:text-red-300">
            {error.message}
          </p>
        ) : !data?.items.length ? (
          <div className="p-12 text-center">
            <p className="font-display text-base font-bold text-midnight-700 dark:text-ivory-200">
              {search.trim() ? 'مفيش عمليات مطابقة' : 'لسه مفيش مدفوعات'}
            </p>
            <p className="mt-1.5 text-sm text-midnight-500 dark:text-ivory-300/60">
              {search.trim()
                ? 'جرّب كلمة بحث تانية.'
                : 'أول ما طالب يدفع، العملية هتظهر هنا تلقائيًا.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-ivory-200 sm:hidden dark:divide-midnight-800">
              {data.items.map((row) => (
                <li key={row.id} className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-midnight-900 dark:text-ivory-50">
                        {row.user.fullName}
                      </p>
                      <p
                        dir="ltr"
                        className="nums-tabular text-end text-xs text-midnight-500 dark:text-ivory-300/60"
                      >
                        {row.user.phone}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-base font-black text-gold-700 dark:text-gold-300">
                      {formatEgp(row.totalMinor)}
                    </p>
                  </div>
                  {linesOf(row).map((item, index) => (
                    <p key={index} className="text-sm text-midnight-800 dark:text-ivory-100">
                      <span className="me-1.5 rounded-md bg-gold-500/10 px-1.5 py-0.5 text-[10px] font-bold text-gold-700 dark:text-gold-300">
                        {KIND_LABELS[item.kindSnapshot] ?? item.kindSnapshot}
                      </span>
                      {item.titleSnapshot}
                    </p>
                  ))}
                  <p className="text-xs text-midnight-500 dark:text-ivory-300/60">
                    {methodLabel(row)} · {formatPaidAt(row.paidAt)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[52rem] text-start text-sm">
                <thead className="border-b border-gold-500/20 bg-ivory-100/70 text-xs text-midnight-700 dark:bg-midnight-900/90 dark:text-gold-300/90">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-bold">
                      الطالب
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">
                      دفع على
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">
                      المبلغ
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">
                      طريقة الدفع
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-bold">
                      التاريخ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200 dark:divide-midnight-800">
                  {data.items.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-bold text-midnight-900 dark:text-ivory-50">
                          {row.user.fullName}
                        </p>
                        <p
                          dir="ltr"
                          className="nums-tabular text-end text-xs text-midnight-500 dark:text-ivory-300/60"
                        >
                          {row.user.phone}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-1">
                          {linesOf(row).map((item, index) => (
                            <li key={index} className="text-midnight-800 dark:text-ivory-100">
                              <span className="me-1.5 rounded-md bg-gold-500/10 px-1.5 py-0.5 text-[10px] font-bold text-gold-700 dark:text-gold-300">
                                {KIND_LABELS[item.kindSnapshot] ?? item.kindSnapshot}
                              </span>
                              {item.titleSnapshot}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[11px] text-midnight-400 dark:text-ivory-300/50">
                          طلب {row.reference}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-display text-base font-black text-midnight-950 dark:text-ivory-50">
                          {formatEgp(row.totalMinor)}
                        </p>
                        {row.discountMinor > 0 && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            خصم {formatEgp(row.discountMinor)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-midnight-700 dark:text-ivory-200">
                        {methodLabel(row)}
                      </td>
                      <td className="px-4 py-3 text-midnight-600 dark:text-ivory-300/80">
                        {formatPaidAt(row.paidAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="min-h-11 rounded-xl border border-gold-500/30 px-4 font-bold disabled:opacity-40"
          >
            الأحدث
          </button>
          <span className="text-midnight-600 dark:text-ivory-300/70">
            صفحة {toArabicDigits(page)} من {toArabicDigits(totalPages)}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-11 rounded-xl border border-gold-500/30 px-4 font-bold disabled:opacity-40"
          >
            الأقدم
          </button>
        </div>
      )}
    </div>
  );
}
