'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber, formatRelative } from '@/lib/utils';
import type { Paginated } from '@/types/api';

interface QueueRow {
  id: string;
  submittedAt: string;
  gradedAt: string | null;
  percentage: number;
  user: { id: string; fullName: string };
  assessment: { id: string; title: string; kind: string };
  essays: number;
  ungraded: number;
}
interface AttemptDetail {
  id: string;
  submittedAt: string;
  needsGrading: boolean;
  score: number;
  maxScore: number;
  percentage: number;
  user: { fullName: string };
  assessment: { title: string };
  essays: Array<{
    questionId: string;
    textAnswer: string;
    pointsAwarded: number;
    feedback: string | null;
    gradedAt: string | null;
    prompt: string;
    imageUrl: string | null;
    modelAnswer: string | null;
    maxPoints: number;
  }>;
}

export function AdminGrading() {
  const [tab, setTab] = useState<'pending' | 'graded'>('pending');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ['admin-grading', tab, page],
    queryFn: () =>
      api.get<Paginated<QueueRow> & { pending: number }>(
        `/admin/grading?status=${tab}&page=${page}`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const totalPages = queue.data
    ? Math.max(1, Math.ceil(queue.data.total / queue.data.pageSize))
    : 1;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
          الأسئلة المقالية
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
          التصحيح
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
          الاختيارات بتتصحح لوحدها. الإجابات المكتوبة بتستناك هنا، وأول ما تصحح آخر سؤال في المحاولة
          النتيجة بتطلع للطالب وبيوصله إشعار.
        </p>
      </header>

      <div className="flex gap-2">
        {(['pending', 'graded'] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setPage(1);
            }}
            className={cn(
              'min-h-10 rounded-xl border px-4 text-sm font-bold transition-colors',
              tab === key
                ? 'border-gold-500 bg-gold-500/15 text-gold-800 dark:text-gold-200'
                : 'border-gold-500/20 text-midnight-600 hover:border-gold-500/50 dark:text-ivory-300',
            )}
          >
            {key === 'pending' ? 'مستني تصحيح' : 'اتصحح'}
            {key === 'pending' && queue.data?.pending ? (
              <span className="ms-2 rounded-full bg-midnight-950/10 px-2 py-0.5 text-[11px] dark:bg-white/10">
                {formatNumber(queue.data.pending)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {queue.isLoading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : !queue.data?.items.length ? (
        <p className="rounded-2xl border border-dashed border-gold-500/30 bg-white p-10 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
          {tab === 'pending' ? 'مفيش حاجة مستنية تصحيح 👌' : 'لسه مفيش محاولات اتصححت.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.data.items.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/20 bg-white p-4 text-start transition-colors hover:border-gold-500/60 dark:bg-midnight-950/75"
              >
                <span className="min-w-0">
                  <span className="block font-black text-midnight-900 dark:text-ivory-50">
                    {row.user.fullName}
                  </span>
                  <span className="mt-0.5 block text-xs text-midnight-500 dark:text-ivory-300/65">
                    {row.assessment.title} · سلّم {formatRelative(row.submittedAt)}
                  </span>
                </span>
                <span className="text-xs font-black">
                  {row.ungraded ? (
                    <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-amber-800 dark:text-amber-300">
                      {formatNumber(row.ungraded)} من {formatNumber(row.essays)} لسه
                    </span>
                  ) : (
                    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                      {formatNumber(row.percentage)}٪
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {queue.data && totalPages > 1 && (
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

      {openId && <GradeDialog attemptId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function GradeDialog({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [grades, setGrades] = useState<Record<string, { points: string; feedback: string }>>({});
  const detail = useQuery({
    queryKey: ['admin-grading-attempt', attemptId],
    queryFn: () => api.get<AttemptDetail>(`/admin/grading/${attemptId}`),
  });
  const save = useMutation({
    mutationFn: () =>
      api.post<{ percentage: number; needsGrading: boolean }>(`/admin/grading/${attemptId}`, {
        grades: (detail.data?.essays ?? []).map((essay) => {
          const draft = grades[essay.questionId];
          return {
            questionId: essay.questionId,
            points: Number(draft?.points ?? essay.pointsAwarded),
            feedback: draft?.feedback ?? essay.feedback ?? undefined,
          };
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-grading'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
      onClose();
    },
  });

  const essays = detail.data?.essays ?? [];
  const valueOf = (questionId: string, fallback: number | null) =>
    grades[questionId]?.points ?? (fallback === null ? '' : String(fallback));
  const complete = essays.every((essay) => {
    const value = valueOf(essay.questionId, essay.gradedAt ? essay.pointsAwarded : null);
    return value !== '' && Number(value) >= 0 && Number(value) <= essay.maxPoints;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تصحيح محاولة"
      className="fixed inset-0 z-50 grid place-items-center bg-midnight-950/75 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#fcfaf4] shadow-2xl dark:bg-midnight-900">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold-500/20 px-5 py-4">
          <div>
            <p className="text-xs font-black text-gold-700 dark:text-gold-300">
              {detail.data?.assessment.title}
            </p>
            <h2 className="font-display text-xl font-black">{detail.data?.user.fullName ?? '…'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-11 w-11 place-items-center rounded-xl border border-midnight-200 text-2xl dark:border-white/15"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {detail.isLoading ? (
            <div className="skeleton h-48 rounded-2xl" />
          ) : (
            essays.map((essay, index) => (
              <article
                key={essay.questionId}
                className="rounded-2xl border border-gold-500/20 bg-white p-4 dark:bg-midnight-950/60"
              >
                <p className="text-xs font-black text-midnight-500 dark:text-ivory-300/60">
                  سؤال مقالي {formatNumber(index + 1)}، من {formatNumber(essay.maxPoints)} درجة
                </p>
                <p className="mt-1 whitespace-pre-line font-bold">{essay.prompt}</p>
                {essay.imageUrl && (
                  <img
                    src={essay.imageUrl}
                    alt="صورة السؤال"
                    className="mt-2 max-h-48 rounded-xl border border-gold-500/20 object-contain"
                  />
                )}
                <div className="mt-3 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
                  <p className="text-xs font-black text-sky-800 dark:text-sky-300">إجابة الطالب</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-7">{essay.textAnswer}</p>
                </div>
                {essay.modelAnswer && (
                  <div className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                      الإجابة النموذجية
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-7">
                      {essay.modelAnswer}
                    </p>
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-black">الدرجة</span>
                    <input
                      type="number"
                      min="0"
                      max={essay.maxPoints}
                      value={valueOf(essay.questionId, essay.gradedAt ? essay.pointsAwarded : null)}
                      onChange={(event) =>
                        setGrades((current) => ({
                          ...current,
                          [essay.questionId]: {
                            points: event.target.value,
                            feedback: current[essay.questionId]?.feedback ?? essay.feedback ?? '',
                          },
                        }))
                      }
                      className="input-base"
                      placeholder={`من ${essay.maxPoints}`}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-black">تعليق للطالب (اختياري)</span>
                    <input
                      value={grades[essay.questionId]?.feedback ?? essay.feedback ?? ''}
                      onChange={(event) =>
                        setGrades((current) => ({
                          ...current,
                          [essay.questionId]: {
                            points:
                              current[essay.questionId]?.points ??
                              (essay.gradedAt ? String(essay.pointsAwarded) : ''),
                            feedback: event.target.value,
                          },
                        }))
                      }
                      maxLength={1000}
                      className="input-base"
                    />
                  </label>
                </div>
              </article>
            ))
          )}
          {save.isError && (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              {save.error instanceof ApiError ? save.error.message : 'تعذر حفظ التصحيح'}
            </p>
          )}
        </div>
        <footer className="flex shrink-0 gap-2 border-t border-gold-500/20 p-4">
          <Button
            type="button"
            variant="accent"
            className="flex-1"
            isLoading={save.isPending}
            disabled={!complete || !essays.length}
            onClick={() => save.mutate()}
          >
            احفظ التصحيح وطلّع النتيجة
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </footer>
      </div>
    </div>
  );
}
