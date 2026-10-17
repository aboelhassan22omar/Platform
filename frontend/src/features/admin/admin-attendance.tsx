'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber, formatRelative } from '@/lib/utils';
import type { Grade } from '@/types/api';
import { QrScanner } from './qr-scanner';

interface SessionRow {
  id: string;
  title: string;
  startsAt: string;
  closedAt: string | null;
  present: number;
  grade: { id: string; nameAr: string };
}
interface SessionDetail {
  id: string;
  title: string;
  startsAt: string;
  closedAt: string | null;
  absenceNotifiedAt: string | null;
  grade: { id: string; nameAr: string };
  present: Array<{
    id: string;
    fullName: string;
    phone: string;
    studentType: string;
    method: 'SCAN' | 'MANUAL';
    markedAt: string;
  }>;
  absent: Array<{ id: string; fullName: string; phone: string }>;
}
type ScanResult =
  | { status: 'marked' | 'already'; student: { id: string; fullName: string } }
  | { status: 'wrong_grade'; student: { id: string; fullName: string; grade: string | null } }
  | { status: 'invalid' };

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;
const dateTime = (value: string) =>
  new Date(value).toLocaleString('ar-EG', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
const toLocalInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function AdminAttendance() {
  const [openId, setOpenId] = useState<string | null>(null);
  return openId ? (
    <SessionView id={openId} onBack={() => setOpenId(null)} />
  ) : (
    <SessionList onOpen={setOpenId} />
  );
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

function SessionList({ onOpen }: { onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date()));
  const grades = useQuery({
    queryKey: ['academic-grades'],
    queryFn: () => api.get<Grade[]>('/academic/grades'),
  });
  const sessions = useQuery({
    queryKey: ['admin-attendance-sessions'],
    queryFn: () => api.get<SessionRow[]>('/admin/attendance/sessions'),
  });
  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/admin/attendance/sessions', {
        title,
        gradeId,
        startsAt: new Date(startsAt).toISOString(),
      }),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-attendance-sessions'] });
      setTitle('');
      onOpen(session.id);
    },
  });

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
          طلاب السنتر
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
          الحضور
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
          اعمل حصة، وافتح الكاميرا على موبايل المساعد عند الباب، وكل طالب يوري «كارنيه الحضور» من
          حسابه أو مطبوع. الحضور بيتسجل في حسابه وفي تقرير ولي أمره، وتقدر تبعت لأولياء أمور
          الغايبين.
        </p>
      </header>

      <form
        className="grid gap-3 rounded-2xl border border-gold-500/25 bg-white p-5 dark:bg-midnight-950/80 sm:grid-cols-[minmax(0,1fr)_14rem_14rem_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-black">اسم الحصة</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثلًا: حصة السبت - الوحدة الأولى"
            className="input-base"
            required
            minLength={2}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black">الصف</span>
          <select
            value={gradeId}
            onChange={(event) => setGradeId(event.target.value)}
            className="input-base"
            required
          >
            <option value="">اختار الصف</option>
            {grades.data?.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black">الميعاد</span>
          <DateTimePicker
            className="input-base"
            value={startsAt}
            onChange={setStartsAt}
            placeholder="الميعاد"
          />
        </label>
        <Button
          type="submit"
          variant="accent"
          isLoading={create.isPending}
          disabled={!gradeId || title.trim().length < 2}
        >
          ابدأ الحصة
        </Button>
        {create.isError && (
          <p role="alert" className="text-sm font-bold text-red-600 sm:col-span-4">
            {errorText(create.error, 'تعذر إنشاء الحصة')}
          </p>
        )}
      </form>

      {sessions.isLoading ? (
        <div className="skeleton h-32 rounded-2xl" />
      ) : !sessions.data?.length ? (
        <p className="rounded-2xl border border-dashed border-gold-500/30 bg-white p-10 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
          لسه مفيش حصص. ابدأ أول حصة من فوق.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.data.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onOpen(session.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/20 bg-white p-4 text-start transition-colors hover:border-gold-500/60 dark:bg-midnight-950/75"
              >
                <span className="min-w-0">
                  <span className="block font-black text-midnight-900 dark:text-ivory-50">
                    {session.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-midnight-500 dark:text-ivory-300/65">
                    {session.grade.nameAr}، {dateTime(session.startsAt)}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs font-black">
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                    {formatNumber(session.present)} حاضر
                  </span>
                  <span
                    className={cn(
                      'rounded-lg px-2.5 py-1',
                      session.closedAt
                        ? 'bg-midnight-500/10'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
                    )}
                  >
                    {session.closedAt ? 'اتقفلت' : 'مفتوحة'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One class: scanner, present, absent
// ---------------------------------------------------------------------------

const RESULT_STYLES: Record<ScanResult['status'], string> = {
  marked: 'bg-emerald-600 text-white',
  already: 'bg-sky-600 text-white',
  wrong_grade: 'bg-amber-500 text-midnight-950',
  invalid: 'bg-red-600 text-white',
};

/** A short beep so the assistant knows a scan landed without looking. */
function beep(ok: boolean) {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    oscillator.frequency.value = ok ? 880 : 220;
    oscillator.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
    navigator.vibrate?.(ok ? 80 : [60, 60, 60]);
  } catch {
    // Audio is a nicety.
  }
}

function SessionView({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const busyRef = useRef(false);
  const queryKey = ['admin-attendance-session', id];
  const detail = useQuery({
    queryKey,
    queryFn: () => api.get<SessionDetail>(`/admin/attendance/sessions/${id}`),
    refetchInterval: scanning ? 5000 : false,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ['admin-attendance-sessions'] });
  };

  const onCode = useCallback(
    async (token: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const scanned = await api.post<ScanResult>(`/admin/attendance/sessions/${id}/scan`, {
          token,
        });
        setResult(scanned);
        beep(scanned.status === 'marked' || scanned.status === 'already');
        if (scanned.status === 'marked')
          void queryClient.invalidateQueries({ queryKey: ['admin-attendance-session', id] });
      } catch (caught) {
        setError(errorText(caught, 'تعذر تسجيل الحضور'));
      } finally {
        busyRef.current = false;
      }
    },
    [id, queryClient],
  );
  const manual = useMutation({
    mutationFn: (userId: string) =>
      api.post<ScanResult>(`/admin/attendance/sessions/${id}/manual`, { userId }),
    onSuccess: (scanned) => {
      setResult(scanned);
      refresh();
    },
    onError: (caught) => setError(errorText(caught, 'تعذر تسجيل الحضور')),
  });
  const unmark = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/admin/attendance/sessions/${id}/records/${userId}`),
    onSuccess: refresh,
    onError: (caught) => setError(errorText(caught, 'تعذر الإلغاء')),
  });
  const close = useMutation({
    mutationFn: () =>
      api.post<{ notified: number }>(`/admin/attendance/sessions/${id}/close`, {
        notifyParents: notify,
      }),
    onSuccess: (closed) => {
      setScanning(false);
      setError(null);
      setResult(null);
      setNotice(
        closed.notified
          ? `اتقفلت الحصة، واتجهز ${formatNumber(closed.notified)} رسالة غياب لأولياء الأمور في «واتساب».`
          : 'اتقفلت الحصة.',
      );
      refresh();
    },
    onError: (caught) => setError(errorText(caught, 'تعذر قفل الحصة')),
  });
  const reopen = useMutation({
    mutationFn: () => api.post(`/admin/attendance/sessions/${id}/reopen`),
    onSuccess: refresh,
  });

  const data = detail.data;
  if (detail.isLoading || !data) return <div className="skeleton h-96 rounded-2xl" />;
  const closed = Boolean(data.closedAt);
  const term = filter.trim();
  const absent = data.absent.filter(
    (student) => !term || student.fullName.includes(term) || student.phone.includes(term),
  );

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-bold text-gold-700 dark:text-gold-300"
      >
        → كل الحصص
      </button>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-midnight-500 dark:text-ivory-300/60">
            {data.grade.nameAr}، {dateTime(data.startsAt)}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black">{data.title}</h1>
          <p className="mt-2 text-sm font-bold">
            <span className="text-emerald-700 dark:text-emerald-300">
              {formatNumber(data.present.length)} حاضر
            </span>
            <span className="text-midnight-500 dark:text-ivory-300/60">
              ، و{formatNumber(data.absent.length)} غايب من طلاب السنتر
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/attendance/sessions/${id}/export`}
            className="inline-flex min-h-11 items-center rounded-xl border border-gold-500/40 px-4 text-sm font-black text-gold-800 hover:bg-gold-500/10 dark:text-gold-300"
          >
            نزّل شيت Excel
          </a>
          {closed ? (
            <Button
              type="button"
              variant="outline"
              isLoading={reopen.isPending}
              onClick={() => reopen.mutate()}
            >
              افتح الحصة تاني
            </Button>
          ) : (
            <Button
              type="button"
              variant={scanning ? 'outline' : 'accent'}
              onClick={() => setScanning((value) => !value)}
            >
              {scanning ? 'اقفل الكاميرا' : 'افتح الكاميرا وسجّل'}
            </Button>
          )}
        </div>
      </header>

      {scanning && !closed && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <QrScanner onCode={(text) => void onCode(text)} />
          <div
            aria-live="assertive"
            className="flex min-h-40 flex-col justify-center rounded-2xl border border-gold-500/20 bg-white p-6 text-center dark:bg-midnight-950/80"
          >
            {!result ? (
              <p className="text-sm text-midnight-500 dark:text-ivory-300/70">
                وجّه الكاميرا على كارنيه الطالب…
              </p>
            ) : (
              <div className={cn('rounded-2xl p-6', RESULT_STYLES[result.status])}>
                <p className="font-display text-2xl font-black">
                  {result.status === 'invalid' ? 'كود مش صالح' : result.student.fullName}
                </p>
                <p className="mt-1 text-sm font-bold">
                  {result.status === 'marked'
                    ? '✓ اتسجل حضوره'
                    : result.status === 'already'
                      ? 'متسجل قبل كده'
                      : result.status === 'wrong_grade'
                        ? `مش من الصف ده${result.student.grade ? ` (${result.student.grade})` : ''}`
                        : 'الكود ده مش كارنيه حضور من المنصة'}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80">
          <h2 className="font-display text-lg font-black">
            الحاضرين ({formatNumber(data.present.length)})
          </h2>
          {!data.present.length ? (
            <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/70">لسه محدش اتسجل.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gold-500/15">
              {data.present.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{student.fullName}</span>
                    <span className="text-xs text-midnight-500 dark:text-ivory-300/60">
                      {formatRelative(student.markedAt)}،{' '}
                      {student.method === 'SCAN' ? 'بالكود' : 'يدوي'}
                      {student.studentType === 'ONLINE' ? '، طالب أونلاين' : ''}
                    </span>
                  </span>
                  {!closed && (
                    <button
                      type="button"
                      onClick={() => unmark.mutate(student.id)}
                      className="min-h-9 rounded-lg px-2.5 text-xs font-bold text-midnight-500 hover:bg-midnight-500/10 dark:text-ivory-300/65"
                    >
                      إلغاء
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-black">
              الغايبين من طلاب السنتر ({formatNumber(data.absent.length)})
            </h2>
            <div className="w-full sm:w-48">
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="دوّر بالاسم أو الرقم"
                aria-label="بحث في الغايبين"
                className="input-base h-9 py-0"
              />
            </div>
          </div>
          {!absent.length ? (
            <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/70">
              {data.absent.length ? 'مفيش نتايج.' : 'كل طلاب السنتر حضروا 👏'}
            </p>
          ) : (
            <ul className="mt-3 max-h-96 divide-y divide-gold-500/15 overflow-y-auto">
              {absent.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">{student.fullName}</span>
                    <span dir="ltr" className="text-xs text-midnight-500 dark:text-ivory-300/60">
                      {student.phone}
                    </span>
                  </span>
                  {!closed && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      isLoading={manual.isPending && manual.variables === student.id}
                      onClick={() => manual.mutate(student.id)}
                    >
                      حضر
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {!closed ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/25 bg-white p-5 dark:bg-midnight-950/80">
          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              className="h-5 w-5 accent-gold-600"
            />
            ابعت رسالة واتساب لأولياء أمور الغايبين ({formatNumber(data.absent.length)})
          </label>
          <Button
            type="button"
            variant="accent"
            isLoading={close.isPending}
            onClick={() => {
              if (window.confirm('تقفل الحصة؟ مش هتقدر تسجل حضور بعدها إلا لو فتحتها تاني.'))
                close.mutate();
            }}
          >
            خلّصت الحصة، اقفلها
          </Button>
        </section>
      ) : (
        <p className="rounded-2xl border border-gold-500/20 bg-white p-4 text-sm font-bold text-midnight-600 dark:bg-midnight-950/80 dark:text-ivory-300/75">
          الحصة اتقفلت {formatRelative(data.closedAt!)}.
          {data.absenceNotifiedAt ? ' رسائل الغياب اتجهزت لأولياء الأمور في «واتساب».' : ''}
        </p>
      )}
    </div>
  );
}
