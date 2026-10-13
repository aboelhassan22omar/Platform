'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api, ApiError } from '@/lib/api';
import { cn, formatEgp, formatRelative } from '@/lib/utils';

interface Transfer {
  orderId: string;
  reference: string;
  amountMinor: number;
  method: 'INSTAPAY' | 'VODAFONE_CASH';
  createdAt: string;
  state: 'waiting' | 'submitted' | 'rejected';
  student: { fullName: string; phone: string; username: string };
  items: string[];
  senderPhone: string | null;
  transactionReference: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  receiptUrl: string | null;
}

interface TransferSettings {
  vodafoneCashPhone: string;
  instapayPhone: string;
  instapayLink: string;
  instapayAddress: string;
  recipientName: string;
}

const METHOD_LABEL = { INSTAPAY: 'إنستا باي', VODAFONE_CASH: 'فودافون كاش' } as const;
const QUICK_REASONS = ['صورة التحويل مش واضحة', 'المبلغ مش مطابق', 'التحويل ما وصلش لحد دلوقتي'];

const useTransfers = () =>
  useQuery({
    queryKey: ['admin-transfers'],
    queryFn: () => api.get<Transfer[]>('/admin/transfers'),
    refetchInterval: 30_000,
    retry: false,
  });

/** Small banner for the payments log: how many transfers wait for review. */
export function PendingTransfers() {
  const { data } = useTransfers();
  const count = data?.filter((t) => t.state === 'submitted').length ?? 0;
  if (!count) return null;
  return (
    <Link
      href="/admin/transfers"
      className="flex items-center justify-between gap-3 rounded-2xl border border-gold-500/40 bg-gold-500/10 px-5 py-4 font-bold text-midnight-900 transition-colors hover:bg-gold-500/15 dark:text-ivory-50"
    >
      <span>عندك {count} تحويل مستني موافقتك</span>
      <span className="text-gold-700 dark:text-gold-300">راجع دلوقتي ←</span>
    </Link>
  );
}

/**
 * Manual transfer review: each card shows the student, the amount and the
 * screenshot they sent; one tap approves (content unlocks immediately) or
 * rejects with a reason the student sees.
 */
export function AdminTransfers() {
  const { data, isLoading, error } = useTransfers();
  const [tab, setTab] = useState<'review' | 'waiting'>('review');
  const toReview = data?.filter((t) => t.state === 'submitted') ?? [];
  const waiting = data?.filter((t) => t.state !== 'submitted') ?? [];
  const shown = tab === 'review' ? toReview : waiting;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
            مراجعة التحويلات
          </h1>
          <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
            افتح محفظتك، اتأكد إن التحويل وصل، وبعدين وافق أو ارفض.
          </p>
        </div>
        <div className="flex rounded-xl border border-gold-500/25 bg-white p-1 dark:bg-midnight-950/80">
          {(
            [
              ['review', `محتاجة موافقتك (${toReview.length})`],
              ['waiting', `مستنية الطالب (${waiting.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'min-h-10 rounded-lg px-4 text-sm font-bold transition-colors',
                tab === key
                  ? 'bg-midnight-900 text-ivory-50 dark:bg-gold-500 dark:text-midnight-950'
                  : 'text-midnight-600 hover:bg-gold-500/10 dark:text-ivory-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error instanceof ApiError && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          {error.message}
        </p>
      )}
      {isLoading && <div className="skeleton h-40 w-full rounded-2xl" />}
      {data && !shown.length && (
        <p className="rounded-2xl border border-gold-500/20 bg-white p-8 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
          {tab === 'review' ? 'مفيش تحويلات مستنية موافقتك دلوقتي 👌' : 'مفيش طلبات مستنية الطالب.'}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((transfer) => (
          <TransferCard key={transfer.orderId} transfer={transfer} />
        ))}
      </div>

      <TransferSettingsForm />
    </div>
  );
}

function TransferCard({ transfer: t }: { transfer: Transfer }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-transfers'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
  };

  const approve = useMutation({
    mutationFn: () => api.post(`/admin/transfers/${t.orderId}/approve`),
    onSuccess: () => {
      setConfirming(false);
      refresh();
    },
    onError: (caught) => {
      setConfirming(false);
      setError(caught instanceof ApiError ? caught.message : 'تعذر تأكيد التحويل');
    },
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/admin/transfers/${t.orderId}/reject`, { reason: reason.trim() }),
    onSuccess: refresh,
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'تعذر رفض التحويل'),
  });

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-gold-500/25 bg-white p-4 shadow-card dark:bg-midnight-950/80 sm:flex-row">
      {t.receiptUrl ? (
        <a
          href={t.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block shrink-0 overflow-hidden rounded-xl border border-gold-500/20 bg-ivory-100 dark:bg-midnight-900 sm:w-40"
          title="افتح صورة التحويل"
        >
          <img
            src={t.receiptUrl}
            alt={`صورة تحويل ${t.student.fullName}`}
            className="h-48 w-full object-contain sm:h-full"
          />
        </a>
      ) : (
        <div className="grid h-24 shrink-0 place-items-center rounded-xl border border-dashed border-gold-500/30 text-xs text-midnight-500 dark:text-ivory-300/60 sm:h-auto sm:w-40">
          لسه ما بعتش صورة
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
              {t.student.fullName}
            </p>
            <p className="text-xs text-midnight-500 dark:text-ivory-300/70">
              <bdi dir="ltr">{t.student.username}</bdi> · <bdi dir="ltr">{t.student.phone}</bdi>
            </p>
          </div>
          <div className="shrink-0 text-end">
            <p className="font-display text-xl font-black text-gold-700 dark:text-gold-300">
              {formatEgp(t.amountMinor)}
            </p>
            <span className="rounded-md bg-gold-500/15 px-2 py-0.5 text-[11px] font-bold text-gold-800 dark:text-gold-200">
              {METHOD_LABEL[t.method]}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-midnight-500 dark:text-ivory-300/70">حوّل من</dt>
          <dd className="font-bold text-midnight-900 dark:text-ivory-100">
            {t.senderPhone ? <bdi dir="ltr">{t.senderPhone}</bdi> : '—'}
          </dd>
          {t.transactionReference && (
            <>
              <dt className="text-midnight-500 dark:text-ivory-300/70">رقم العملية</dt>
              <dd className="truncate font-bold text-midnight-900 dark:text-ivory-100">
                <bdi dir="ltr">{t.transactionReference}</bdi>
              </dd>
            </>
          )}
          <dt className="text-midnight-500 dark:text-ivory-300/70">الطلب</dt>
          <dd className="truncate text-midnight-800 dark:text-ivory-200">
            {t.items.join('، ') || t.reference}
          </dd>
          <dt className="text-midnight-500 dark:text-ivory-300/70">وقت الإرسال</dt>
          <dd className="text-midnight-800 dark:text-ivory-200">
            {formatRelative(t.submittedAt ?? t.createdAt)}
          </dd>
        </dl>

        {t.state === 'rejected' && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            اترفض قبل كده: {t.rejectionReason}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {t.state === 'submitted' && !rejecting && (
          <div className="flex gap-2">
            <Button variant="accent" fullWidth onClick={() => setConfirming(true)}>
              موافقة وفتح المحتوى
            </Button>
            <Button variant="outline" onClick={() => setRejecting(true)}>
              رفض
            </Button>
          </div>
        )}

        {rejecting && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length >= 3) reject.mutate();
            }}
          >
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setReason(quick)}
                  className="rounded-full border border-gold-500/30 px-3 py-1 text-xs font-bold text-midnight-700 hover:bg-gold-500/10 dark:text-ivory-200"
                >
                  {quick}
                </button>
              ))}
            </div>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="سبب الرفض (الطالب هيشوفه)"
              maxLength={300}
              autoFocus
              className="min-h-11 w-full rounded-xl border-2 border-ivory-300 bg-white px-3 text-sm text-midnight-900 focus:border-gold-500 focus:outline-none dark:border-midnight-700 dark:bg-midnight-900 dark:text-ivory-50"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="danger"
                fullWidth
                isLoading={reject.isPending}
                disabled={reason.trim().length < 3}
              >
                ارفض وبلّغ الطالب
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title="تأكيد وصول التحويل؟"
        body={`اتأكدت إن ${formatEgp(t.amountMinor)} وصلوا محفظتك من ${t.senderPhone ?? 'الطالب'}؟ المحتوى هيتفتح لـ ${t.student.fullName} فورًا.`}
        confirmLabel="أيوه، وصل — افتح المحتوى"
        isPending={approve.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => approve.mutate()}
      />
    </article>
  );
}

function TransferSettingsForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TransferSettings | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const settings = useQuery({
    queryKey: ['admin-transfer-settings'],
    queryFn: () => api.get<TransferSettings>('/admin/transfer-settings'),
    enabled: open,
  });
  const values = draft ?? settings.data;
  const save = useMutation({
    mutationFn: (next: TransferSettings) =>
      api.put<TransferSettings>('/admin/transfer-settings', next),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin-transfer-settings'], saved);
      setDraft(null);
      setMessage({ ok: true, text: 'اتحفظت. الطلاب هيشوفوا البيانات الجديدة على طول.' });
    },
    onError: (caught) =>
      setMessage({ ok: false, text: caught instanceof ApiError ? caught.message : 'تعذر الحفظ' }),
  });

  const field = (key: keyof TransferSettings, label: string, hint?: string, ltr = true) => (
    <label className="block text-sm font-bold text-midnight-800 dark:text-ivory-100">
      {label}
      {hint && (
        <span className="block text-xs font-normal text-midnight-500 dark:text-ivory-300/60">
          {hint}
        </span>
      )}
      <input
        dir={ltr ? 'ltr' : 'rtl'}
        value={values?.[key] ?? ''}
        onChange={(event) =>
          setDraft({ ...(values as TransferSettings), [key]: event.target.value })
        }
        className="mt-1 min-h-11 w-full rounded-xl border-2 border-ivory-300 bg-white px-3 text-sm text-midnight-900 focus:border-gold-500 focus:outline-none dark:border-midnight-700 dark:bg-midnight-900 dark:text-ivory-50"
      />
    </label>
  );

  return (
    <section className="rounded-2xl border border-gold-500/25 bg-white p-4 dark:bg-midnight-950/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-start font-display font-black text-midnight-950 dark:text-ivory-50"
        aria-expanded={open}
      >
        بيانات استلام التحويلات (الرقم ولينك إنستا باي)
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && values && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            save.mutate(values);
          }}
        >
          {field('vodafoneCashPhone', 'رقم فودافون كاش')}
          {field('instapayPhone', 'رقم إنستا باي', 'الرقم المسجل على إنستا باي')}
          {field(
            'instapayLink',
            'لينك الدفع من إنستا باي',
            'من التطبيق: Profile ← Payment link (يبدأ بـ https://ipn.eg)',
          )}
          {field('instapayAddress', 'عنوان إنستا باي', 'اختياري، مثل name@instapay')}
          {field(
            'recipientName',
            'اسم المستلم',
            'اللي الطالب هيشوفه في التطبيق قبل التحويل',
            false,
          )}
          <div className="flex items-end">
            <Button type="submit" variant="accent" fullWidth isLoading={save.isPending}>
              حفظ
            </Button>
          </div>
          {message && (
            <p
              role="status"
              className={cn(
                'text-sm font-semibold sm:col-span-2',
                message.ok
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {message.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
