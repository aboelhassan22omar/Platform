'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { LeaderboardResponse, LeaderboardStudent } from '@/types/api';

const rankStyle = [
  'border-amber-400/50 bg-amber-400/10',
  'border-slate-400/50 bg-slate-400/10',
  'border-orange-500/40 bg-orange-500/10',
];

export function StudentLeaderboard() {
  const { user } = useAuth();
  const leaderboard = useQuery({
    queryKey: ['leaderboard', user?.gradeLevel],
    queryFn: () => api.get<LeaderboardResponse>('/leaderboard'),
    enabled: Boolean(user?.gradeLevel),
  });

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
            لوحة الشرف
          </p>
          <h1 className="mt-1 font-display text-3xl font-black">متصدرو المنصة</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
            أعلى 10 طلاب حسب تقدم الفيديوهات، إكمال الدروس، ونتائج الواجبات والامتحانات.
          </p>
        </div>
        <span className="rounded-xl border border-gold-500/25 bg-gold-500/10 px-4 py-2 text-sm font-black text-gold-800 dark:text-gold-300">
          ترتيب صفك فقط
        </span>
      </header>

      {leaderboard.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : leaderboard.isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-bold text-red-700 dark:text-red-300"
        >
          تعذر تحميل ترتيب الطلاب. حاول مرة أخرى.
        </div>
      ) : (
        <>
          {leaderboard.data?.currentStudent && (
            <section
              className="rounded-2xl border border-gold-500/35 bg-gradient-to-l from-gold-500/15 to-transparent p-5"
              aria-label="ترتيبك"
            >
              <p className="text-xs font-bold text-midnight-600 dark:text-ivory-300/70">
                ترتيبك في صفك
              </p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <p className="font-display text-3xl font-black">
                  #{formatNumber(leaderboard.data.currentStudent.rank)}
                </p>
                <p className="font-display text-2xl font-black text-gold-700 dark:text-gold-300">
                  {formatNumber(leaderboard.data.currentStudent.totalPoints)} نقطة
                </p>
              </div>
            </section>
          )}

          {leaderboard.data?.topStudents.length ? (
            <section className="space-y-3" aria-label="أفضل عشرة طلاب">
              {leaderboard.data.topStudents.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  isCurrent={student.id === user?.id}
                />
              ))}
            </section>
          ) : (
            <div className="rounded-3xl border border-dashed border-gold-500/30 px-6 py-14 text-center">
              <h2 className="font-display text-xl font-black">لسه مفيش نقاط في الصف ده</h2>
              <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/65">
                الترتيب هيظهر بمجرد ما الطلاب يبدأوا الدروس والتقييمات.
              </p>
            </div>
          )}

          <section className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/75">
            <h2 className="font-display text-lg font-black">النقاط بتتحسب إزاي؟</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Rule title="تقدم الفيديو" text="حتى 100 نقطة لكل فيديو حسب أبعد نسبة وصلت لها." />
              <Rule title="إكمال الفيديو" text="25 نقطة إضافية عند إكمال الفيديو." />
              <Rule title="الواجب" text="أفضل درجة في الواجب، بحد أقصى 100 نقطة." />
              <Rule title="امتحان الدرس" text="أفضل درجة مضروبة في 1.5." />
              <Rule title="امتحان الوحدة" text="أفضل درجة مضروبة في 2." />
              <Rule title="إكمال التقييم" text="10 نقاط عند تسليم كل واجب أو امتحان." />
            </div>
            <p className="mt-4 text-xs leading-6 text-midnight-500 dark:text-ivory-300/60">
              إعادة الفيديو أو تكرار محاولات التقييم لا تضاعف النقاط؛ يُحسب أبعد تقدم وأفضل محاولة
              فقط.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function StudentRow({ student, isCurrent }: { student: LeaderboardStudent; isCurrent: boolean }) {
  return (
    <article
      className={cn(
        'grid gap-4 rounded-2xl border bg-white p-4 shadow-card dark:bg-midnight-950/75 sm:grid-cols-[auto_1fr_auto] sm:items-center',
        isCurrent
          ? 'border-gold-500 ring-2 ring-gold-500/15'
          : student.rank <= 3
            ? rankStyle[student.rank - 1]
            : 'border-gold-500/20',
      )}
    >
      <div
        className="grid h-12 w-12 place-items-center rounded-full border border-gold-500/30 font-display text-lg font-black"
        aria-label={`الترتيب ${student.rank}`}
      >
        #{formatNumber(student.rank)}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-black">{student.fullName}</h2>
          {isCurrent && (
            <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-black text-gold-700 dark:text-gold-300">
              أنت
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-midnight-500 dark:text-ivory-300/65">
          <span>فيديوهات: {formatNumber(student.videoPoints)}</span>
          <span>واجبات: {formatNumber(student.homeworkPoints)}</span>
          <span>امتحانات: {formatNumber(student.examPoints)}</span>
          <span>إكمال: {formatNumber(student.completionPoints)}</span>
        </div>
      </div>
      <div className="sm:text-left">
        <p className="font-display text-2xl font-black text-gold-700 dark:text-gold-300">
          {formatNumber(student.totalPoints)}
        </p>
        <p className="text-xs font-bold text-midnight-500 dark:text-ivory-300/60">نقطة</p>
      </div>
    </article>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-gold-500/5 p-3">
      <h3 className="font-black text-gold-800 dark:text-gold-300">{title}</h3>
      <p className="mt-1 leading-6 text-midnight-600 dark:text-ivory-300/70">{text}</p>
    </div>
  );
}
