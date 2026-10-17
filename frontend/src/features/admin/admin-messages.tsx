'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber, formatRelative, toArabicDigits } from '@/lib/utils';
import type {
  MessageKind,
  MessageStatus,
  MessagingOverview,
  MessagingSettings,
  OutboundMessageRow,
  Paginated,
} from '@/types/api';

export const KIND_LABELS: Record<MessageKind, string> = {
  WEEKLY_REPORT: 'تقرير ولي الأمر',
  NEW_LESSON: 'حصة جديدة',
  LIVE_REMINDER: 'تذكير لايف',
  HOMEWORK_DUE: 'تذكير واجب',
  SUBSCRIPTION_EXPIRING: 'اشتراك قرّب يخلص',
  PAYMENT_CONFIRMED: 'تأكيد دفع',
  QUESTION_ANSWERED: 'رد على سؤال',
  CENTER_ABSENCE: 'غياب عن السنتر',
};

export const STATUS_LABELS: Record<MessageStatus, { label: string; className: string }> = {
  PENDING: { label: 'مستنية دورها', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  MANUAL: { label: 'لازم تتبعت', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  SENT: { label: 'اتبعتت', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  DELIVERED: {
    label: 'وصلت',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  READ: {
    label: 'اتقرت ✓✓',
    className: 'bg-emerald-600/20 text-emerald-800 dark:text-emerald-200',
  },
  FAILED: { label: 'فشلت', className: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  CANCELLED: {
    label: 'اتلغت',
    className: 'bg-midnight-500/10 text-midnight-600 dark:text-ivory-300/70',
  },
};

const WEEKDAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const hourLabel = (hour: number) => {
  const suffix = hour < 12 ? 'صباحًا' : 'مساءً';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${toArabicDigits(twelve)} ${suffix}`;
};
const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function AdminMessages() {
  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
          متابعة الطلاب وأولياء الأمور
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
          رسائل واتساب
        </h1>
      </header>
      <Outbox />
      <SettingsSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outbox: what needs sending, what went out
// ---------------------------------------------------------------------------

const TABS: Array<{ key: string; label: string; status?: MessageStatus }> = [
  { key: 'manual', label: 'لازم تتبعت', status: 'MANUAL' },
  { key: 'pending', label: 'مستنية', status: 'PENDING' },
  { key: 'failed', label: 'فشلت', status: 'FAILED' },
  { key: 'all', label: 'كل الرسائل' },
];

function Outbox() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(TABS[0]);
  const [kind, setKind] = useState<MessageKind | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page) });
  if (tab.status) params.set('status', tab.status);
  if (kind) params.set('kind', kind);
  if (search.trim()) params.set('search', search.trim());

  const query = useQuery({
    queryKey: ['admin-messages', params.toString()],
    queryFn: () =>
      api.get<Paginated<OutboundMessageRow> & { counts: Partial<Record<MessageStatus, number>> }>(
        `/admin/messaging/messages?${params}`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'sent' | 'retry' | 'cancel' }) =>
      api.post(`/admin/messaging/messages/${id}/${action}`),
    onMutate: () => setError(null),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-messages'] }),
    onError: (caught) => setError(errorText(caught, 'تعذر تنفيذ العملية')),
  });

  const counts = query.data?.counts ?? {};
  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  return (
    <section aria-labelledby="outbox-title" className="space-y-4">
      <div>
        <h2
          id="outbox-title"
          className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
        >
          الرسائل
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
          في الإرسال اليدوي: دوس «افتح واتساب» والرسالة هتفتح جاهزة على رقم الطالب أو ولي الأمر،
          ابعتها، وبعدين دوس «اتبعتت».
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((item) => {
          const count = item.status ? counts[item.status] : undefined;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item);
                setPage(1);
              }}
              aria-pressed={tab.key === item.key}
              className={cn(
                'min-h-10 rounded-xl border px-4 text-sm font-bold transition-colors',
                tab.key === item.key
                  ? 'border-gold-500 bg-gold-500/15 text-gold-800 dark:text-gold-200'
                  : 'border-gold-500/20 text-midnight-600 hover:border-gold-500/50 dark:text-ivory-300',
              )}
            >
              {item.label}
              {count ? (
                <span className="ms-2 rounded-full bg-midnight-950/10 px-2 py-0.5 text-[11px] dark:bg-white/10">
                  {formatNumber(count)}
                </span>
              ) : null}
            </button>
          );
        })}
        <div className="flex w-full flex-wrap gap-2 sm:ms-auto sm:w-auto">
          <div className="w-full sm:w-44">
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as MessageKind | '');
                setPage(1);
              }}
              aria-label="نوع الرسالة"
              className="input-base h-10 py-0"
            >
              <option value="">كل الأنواع</option>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-56">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="اسم الطالب أو الرقم"
              aria-label="بحث في الرسائل"
              className="input-base h-10 py-0"
            />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
      ) : !query.data?.items.length ? (
        <p className="rounded-2xl border border-dashed border-gold-500/30 bg-white p-10 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
          {tab.status === 'MANUAL' ? 'مفيش رسائل مستنية تتبعت دلوقتي 👌' : 'مفيش رسائل هنا.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {query.data.items.map((message) => {
            const status = STATUS_LABELS[message.status];
            const pendingAction = act.isPending && act.variables?.id === message.id;
            return (
              <li
                key={message.id}
                className="rounded-2xl border border-gold-500/20 bg-white p-4 shadow-card dark:bg-midnight-950/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-black text-midnight-900 dark:text-ivory-50">
                      {KIND_LABELS[message.kind]}
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold',
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/65">
                      {message.audience === 'PARENT' ? 'لولي أمر ' : 'للطالب '}
                      <span className="font-bold text-midnight-700 dark:text-ivory-200">
                        {message.user?.fullName ?? '—'}
                      </span>{' '}
                      · <span dir="ltr">+{message.toPhone}</span> ·{' '}
                      {formatRelative(message.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.status === 'MANUAL' && (
                      <>
                        <a
                          href={message.whatsappLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setOpened((current) => new Set(current).add(message.id))}
                          className="inline-flex min-h-9 items-center rounded-lg bg-[#1f8f4e] px-3 text-xs font-black text-white transition-colors hover:bg-[#187540]"
                        >
                          افتح واتساب
                        </a>
                        <Button
                          size="sm"
                          variant={opened.has(message.id) ? 'accent' : 'outline'}
                          isLoading={pendingAction && act.variables?.action === 'sent'}
                          onClick={() => act.mutate({ id: message.id, action: 'sent' })}
                        >
                          اتبعتت ✓
                        </Button>
                      </>
                    )}
                    {message.status === 'FAILED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={pendingAction}
                        onClick={() => act.mutate({ id: message.id, action: 'retry' })}
                      >
                        حاول تاني
                      </Button>
                    )}
                    {(message.status === 'MANUAL' || message.status === 'PENDING') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={pendingAction && act.variables?.action === 'cancel'}
                        onClick={() => act.mutate({ id: message.id, action: 'cancel' })}
                      >
                        إلغاء
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line rounded-xl bg-ivory-100 p-3 text-sm leading-7 text-midnight-800 dark:bg-midnight-900 dark:text-ivory-100">
                  {message.body}
                </p>
                {message.lastError && (
                  <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                    {message.lastError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {query.data && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            السابق
          </Button>
          <span className="text-xs text-midnight-600 dark:text-ivory-300/70">
            صفحة {formatNumber(page)} من {formatNumber(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings and templates
// ---------------------------------------------------------------------------

const MODES: Array<{ value: MessagingSettings['mode']; title: string; body: string }> = [
  { value: 'off', title: 'مقفولة', body: 'مفيش رسائل خالص.' },
  {
    value: 'manual',
    title: 'إرسال يدوي',
    body: 'الرسائل بتتجهز هنا، وإنت أو فريقك تبعتوها بضغطة من واتساب بتاعكم. شغّال من غير أي اشتراك.',
  },
  {
    value: 'cloud',
    title: 'إرسال أوتوماتيك',
    body: 'المنصة بتبعت لوحدها من رقم WhatsApp Business الرسمي. محتاج حساب Meta متربط.',
  },
];

function SettingsSection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<MessagingSettings | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const overview = useQuery({
    queryKey: ['admin-messaging'],
    queryFn: () => api.get<MessagingOverview>('/admin/messaging'),
  });
  const values = draft ?? overview.data?.settings;
  const save = useMutation({
    mutationFn: (next: MessagingSettings) =>
      api.put<MessagingSettings>('/admin/messaging/settings', next),
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setDraft(null);
      setMessage({ ok: true, text: 'اتحفظ.' });
      void queryClient.invalidateQueries({ queryKey: ['admin-messaging'] });
    },
    onError: (caught) => setMessage({ ok: false, text: errorText(caught, 'تعذر الحفظ') }),
  });
  const runWeekly = useMutation({
    mutationFn: () => api.post<{ queued: number }>('/admin/messaging/weekly-report/run'),
    onMutate: () => setMessage(null),
    onSuccess: (result) => {
      setMessage({
        ok: true,
        text: result.queued
          ? `اتجهّز ${toArabicDigits(result.queued)} تقرير. هتلاقيهم فوق في «الرسائل».`
          : 'مفيش تقارير جديدة: كل اللي يستحقوا اتجهّزلهم تقرير الأسبوع ده.',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-messages'] });
    },
    onError: (caught) => setMessage({ ok: false, text: errorText(caught, 'تعذر تجهيز التقارير') }),
  });
  const update = (patch: Partial<MessagingSettings>) => values && setDraft({ ...values, ...patch });

  if (overview.isLoading || !values || !overview.data) {
    return <div className="skeleton h-96 rounded-2xl" />;
  }
  const { cloud, templates } = overview.data;

  return (
    <section aria-labelledby="messaging-settings-title" className="space-y-6">
      <div>
        <h2
          id="messaging-settings-title"
          className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
        >
          الإعدادات
        </h2>
      </div>

      <fieldset className="grid gap-3 md:grid-cols-3">
        <legend className="sr-only">طريقة الإرسال</legend>
        {MODES.map((mode) => {
          const disabled = mode.value === 'cloud' && !cloud.configured;
          const checked = values.mode === mode.value;
          return (
            <label
              key={mode.value}
              className={cn(
                'relative block cursor-pointer rounded-2xl border-2 bg-white p-4 transition-colors dark:bg-midnight-950/80',
                checked ? 'border-gold-500' : 'border-gold-500/20 hover:border-gold-500/50',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name="mode"
                value={mode.value}
                checked={checked}
                disabled={disabled}
                onChange={() => update({ mode: mode.value })}
                className="sr-only"
              />
              <span className="font-display text-base font-black text-midnight-950 dark:text-ivory-50">
                {mode.title}
              </span>
              <span className="mt-1 block text-xs leading-6 text-midnight-600 dark:text-ivory-300/75">
                {mode.body}
              </span>
              {mode.value === 'cloud' && (
                <span
                  className={cn(
                    'mt-2 block text-[11px] font-bold',
                    cloud.configured
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300',
                  )}
                >
                  {cloud.configured ? `متربط (${cloud.phoneNumberId})` : 'لسه مش متربط'}
                </span>
              )}
            </label>
          );
        })}
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80">
          <h3 className="text-sm font-black text-midnight-900 dark:text-ivory-50">
            الرسائل اللي بتتبعت
          </h3>
          <ul className="mt-3 space-y-3">
            {templates.map((template) => (
              <li key={template.kind} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`kind-${template.kind}`}
                  checked={values.kinds[template.kind]}
                  onChange={(event) =>
                    update({ kinds: { ...values.kinds, [template.kind]: event.target.checked } })
                  }
                  className="mt-1 h-5 w-5 shrink-0 accent-gold-600"
                />
                <label htmlFor={`kind-${template.kind}`} className="text-sm">
                  <span className="font-bold text-midnight-900 dark:text-ivory-100">
                    {template.label}
                  </span>
                  <span className="ms-2 rounded bg-midnight-500/10 px-1.5 py-0.5 text-[10px] font-bold text-midnight-600 dark:text-ivory-300">
                    {template.audience === 'PARENT' ? 'لولي الأمر' : 'للطالب'}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-midnight-500 dark:text-ivory-300/65">
                    {template.description}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80">
            <h3 className="text-sm font-black text-midnight-900 dark:text-ivory-50">
              التقرير الأسبوعي
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-midnight-700 dark:text-ivory-200">
                يوم
                <select
                  value={values.weeklyReport.weekday}
                  onChange={(event) =>
                    update({
                      weeklyReport: { ...values.weeklyReport, weekday: Number(event.target.value) },
                    })
                  }
                  className="input-base mt-1"
                >
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-midnight-700 dark:text-ivory-200">
                الساعة
                <select
                  value={values.weeklyReport.hour}
                  onChange={(event) =>
                    update({
                      weeklyReport: { ...values.weeklyReport, hour: Number(event.target.value) },
                    })
                  }
                  className="input-base mt-1"
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-midnight-700 dark:text-ivory-200 sm:col-span-2">
                يتبعت لأولياء أمور
                <select
                  value={values.weeklyReport.audience}
                  onChange={(event) =>
                    update({
                      weeklyReport: {
                        ...values.weeklyReport,
                        audience: event.target.value as 'paying' | 'all',
                      },
                    })
                  }
                  className="input-base mt-1"
                >
                  <option value="paying">الطلاب المشتركين وطلاب السنتر بس</option>
                  <option value="all">كل الطلاب المسجلين</option>
                </select>
              </label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              isLoading={runWeekly.isPending}
              disabled={Boolean(draft) || values.mode === 'off'}
              onClick={() => runWeekly.mutate()}
            >
              جهّز تقارير الأسبوع دلوقتي
            </Button>
          </div>

          <div className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80">
            <label className="flex items-center gap-3 text-sm font-black text-midnight-900 dark:text-ivory-50">
              <input
                type="checkbox"
                checked={values.quietHours.enabled}
                onChange={(event) =>
                  update({ quietHours: { ...values.quietHours, enabled: event.target.checked } })
                }
                className="h-5 w-5 accent-gold-600"
              />
              متبعتش رسائل بالليل
            </label>
            <p className="mt-1 text-xs leading-5 text-midnight-500 dark:text-ivory-300/65">
              من {hourLabel(values.quietHours.from)} لحد {hourLabel(values.quietHours.to)} الرسائل
              بتستنى للصبح. تذكير اللايف وتأكيد الدفع بيتبعتوا في وقتهم.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="accent"
          isLoading={save.isPending}
          disabled={!draft}
          onClick={() => values && save.mutate(values)}
        >
          حفظ الإعدادات
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
      </div>

      <details className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80">
        <summary className="cursor-pointer text-sm font-black text-midnight-900 dark:text-ivory-50">
          نصوص الرسائل (للتسجيل في WhatsApp Business)
        </summary>
        <p className="mt-2 text-xs leading-6 text-midnight-500 dark:text-ivory-300/65">
          الإرسال الأوتوماتيك بيحتاج كل رسالة تتسجل في WhatsApp Manager بنفس الاسم والنص ونوعها،
          باللغة العربية، وتستنى موافقة Meta.
        </p>
        <ul className="mt-4 space-y-4">
          {templates.map((template) => (
            <li key={template.kind} className="rounded-xl border border-gold-500/15 p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-midnight-900 dark:text-ivory-100">
                {template.label}
                <code dir="ltr" className="rounded bg-midnight-500/10 px-1.5 py-0.5 text-[11px]">
                  {template.name}
                </code>
                <span className="text-[11px] text-midnight-500 dark:text-ivory-300/60">
                  {template.category === 'UTILITY' ? 'Utility' : 'Marketing'}
                </span>
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-ivory-100 p-3 font-sans text-sm leading-7 text-midnight-800 dark:bg-midnight-900 dark:text-ivory-100">
                {template.text}
              </pre>
              <p className="mt-2 text-[11px] text-midnight-500 dark:text-ivory-300/60">
                {template.params.map((param, index) => `{{${index + 1}}} ${param}`).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
