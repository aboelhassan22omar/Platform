'use client';

import { useState } from 'react';
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
  /** Only for proofs uploaded by the earlier on-site flow. */
  receiptUrl: string | null;
}

interface TransferSettings {
  vodafoneCashPhone: string;
  instapayPhone: string;
  instapayLink: string;
  instapayAddress: string;
  recipientName: string;
  whatsappPhone: string;
}

const METHOD_LABEL = { INSTAPAY: 'إنستا باي', VODAFONE_CASH: 'فودافون كاش' } as const;
const STATE_LABEL = {
  submitted: {
    text: 'بعت بيانات التحويل',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  waiting: {
    text: 'ما كتبش بيانات (شوف واتساب)',
    className: 'bg-midnight-500/10 text-midnight-600 dark:text-ivory-300',
  },
  rejected: { text: 'اترفض قبل كده', className: 'bg-red-500/15 text-red-700 dark:text-red-300' },
} as const;
const QUICK_REASONS = ['التحويل ما وصلش', 'المبلغ مش مطابق', 'ما وصلتناش صورة التحويل على واتساب'];
const ORDER = { submitted: 0, rejected: 1, waiting: 2 } as const;

/**
 * Pending manual transfers, at the top of the payments log. The student sends
 * the screenshot on WhatsApp; here the admin matches it with the order and
 * approves (content unlocks immediately) or rejects with a reason.
 */
export function PendingTransfers() {
  const { data, error } = useQuery({
    queryKey: ['admin-transfers'],
    queryFn: () => api.get<Transfer[]>('/admin/transfers'),
    refetchInterval: 30_000,
    retry: false,
  });
  // Automatic gateways refuse this endpoint: then there is nothing to review.
  if (error || !data) return null;
  const sorted = [...data].sort((a, b) => ORDER[a.state] - ORDER[b.state]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50">
          تحويلات مستنية قرارك ({data.length})
        </h2>
        <p className="text-sm text-midnight-600 dark:text-ivory-300/70">
          طابق صورة التحويل اللي جاتلك على واتساب مع الطلب، واتأكد إن المبلغ وصل محفظتك.
        </p>
      </div>
      {!data.length ? (
        <p className="rounded-2xl border border-gold-500/20 bg-white p-6 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
          مفيش تحويلات مستنية دلوقتي 👌
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((transfer) => (
            <TransferCard key={transfer.orderId} transfer={transfer} />
          ))}
        </div>
      )}
      <TransferSettingsForm />
    </section>
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
    onSuccess: () => {
      setRejecting(false);
      setReason('');
      refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'تعذر رفض التحويل'),
  });

  const state = STATE_LABEL[t.state];

  return (
    <article className="space-y-3 rounded-2xl border border-gold-500/25 bg-white p-4 shadow-card dark:bg-midnight-950/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
            {t.student.fullName}
          </p>
          <p className="text-xs text-midnight-500 dark:text-ivory-300/70">
            <bdi dir="ltr">{t.student.phone}</bdi> · طلب <bdi dir="ltr">{t.reference}</bdi>
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

      <span
        className={cn('inline-block rounded-md px-2 py-0.5 text-[11px] font-bold', state.className)}
      >
        {state.text}
      </span>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
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
        <dd className="text-midnight-800 dark:text-ivory-200">{t.items.join('، ') || '—'}</dd>
        <dt className="text-midnight-500 dark:text-ivory-300/70">من</dt>
        <dd className="text-midnight-800 dark:text-ivory-200">
          {formatRelative(t.submittedAt ?? t.createdAt)}
        </dd>
      </dl>

      <div className="flex flex-wrap gap-3 text-xs font-bold">
        <a
          href={`https://wa.me/2${t.student.phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-700 hover:underline dark:text-emerald-400"
        >
          كلّم الطالب على واتساب
        </a>
        {t.receiptUrl && (
          <a
            href={t.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-700 hover:underline dark:text-gold-300"
          >
            صورة التحويل المرفوعة
          </a>
        )}
      </div>

      {t.state === 'rejected' && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          سبب الرفض السابق: {t.rejectionReason}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!rejecting ? (
        <div className="flex gap-2">
          <Button variant="accent" fullWidth onClick={() => setConfirming(true)}>
            موافقة وفتح المحتوى
          </Button>
          <Button variant="outline" onClick={() => setRejecting(true)}>
            رفض
          </Button>
        </div>
      ) : (
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

      <ConfirmDialog
        open={confirming}
        title="تأكيد وصول التحويل؟"
        body={`اتأكدت إن ${formatEgp(t.amountMinor)} وصلوا محفظتك${t.senderPhone ? ` من ${t.senderPhone}` : ''}؟ المحتوى هيتفتح لـ ${t.student.fullName} فورًا.`}
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
    <div className="rounded-2xl border border-gold-500/25 bg-white p-4 dark:bg-midnight-950/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-start font-display font-black text-midnight-950 dark:text-ivory-50"
        aria-expanded={open}
      >
        بيانات التحويل (الأرقام، لينك إنستا باي، واتساب الإثباتات)
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
          {field('whatsappPhone', 'رقم واتساب الإثباتات', 'الطلاب هيبعتوا صورة التحويل عليه')}
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
          <div className="flex items-end sm:col-span-2">
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
    </div>
  );
}
