'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn, toArabicDigits } from '@/lib/utils';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { formatLiveDate, useCountdown } from '@/features/live/countdown';
import type { AdminLiveSession, EducationSystemSummary, LiveSessionStatus } from '@/types/api';
import { LiveRecordings } from './live-recordings';

interface FormState {
  id?: string;
  title: string;
  description: string;
  gradeId: string;
  scheduledAt: string;
  recordingEnabled: boolean;
}

const blankForm = (): FormState => ({
  title: '',
  description: '',
  gradeId: '',
  scheduledAt: '',
  recordingEnabled: false,
});

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const STATUS: Record<LiveSessionStatus, { label: string; className: string }> = {
  LIVE: { label: 'مباشر الآن', className: 'bg-red-600 text-white' },
  SCHEDULED: { label: 'مجدول', className: 'bg-gold-500/15 text-gold-700 dark:text-gold-300' },
  ENDED: { label: 'خلص', className: 'bg-midnight-500/10 text-midnight-600 dark:text-ivory-300/70' },
  CANCELLED: { label: 'اتلغى', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

function TimeLeft({ iso }: { iso: string }) {
  const parts = useCountdown(iso);
  if (!parts) return null;
  if (parts.done)
    return <span className="font-bold text-red-600 dark:text-red-400">ميعاده جه</span>;
  const chunks = [
    parts.days && `${parts.days} يوم`,
    parts.hours && `${parts.hours} ساعة`,
    `${parts.minutes} دقيقة`,
  ].filter(Boolean);
  return <span>باقي {toArabicDigits(chunks.join(' و'))}</span>;
}

export function AdminLive() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(blankForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminLiveSession | null>(null);

  const list = useQuery({
    queryKey: ['admin-live'],
    queryFn: () => api.get<{ streamingReady: boolean; items: AdminLiveSession[] }>('/admin/live'),
    // Poll faster while a recording is still being finalised.
    refetchInterval: (query) =>
      query.state.data?.items.some((s) =>
        s.recordings.some((r) => r.status === 'RECORDING' || r.status === 'PROCESSING'),
      )
        ? 8_000
        : 30_000,
  });
  const systems = useQuery({
    queryKey: ['academic-systems'],
    queryFn: () => api.get<EducationSystemSummary[]>('/academic/systems'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-live'] });

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const payload = {
        title: state.title.trim(),
        description: state.description.trim(),
        gradeId: state.gradeId,
        scheduledAt: new Date(state.scheduledAt).toISOString(),
        recordingEnabled: state.recordingEnabled,
      };
      return state.id
        ? api.patch(`/admin/live/${state.id}`, payload)
        : api.post('/admin/live', payload);
    },
    onSuccess: async (_data, state) => {
      setNotice(
        state.id
          ? 'اتعدّل اللايف.'
          : 'اتجدول اللايف، وطلبة الصف وصلهم إشعار وهيشوفوا العداد في صفحتهم.',
      );
      setForm(blankForm());
      await refresh();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : 'مقدرناش نحفظ اللايف'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/admin/live/${id}/cancel`),
    onSuccess: async () => {
      setCancelTarget(null);
      setNotice('اتلغى اللايف.');
      await refresh();
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    if (form.title.trim().length < 3) return setFormError('اكتب عنوان للايف (٣ حروف على الأقل).');
    if (!form.gradeId) return setFormError('اختار الصف اللي اللايف ليه.');
    if (!form.scheduledAt) return setFormError('حدد يوم وساعة اللايف.');
    if (!form.id && new Date(form.scheduledAt).getTime() < Date.now() - 60_000) {
      return setFormError('الميعاد ده فات، اختار ميعاد جاي.');
    }
    save.mutate(form);
  };

  const groups = useMemo(() => {
    const items = list.data?.items ?? [];
    return {
      live: items.filter((s) => s.status === 'LIVE'),
      upcoming: items
        .filter((s) => s.status === 'SCHEDULED')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
      past: items.filter((s) => s.status === 'ENDED' || s.status === 'CANCELLED'),
    };
  }, [list.data]);

  const card =
    'rounded-2xl border border-gold-500/25 bg-white p-5 shadow-card dark:bg-midnight-950/80';

  const renderSession = (session: AdminLiveSession) => (
    <li key={session.id} className={card}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-black',
                STATUS[session.status].className,
              )}
            >
              {STATUS[session.status].label}
            </span>
            <span className="text-xs font-bold text-midnight-500 dark:text-ivory-300/70">
              {session.grade.shortNameAr}
            </span>
            {session.recordingEnabled && session.status !== 'CANCELLED' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-1.5 py-0.5 text-[11px] font-black text-red-600 dark:text-red-400">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {session.status === 'SCHEDULED'
                  ? 'هيتسجّل'
                  : session.status === 'LIVE'
                    ? 'بيتسجّل'
                    : 'اتسجّل'}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 truncate font-display text-base font-black text-midnight-950 dark:text-ivory-50">
            {session.title}
          </h3>
          <p className="mt-0.5 text-sm text-midnight-600 dark:text-ivory-300/75">
            {formatLiveDate(session.scheduledAt)}
            {session.status === 'SCHEDULED' && (
              <span className="ms-2 text-xs text-gold-700 dark:text-gold-300">
                · <TimeLeft iso={session.scheduledAt} />
              </span>
            )}
          </p>
          {session.endReason === 'HOST_LEFT' && (
            <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              اتقفل لوحده لأن المستر خرج ومرجعش
            </p>
          )}
          {session.status === 'ENDED' && (
            <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/70">
              {toArabicDigits(String(session.counts.messages))} رسالة ·{' '}
              {toArabicDigits(String(session.counts.reactions))} رياكت
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {session.status === 'LIVE' && (
            <>
              <ButtonLink href={`/live/${session.id}`} variant="danger" size="sm">
                ارجع للبث
              </ButtonLink>
              <ButtonLink href={`/admin/live/${session.id}/participants`} size="sm">
                الحاضرين
              </ButtonLink>
            </>
          )}
          {session.status === 'SCHEDULED' && (
            <>
              <ButtonLink href={`/live/${session.id}`} variant="accent" size="sm">
                ادخل الاستوديو
              </ButtonLink>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNotice(null);
                  setFormError(null);
                  setForm({
                    id: session.id,
                    title: session.title,
                    description: session.description ?? '',
                    gradeId: session.grade.id,
                    scheduledAt: toLocalInput(session.scheduledAt),
                    recordingEnabled: session.recordingEnabled,
                  });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                تعديل
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 dark:text-red-400"
                onClick={() => setCancelTarget(session)}
              >
                إلغاء
              </Button>
            </>
          )}
        </div>
      </div>

      {session.recordings.length > 0 && (
        <LiveRecordings
          title={session.title}
          recordings={session.recordings}
          onChanged={() => void refresh()}
        />
      )}
    </li>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
          اللايف
        </h1>
        <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/75">
          حدد ميعاد اللايف والصف، والطلبة هيشوفوا عداد تنازلي في صفحتهم لحد ما تبدأ.
        </p>
      </div>

      {list.data && !list.data.streamingReady && (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm font-bold leading-relaxed text-amber-800 dark:text-amber-300">
          البث لسه مش متفعّل: تقدر تجدول لايفات دلوقتي، بس علشان تطلع على الهوا لازم مفاتيح LiveKit
          (LIVEKIT_URL و LIVEKIT_API_KEY و LIVEKIT_API_SECRET) تتحط في ملف ‎.env على السيرفر.
        </p>
      )}

      <form onSubmit={submit} className={cn(card, 'space-y-4')} noValidate>
        <h2 className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
          {form.id ? 'تعديل اللايف' : 'جدولة لايف جديد'}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="live-title" className="editor-label field-required">
              عنوان اللايف
            </label>
            <input
              id="live-title"
              className="editor-input"
              value={form.title}
              maxLength={140}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: مراجعة الوحدة الأولى — ثورة ١٩١٩"
            />
          </div>
          <div>
            <label htmlFor="live-grade" className="editor-label field-required">
              الصف
            </label>
            <select
              id="live-grade"
              className="editor-input"
              value={form.gradeId}
              onChange={(e) => setForm({ ...form, gradeId: e.target.value })}
            >
              <option value="">اختار الصف</option>
              {systems.data?.map((system) => (
                <optgroup key={system.key} label={system.nameAr}>
                  {system.grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.nameAr}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="live-when" className="editor-label field-required">
              اليوم والساعة
            </label>
            <DateTimePicker
              id="live-when"
              disablePast
              value={form.scheduledAt}
              onChange={(scheduledAt) => setForm({ ...form, scheduledAt })}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="live-desc" className="editor-label">
              وصف قصير (اختياري)
            </label>
            <textarea
              id="live-desc"
              className="editor-input min-h-24 py-3"
              value={form.description}
              maxLength={1000}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="هنراجع إيه في اللايف ده؟"
            />
          </div>
          <label
            htmlFor="live-record"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-gold-500/25 p-4 md:col-span-2"
          >
            <input
              id="live-record"
              type="checkbox"
              checked={form.recordingEnabled}
              onChange={(e) => setForm({ ...form, recordingEnabled: e.target.checked })}
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-black text-midnight-900 dark:text-ivory-100">
                سجّل اللايف
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-midnight-600 dark:text-ivory-300/75">
                الكاميرا والشاشة والصوت هيتسجلوا ويتحفظوا مع باقي الفيديوهات، وهتلاقي التسجيل هنا
                بعد ما اللايف يخلص. لو خرجت من غير ما تنهي اللايف، التسجيل بيقف عند اللحظة اللي خرجت
                فيها.
              </span>
            </span>
          </label>
        </div>

        {formError && (
          <p role="alert" className="text-sm font-bold text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {notice}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="accent" isLoading={save.isPending}>
            {form.id ? 'احفظ التعديل' : 'جدول اللايف'}
          </Button>
          {form.id && (
            <Button type="button" variant="ghost" onClick={() => setForm(blankForm())}>
              إلغاء التعديل
            </Button>
          )}
        </div>
      </form>

      {list.isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      ) : (
        <>
          {groups.live.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-black text-red-600 dark:text-red-400">
                على الهوا دلوقتي
              </h2>
              <ul className="space-y-3">{groups.live.map(renderSession)}</ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
              اللايفات الجاية
            </h2>
            {groups.upcoming.length ? (
              <ul className="space-y-3">{groups.upcoming.map(renderSession)}</ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-gold-500/30 p-6 text-center text-sm text-midnight-500 dark:text-ivory-300/70">
                مفيش لايفات مجدولة. جدول أول لايف من الفورم اللي فوق.
              </p>
            )}
          </section>

          {groups.past.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
                اللي فاتت
              </h2>
              <ul className="space-y-3 opacity-90">
                {groups.past.slice(0, 20).map(renderSession)}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="تلغي اللايف ده؟"
        body={cancelTarget ? `«${cancelTarget.title}» هيختفي من صفحات الطلبة.` : ''}
        confirmLabel="أيوه، الغيه"
        cancelLabel="لا"
        destructive
        isPending={cancel.isPending}
        onConfirm={() => cancelTarget && cancel.mutate(cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
