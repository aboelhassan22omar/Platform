'use client';

import { useQuery } from '@tanstack/react-query';
import { QrCode } from '@/components/ui/qr-code';
import { api } from '@/lib/api';
import { formatDate, formatNumber, pluralizeAr, toArabicDigits } from '@/lib/utils';

interface AttendanceCard {
  token: string;
  fullName: string;
  username: string;
  grade: string | null;
  studentType: 'ONLINE' | 'CENTER';
}
interface AttendanceHistory {
  lastMonth: { held: number; attended: number };
  records: Array<{ title: string; startsAt: string; markedAt: string }>;
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .attendance-card, .attendance-card * { visibility: visible !important; }
  .attendance-card { position: fixed !important; inset: 24px auto auto 24px !important; box-shadow: none !important; }
}`;

/**
 * The student's center pass: a personal QR the assistant scans at the door.
 * The same code works from the phone or printed on a card.
 */
export function MyAttendance() {
  const card = useQuery({
    queryKey: ['attendance-card'],
    queryFn: () => api.get<AttendanceCard>('/attendance/card'),
  });
  const history = useQuery({
    queryKey: ['attendance-mine'],
    queryFn: () => api.get<AttendanceHistory>('/attendance/mine'),
  });

  return (
    <div className="space-y-8">
      <style>{PRINT_CSS}</style>
      <div>
        <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
          كارنيه الحضور
        </h1>
        <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
          لما تروح السنتر، افتح الصفحة دي ووري الكود للمساعد على الباب. حضورك هيتسجل في حسابك ويوصل
          لولي أمرك في التقرير الأسبوعي.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section
          aria-label="الكارنيه"
          className="attendance-card mx-auto w-full max-w-sm rounded-3xl border-2 border-gold-500/40 bg-white p-6 text-center shadow-card"
        >
          {card.isLoading || !card.data ? (
            <div className="skeleton mx-auto h-72 w-56 rounded-2xl" />
          ) : (
            <>
              <p className="text-xs font-black tracking-wide text-gold-700">كارنيه حضور السنتر</p>
              <h2 className="mt-1 font-display text-xl font-black text-midnight-950">
                {card.data.fullName}
              </h2>
              <p className="text-sm text-midnight-500">
                {card.data.grade ? `${card.data.grade}، ` : ''}
                <span dir="ltr">{card.data.username}</span>
              </p>
              <div className="mt-4 flex justify-center">
                <QrCode
                  value={card.data.token}
                  label={`كود حضور ${card.data.fullName}`}
                  size={220}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-midnight-500">
                علّي إضاءة الموبايل عشان الكاميرا تقرأ الكود بسرعة.
              </p>
            </>
          )}
        </section>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!card.data}
            className="min-h-11 rounded-xl border border-gold-500/40 px-4 text-sm font-black text-gold-800 hover:bg-gold-500/10 disabled:opacity-50 dark:text-gold-300"
          >
            اطبع الكارنيه
          </button>

          <section className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80">
            <h2 className="font-display text-base font-extrabold text-midnight-950 dark:text-ivory-50">
              حضورك آخر ٣٠ يوم
            </h2>
            {history.isLoading || !history.data ? (
              <div className="skeleton mt-3 h-10 w-40 rounded-lg" />
            ) : !history.data.lastMonth.held ? (
              <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/70">
                مفيش حصص سنتر لصفك اتسجل فيها حضور آخر ٣٠ يوم.
              </p>
            ) : !history.data.lastMonth.attended ? (
              <p className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-300">
                محضرتش ولا حصة من{' '}
                {pluralizeAr(history.data.lastMonth.held, ['حصة واحدة', 'حصتين', 'حصص'])}.
              </p>
            ) : (
              <p className="mt-2 font-display text-3xl font-black text-gold-700 dark:text-gold-300">
                {toArabicDigits(history.data.lastMonth.attended)}
                <span className="text-base text-midnight-500 dark:text-ivory-300/60">
                  {' '}
                  من {toArabicDigits(history.data.lastMonth.held)} حصة
                </span>
              </p>
            )}
          </section>

          <section
            aria-labelledby="attendance-history"
            className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/80"
          >
            <h2
              id="attendance-history"
              className="font-display text-base font-extrabold text-midnight-950 dark:text-ivory-50"
            >
              الحصص اللي حضرتها
            </h2>
            {!history.data?.records.length ? (
              <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/70">
                لسه مفيش حضور متسجل.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-gold-500/15">
                {history.data.records.map((record, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="font-bold text-midnight-900 dark:text-ivory-100">
                      {record.title}
                    </span>
                    <span className="text-xs text-midnight-500 dark:text-ivory-300/60">
                      {formatDate(record.startsAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {history.data && history.data.records.length > 0 && (
              <p className="mt-2 text-[11px] text-midnight-400">
                آخر {formatNumber(history.data.records.length)} حصة
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
