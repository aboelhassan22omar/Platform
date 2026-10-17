'use client';

import { useState } from 'react';
import { cn, pluralizeAr, toArabicDigits } from '@/lib/utils';
import type { ParentReportData } from '@/types/api';

const dayName = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('ar-EG', { weekday: 'short' });
const fullDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
const minutesLabel = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (!minutes) return 'مذاكرش';
  if (minutes < 60) return `${toArabicDigits(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest) return `${toArabicDigits(hours)} س ${toArabicDigits(rest)} د`;
  return hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : `${toArabicDigits(hours)} ساعات`;
};
const periodLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('ar-EG', {
    timeZone: 'Africa/Cairo',
    day: 'numeric',
    month: 'long',
  });

/** Study time per day: one series, so one hue and no legend; values on hover or tap. */
function StudyWeekChart({ days }: { days: ParentReportData['watch']['days'] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...days.map((day) => day.seconds), 1);
  const peak = days.reduce(
    (best, day, index) => (day.seconds > days[best].seconds ? index : best),
    0,
  );
  const shown = active ?? (days[peak].seconds > 0 ? peak : null);

  return (
    <figure className="m-0">
      {/* Bars top out at 80% so the value label above the tallest one has room. */}
      <div className="relative h-44" onMouseLeave={() => setActive(null)}>
        {/* Baseline and one faint midline: recessive, behind the bars. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[var(--report-axis)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-[40%] h-px bg-[var(--report-grid)]" />
        <div className="absolute inset-0 grid grid-cols-7 items-end gap-2">
          {days.map((day, index) => {
            const height = day.seconds ? Math.max(3, (day.seconds / max) * 80) : 0;
            return (
              <button
                key={day.date}
                type="button"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => setActive(index)}
                aria-label={`${fullDay(day.date)}: ${minutesLabel(day.seconds)}`}
                className="relative flex h-full items-end justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--report-bar)]"
              >
                {shown === index && (
                  <span
                    className="absolute bottom-[calc(var(--h)+6px)] whitespace-nowrap rounded-md bg-[var(--report-ink)] px-2 py-1 text-[11px] font-bold text-[var(--report-surface)] shadow"
                    style={{ ['--h' as string]: `${height}%` }}
                  >
                    {minutesLabel(day.seconds)}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    'block w-full max-w-9 rounded-t-[4px] transition-opacity',
                    day.seconds ? 'bg-[var(--report-bar)]' : 'bg-transparent',
                    active !== null && active !== index && 'opacity-50',
                  )}
                  style={{ height: `${height}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div
        aria-hidden
        className="mt-2 grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-[var(--report-muted)]"
      >
        {days.map((day) => (
          <span key={day.date}>{dayName(day.date)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>وقت المذاكرة كل يوم</caption>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{fullDay(day.date)}</th>
              <td>{minutesLabel(day.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--report-line)] bg-[var(--report-surface)] p-4">
      <p className="text-xs font-bold text-[var(--report-muted)]">{label}</p>
      <p className="mt-1 font-display text-2xl font-black text-[var(--report-ink)]">{value}</p>
      {note && <p className="mt-1 text-xs font-semibold text-[var(--report-muted)]">{note}</p>}
    </div>
  );
}

/**
 * The weekly report a parent opens from WhatsApp. Mobile first: most parents
 * read it on a phone. Also used for the admin's preview.
 */
export function ParentReportSummary({ data }: { data: ParentReportData }) {
  const total = data.watch.totalSeconds;
  const previous = data.watch.previousSeconds;
  const trend =
    previous >= 60 && total >= 60
      ? total >= previous
        ? `↑ أكتر من الأسبوع اللي فات (${minutesLabel(previous)})`
        : `↓ أقل من الأسبوع اللي فات (${minutesLabel(previous)})`
      : previous >= 60
        ? `الأسبوع اللي فات: ${minutesLabel(previous)}`
        : undefined;
  const average = data.exams.length
    ? Math.round(data.exams.reduce((sum, exam) => sum + exam.percentage, 0) / data.exams.length)
    : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="وقت المذاكرة" value={minutesLabel(total)} note={trend} />
        <Tile label="أيام ذاكر فيها" value={`${toArabicDigits(data.watch.activeDays)} من ٧`} />
        <Tile
          label="حصص خلّصها"
          value={toArabicDigits(data.lessons.completed.length)}
          note={
            data.lessons.watched
              ? `اتفرّج على ${pluralizeAr(data.lessons.watched, ['حصة واحدة', 'حصتين', 'حصص'])}`
              : undefined
          }
        />
        <Tile
          label="متوسط الامتحانات"
          value={average === null ? '—' : `${toArabicDigits(average)}٪`}
          note={data.exams.length ? `${toArabicDigits(data.exams.length)} امتحان` : 'مفيش امتحانات'}
        />
      </div>

      {data.attendance && (
        <Tile
          label="حضور حصص السنتر"
          value={`${toArabicDigits(data.attendance.attended)} من ${toArabicDigits(data.attendance.held)}`}
          note={
            data.attendance.attended < data.attendance.held
              ? `غاب عن ${pluralizeAr(data.attendance.held - data.attendance.attended, ['حصة واحدة', 'حصتين', 'حصص'])}`
              : 'حضر كل الحصص 👏'
          }
        />
      )}

      <section className="rounded-2xl border border-[var(--report-line)] bg-[var(--report-surface)] p-4">
        <h2 className="text-sm font-black text-[var(--report-ink)]">المذاكرة يوم بيوم</h2>
        <p className="mb-4 text-xs text-[var(--report-muted)]">دوس على أي يوم تشوف وقته</p>
        <StudyWeekChart days={data.watch.days} />
      </section>

      {data.missedHomework.length > 0 && (
        <section className="rounded-2xl border border-[var(--report-warn-line)] bg-[var(--report-warn-bg)] p-4">
          <h2 className="text-sm font-black text-[var(--report-warn-ink)]">
            ⚠️ واجبات متحلّتش ({toArabicDigits(data.missedHomework.length)})
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--report-ink)]">
            {data.missedHomework.map((item) => (
              <li key={`${item.title}-${item.dueAt}`} className="flex justify-between gap-3">
                <span>{item.title}</span>
                <span className="shrink-0 text-xs text-[var(--report-muted)]">
                  كان آخر ميعاد {fullDay(item.dueAt.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.exams.length > 0 && (
        <section className="rounded-2xl border border-[var(--report-line)] bg-[var(--report-surface)] p-4">
          <h2 className="text-sm font-black text-[var(--report-ink)]">
            الامتحانات والواجبات اللي اتحلّت
          </h2>
          <ul className="mt-2 divide-y divide-[var(--report-line)]">
            {data.exams.map((exam, index) => (
              <li
                key={`${exam.title}-${index}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-[var(--report-ink)]">{exam.title}</span>
                <span className="flex shrink-0 items-center gap-1.5 font-bold text-[var(--report-ink)]">
                  {toArabicDigits(exam.percentage)}٪
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px]',
                      exam.passed
                        ? 'bg-[var(--report-good-bg)] text-[var(--report-good-ink)]'
                        : 'bg-[var(--report-warn-bg)] text-[var(--report-warn-ink)]',
                    )}
                  >
                    {exam.passed ? '✓ ناجح' : '✗ محتاج يراجع'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.lessons.completed.length > 0 && (
        <section className="rounded-2xl border border-[var(--report-line)] bg-[var(--report-surface)] p-4">
          <h2 className="text-sm font-black text-[var(--report-ink)]">الحصص اللي خلّصها</h2>
          <ul className="mt-2 space-y-1 text-sm text-[var(--report-ink)]">
            {data.lessons.completed.map((title, index) => (
              <li key={`${title}-${index}`}>✓ {title}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const reportPeriod = (data: ParentReportData) =>
  `من ${periodLabel(data.period.from)} لحد ${periodLabel(new Date(new Date(data.period.to).getTime() - 1).toISOString())}`;

/**
 * Light, print-friendly palette scoped to the report: parents open it from a
 * WhatsApp link, usually on a phone. Follows the site's theme switch; dark is
 * its own set of steps, not an inversion.
 */
const REPORT_TOKENS = `
.parent-report {
  --report-page: #f7f3ea; --report-surface: #ffffff; --report-ink: #1b2233;
  --report-muted: #5d6475; --report-line: #e6dfcf; --report-axis: #b9b2a2;
  --report-grid: #efe9dc; --report-bar: #b7791f;
  --report-warn-bg: #fff4e5; --report-warn-line: #f2c98a; --report-warn-ink: #8a4b08;
  --report-good-bg: #e7f6ec; --report-good-ink: #1d6b3a;
}
html.dark .parent-report {
  --report-page: #0b1120; --report-surface: #121a2c; --report-ink: #f3efe6;
  --report-muted: #a6adbd; --report-line: #24304a; --report-axis: #4a5672;
  --report-grid: #1b2540; --report-bar: #c08530;
  --report-warn-bg: #2a1d0c; --report-warn-line: #6b4513; --report-warn-ink: #f6c47c;
  --report-good-bg: #10291b; --report-good-ink: #8fdcab;
}`;

/** Colour tokens for anything inside an element with the `parent-report` class. */
export function ReportTheme() {
  return <style>{REPORT_TOKENS}</style>;
}
