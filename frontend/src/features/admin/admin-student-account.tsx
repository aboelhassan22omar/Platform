'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, formatEgp, formatRelative, toArabicDigits } from '@/lib/utils';
import type {
  DeviceList,
  LessonViewUsage,
  StudentParentReport,
  WalletSummary,
  WalletTransaction,
} from '@/types/api';
import { ParentReportSummary, ReportTheme } from '@/features/reports/parent-report-summary';
import { KIND_LABELS, STATUS_LABELS } from './admin-messages';

type Tab = 'wallet' | 'devices' | 'views' | 'parent';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'wallet', label: 'المحفظة' },
  { key: 'devices', label: 'الأجهزة' },
  { key: 'views', label: 'المشاهدات' },
  { key: 'parent', label: 'ولي الأمر' },
];

const TYPE_LABELS: Record<WalletTransaction['type'], string> = {
  TOPUP: 'شحن',
  PURCHASE: 'شراء',
  ADMIN_CREDIT: 'إضافة يدوية',
  ADMIN_DEBIT: 'خصم يدوي',
};

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/**
 * Everything support needs for the daily account calls: "add the cash I paid
 * at the center", "I changed my phone", "I need to rewatch this lesson".
 */
export function StudentAccountDialog({
  student,
  onClose,
}: {
  student: { id: string; fullName: string } | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('wallet');
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 bg-midnight-950/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-account-title"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gold-500/30 bg-ivory-50 shadow-2xl dark:bg-midnight-950"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gold-500/20 p-5 pb-0">
          <div className="min-w-0">
            <p className="text-xs font-bold text-gold-700 dark:text-gold-300">حساب الطالب</p>
            <h2
              id="student-account-title"
              className="mt-1 truncate font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
            >
              {student.fullName}
            </h2>
            <nav className="mt-4 flex gap-1" aria-label="أقسام الحساب">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  aria-current={tab === item.key ? 'page' : undefined}
                  className={cn(
                    '-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition-colors',
                    tab === item.key
                      ? 'border-gold-500 text-gold-800 dark:text-gold-300'
                      : 'border-transparent text-midnight-500 hover:text-midnight-900 dark:text-ivory-300/70 dark:hover:text-ivory-100',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl text-midnight-500 transition-colors hover:bg-midnight-100 dark:text-ivory-300 dark:hover:bg-midnight-800"
          >
            ×
          </button>
        </header>
        <div className="overflow-y-auto p-5">
          {tab === 'wallet' && <WalletTab studentId={student.id} />}
          {tab === 'devices' && <DevicesTab studentId={student.id} />}
          {tab === 'views' && <ViewsTab studentId={student.id} />}
          {tab === 'parent' && <ParentTab studentId={student.id} />}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

function WalletTab({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [pounds, setPounds] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const wallet = useQuery({
    queryKey: ['admin-student-wallet', studentId],
    queryFn: () => api.get<WalletSummary>(`/admin/students/${studentId}/wallet`),
  });
  const adjust = useMutation({
    mutationFn: () =>
      api.post<{ balanceMinor: number }>(`/admin/students/${studentId}/wallet/adjust`, {
        amountMinor: Math.round(Number(pounds) * 100) * (direction === 'credit' ? 1 : -1),
        note: note.trim(),
      }),
    onMutate: () => setMessage(null),
    onSuccess: (result) => {
      setPounds('');
      setNote('');
      setMessage({ ok: true, text: `اتحفظ. الرصيد دلوقتي ${formatEgp(result.balanceMinor)}` });
      void queryClient.invalidateQueries({ queryKey: ['admin-student-wallet', studentId] });
    },
    onError: (error) => setMessage({ ok: false, text: errorText(error, 'تعذر تعديل الرصيد') }),
  });
  const amountValid = Number(pounds) > 0 && Number(pounds) <= 100_000;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gold-500/30 bg-white p-5 dark:bg-midnight-900">
        <p className="text-xs font-bold text-midnight-500 dark:text-ivory-300/70">الرصيد الحالي</p>
        {wallet.isLoading ? (
          <div className="skeleton mt-2 h-9 w-32 rounded-lg" />
        ) : (
          <p className="mt-1 font-display text-3xl font-black text-gold-700 dark:text-gold-300">
            {formatEgp(wallet.data?.balanceMinor ?? 0)}
          </p>
        )}
      </div>

      <form
        className="space-y-3 rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-900"
        onSubmit={(event) => {
          event.preventDefault();
          if (amountValid && note.trim().length >= 3) adjust.mutate();
        }}
      >
        <h3 className="text-sm font-black text-midnight-900 dark:text-ivory-50">
          إضافة أو خصم يدوي
        </h3>
        <div className="flex gap-2">
          {(['credit', 'debit'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDirection(value)}
              aria-pressed={direction === value}
              className={cn(
                'min-h-10 flex-1 rounded-xl border-2 text-sm font-black transition-colors',
                direction === value
                  ? value === 'credit'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300'
                  : 'border-ivory-300 text-midnight-600 dark:border-midnight-700 dark:text-ivory-300',
              )}
            >
              {value === 'credit' ? 'إضافة رصيد' : 'خصم رصيد'}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-midnight-700 dark:text-ivory-200">
              المبلغ بالجنيه
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={pounds}
              onChange={(event) => setPounds(event.target.value)}
              className="input-base"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-midnight-700 dark:text-ivory-200">
              السبب (الطالب هيشوفه)
            </span>
            <input
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder={direction === 'credit' ? 'مثلًا: دفع كاش في السنتر' : 'مثلًا: تصحيح'}
              className="input-base"
            />
          </label>
        </div>
        <Button
          type="submit"
          variant={direction === 'credit' ? 'accent' : 'outline'}
          isLoading={adjust.isPending}
          disabled={!amountValid || note.trim().length < 3}
        >
          {direction === 'credit' ? 'أضف للرصيد' : 'اخصم من الرصيد'}
        </Button>
        {message && (
          <p
            role="status"
            className={cn(
              'text-sm font-semibold',
              message.ok
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400',
            )}
          >
            {message.text}
          </p>
        )}
      </form>

      <div>
        <h3 className="text-sm font-black text-midnight-900 dark:text-ivory-50">كشف الحساب</h3>
        {!wallet.data?.transactions.length ? (
          <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/70">مفيش حركات لسه.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gold-500/15 rounded-xl border border-gold-500/20 bg-white dark:bg-midnight-900">
            {wallet.data.transactions.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-midnight-900 dark:text-ivory-100">
                    {TYPE_LABELS[row.type]}
                    {row.items.length > 0 && (
                      <span className="font-normal text-midnight-600 dark:text-ivory-300/75">
                        {' '}
                        — {row.items.join('، ')}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-midnight-500 dark:text-ivory-300/60">
                    {formatDate(row.createdAt)}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                </div>
                <p
                  dir="ltr"
                  className={cn(
                    'shrink-0 font-display text-sm font-black',
                    row.amountMinor > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-midnight-800 dark:text-ivory-200',
                  )}
                >
                  {row.amountMinor > 0 ? '+' : '−'}
                  {formatEgp(Math.abs(row.amountMinor))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

function DevicesTab({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const devices = useQuery({
    queryKey: ['admin-student-devices', studentId],
    queryFn: () => api.get<DeviceList>(`/admin/students/${studentId}/devices`),
  });
  const remove = useMutation({
    mutationFn: (target: string | 'all') =>
      api.delete(
        target === 'all'
          ? `/admin/students/${studentId}/devices`
          : `/admin/students/${studentId}/devices/${target}`,
      ),
    onMutate: () => setError(null),
    onSuccess: () => {
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-student-devices', studentId] });
    },
    onError: (caught) => setError(errorText(caught, 'تعذر إزالة الجهاز')),
  });

  const { user } = useAuth();
  const exempt = useMutation({
    mutationFn: (next: boolean) =>
      api.put(`/admin/students/${studentId}/devices/exempt`, { exempt: next }),
    onMutate: () => setError(null),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-student-devices', studentId] }),
    onError: (caught) => setError(errorText(caught, 'تعذر الحفظ')),
  });

  const list = devices.data?.devices ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
        {devices.data?.limit
          ? `الحد المسموح ${toArabicDigits(devices.data.limit)} ${devices.data.limit === 1 ? 'جهاز' : 'أجهزة'}. `
          : 'مفيش حد لعدد الأجهزة دلوقتي. '}
        إزالة جهاز بتسجّل خروجه فورًا وبتفضّي مكانه لجهاز جديد.
      </p>
      {devices.isLoading ? (
        <div className="skeleton h-16 rounded-xl" />
      ) : !list.length ? (
        <p className="rounded-xl border border-dashed border-gold-500/30 p-6 text-center text-sm text-midnight-500 dark:text-ivory-300/70">
          الطالب ده مسجّلش دخول من أي جهاز لسه.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-500/20 bg-white px-4 py-3 dark:bg-midnight-900"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-midnight-900 dark:text-ivory-100">
                  {device.label}
                </p>
                <p className="mt-0.5 text-xs text-midnight-500 dark:text-ivory-300/60">
                  آخر استخدام {formatRelative(device.lastSeenAt)} · أول مرة{' '}
                  {formatDate(device.firstSeenAt)}
                  {device.ip ? (
                    <>
                      {' '}
                      · <span dir="ltr">{device.ip}</span>
                    </>
                  ) : null}
                </p>
              </div>
              {confirming === device.id ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    isLoading={remove.isPending}
                    onClick={() => remove.mutate(device.id)}
                  >
                    أكيد، شيله
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    لأ
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirming(device.id)}>
                  إزالة
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.length > 1 &&
        (confirming === 'all' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-red-700 dark:text-red-300">
              هيتسجّل خروجه من كل الأجهزة. متأكد؟
            </span>
            <Button
              size="sm"
              variant="danger"
              isLoading={remove.isPending}
              onClick={() => remove.mutate('all')}
            >
              أيوه، شيل الكل
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
              لأ
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming('all')}>
            شيل كل الأجهزة
          </Button>
        ))}
      {user?.role === 'ADMIN' && devices.data && (
        <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-4">
          <p className="text-sm font-bold text-midnight-900 dark:text-ivory-100">
            {devices.data.exempt
              ? 'الحساب ده بيدخل من أي عدد أجهزة.'
              : 'حساب مراجعة المتاجر؟ شيل عنه حد الأجهزة.'}
          </p>
          <p className="mt-1 text-xs leading-6 text-midnight-600 dark:text-ivory-300/70">
            مراجعين Google وApple بيفتحوا الحساب التجريبي من أجهزة كتير. استخدمه للحساب ده بس،
            وارجّع الحد بعد ما التطبيق يتنشر.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            isLoading={exempt.isPending}
            onClick={() => exempt.mutate(!devices.data?.exempt)}
          >
            {devices.data.exempt ? 'رجّع حد الأجهزة' : 'شيل حد الأجهزة'}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const viewsText = (value: number) => toArabicDigits(String(value).replace('.', '٫'));

function ViewsTab({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const views = useQuery({
    queryKey: ['admin-student-views', studentId],
    queryFn: () => api.get<LessonViewUsage[]>(`/admin/students/${studentId}/views`),
  });
  const grant = useMutation({
    mutationFn: (lessonId: string) =>
      api.post(`/admin/students/${studentId}/views/${lessonId}`, { views: 1 }),
    onMutate: () => setError(null),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-student-views', studentId] }),
    onError: (caught) => setError(errorText(caught, 'تعذر زيادة المشاهدات')),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
        الحصص اللي الطالب اتفرّج عليها. المشاهدة الواحدة = مدة الفيديو كاملة.
      </p>
      {views.isLoading ? (
        <div className="skeleton h-16 rounded-xl" />
      ) : !views.data?.length ? (
        <p className="rounded-xl border border-dashed border-gold-500/30 p-6 text-center text-sm text-midnight-500 dark:text-ivory-300/70">
          الطالب ده لسه متفرّجش على أي حصة.
        </p>
      ) : (
        <ul className="space-y-2">
          {views.data.map((row) => (
            <li
              key={row.lessonId}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 dark:bg-midnight-900',
                row.exhausted ? 'border-red-500/40' : 'border-gold-500/20',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-midnight-900 dark:text-ivory-100">
                  {row.title}
                </p>
                <p className="mt-0.5 text-xs text-midnight-500 dark:text-ivory-300/60">
                  {row.limited
                    ? `اتفرّج ${viewsText(row.viewsUsed)} من ${toArabicDigits(row.maxViews + row.bonusViews)} مشاهدات`
                    : `اتفرّج ${viewsText(row.viewsUsed)} مرة · بدون حد`}
                  {row.bonusViews > 0 && ` · منهم ${toArabicDigits(row.bonusViews)} زيادة`}
                  {row.exhausted && (
                    <span className="font-bold text-red-600 dark:text-red-400"> · خلصت</span>
                  )}
                </p>
              </div>
              {row.limited && (
                <Button
                  size="sm"
                  variant={row.exhausted ? 'accent' : 'outline'}
                  isLoading={grant.isPending && grant.variables === row.lessonId}
                  onClick={() => grant.mutate(row.lessonId)}
                >
                  + مشاهدة
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parent: weekly report preview, send now, on/off
// ---------------------------------------------------------------------------

function ParentTab({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const report = useQuery({
    queryKey: ['admin-student-parent-report', studentId],
    queryFn: () => api.get<StudentParentReport>(`/admin/students/${studentId}/parent-report`),
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-student-parent-report', studentId] });
  const send = useMutation({
    mutationFn: () =>
      api.post<{ queued: number }>(`/admin/students/${studentId}/parent-report/send`),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setMessage({ ok: true, text: 'التقرير اتجهّز. هتلاقيه في «رسائل واتساب».' });
      refresh();
    },
    onError: (error) => setMessage({ ok: false, text: errorText(error, 'تعذر تجهيز التقرير') }),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch(`/admin/students/${studentId}/parent-report`, { enabled }),
    onMutate: () => setMessage(null),
    onSuccess: refresh,
    onError: (error) => setMessage({ ok: false, text: errorText(error, 'تعذر الحفظ') }),
  });

  if (report.isLoading || !report.data) return <div className="skeleton h-64 rounded-2xl" />;
  const data = report.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/20 bg-white p-4 dark:bg-midnight-900">
        <div className="text-sm">
          <p className="font-bold text-midnight-900 dark:text-ivory-100">
            رقم ولي الأمر: <span dir="ltr">{data.parentPhone}</span>
          </p>
          <p className="mt-0.5 text-xs text-midnight-500 dark:text-ivory-300/65">
            {data.enabled ? 'التقرير الأسبوعي شغّال' : 'التقرير الأسبوعي متوقف للطالب ده'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="accent"
            isLoading={send.isPending}
            onClick={() => send.mutate()}
          >
            ابعت تقرير الأسبوع دلوقتي
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isLoading={toggle.isPending}
            onClick={() => toggle.mutate(!data.enabled)}
          >
            {data.enabled ? 'وقّف التقرير' : 'شغّل التقرير'}
          </Button>
        </div>
      </div>
      {message && (
        <p
          role="status"
          className={cn(
            'text-sm font-semibold',
            message.ok
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400',
          )}
        >
          {message.text}
        </p>
      )}

      <div>
        <h3 className="mb-3 text-sm font-black text-midnight-900 dark:text-ivory-50">
          شكل تقرير الأسبوع ده
          {data.latestReportUrl && (
            <a
              href={data.latestReportUrl}
              target="_blank"
              rel="noreferrer"
              className="ms-3 text-xs font-bold text-gold-700 underline-offset-4 hover:underline dark:text-gold-300"
            >
              آخر تقرير اتبعت ←
            </a>
          )}
        </h3>
        <div className="parent-report rounded-2xl bg-[var(--report-page)] p-3">
          <ReportTheme />
          <ParentReportSummary data={data.preview} />
        </div>
      </div>

      {data.messages.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-midnight-900 dark:text-ivory-50">
            آخر رسائل واتساب
          </h3>
          <ul className="mt-2 divide-y divide-gold-500/15 rounded-xl border border-gold-500/20 bg-white dark:bg-midnight-900">
            {data.messages.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="text-midnight-800 dark:text-ivory-100">
                  {KIND_LABELS[row.kind]}
                  <span className="ms-2 text-xs text-midnight-500 dark:text-ivory-300/60">
                    {row.audience === 'PARENT' ? 'لولي الأمر' : 'للطالب'} ·{' '}
                    {formatRelative(row.createdAt)}
                  </span>
                </span>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-[11px] font-bold',
                    STATUS_LABELS[row.status].className,
                  )}
                >
                  {STATUS_LABELS[row.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
