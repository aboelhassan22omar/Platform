'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { api, ApiError } from '@/lib/api';
import { cn, formatDuration, formatNumber } from '@/lib/utils';
import type { LessonQuestionPage } from '@/types/api';
import type { PlayerController } from '@/features/player/video-player';
import { LIGHT_FIELD, QuestionThread } from './question-thread';

const SORTS = [
  { key: 'new', label: 'الأحدث' },
  { key: 'top', label: 'الأكثر طلبًا' },
  { key: 'mine', label: 'أسئلتي' },
] as const;

/**
 * Questions under the lesson: ask (optionally at the current moment of the
 * video), read the answers to everyone's questions, and mark "same question".
 */
export function LessonQuestions({
  lessonId,
  player,
}: {
  lessonId: string;
  player: React.MutableRefObject<PlayerController | null>;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const focusId = useSearchParams().get('question');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('new');
  const [page, setPage] = useState(1);
  const [body, setBody] = useState('');
  const [atMoment, setAtMoment] = useState(true);
  const [moment, setMoment] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page) });
  if (sort === 'top') params.set('sort', 'top');
  if (sort === 'mine') params.set('filter', 'mine');
  const queryKey = ['lesson-questions', lessonId, params.toString()];
  const questions = useQuery({
    queryKey,
    queryFn: () => api.get<LessonQuestionPage>(`/lessons/${lessonId}/questions?${params}`),
    placeholderData: keepPreviousData,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['lesson-questions', lessonId] });

  const ask = useMutation({
    mutationFn: () =>
      api.post(`/lessons/${lessonId}/questions`, {
        body,
        videoSeconds: atMoment && moment > 0 ? Math.floor(moment) : undefined,
      }),
    onMutate: () => setError(null),
    onSuccess: () => {
      setBody('');
      setSort('new');
      setPage(1);
      refresh();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'حصل خطأ، حاول تاني'),
  });

  // Coming from a notification: bring the answered question into view.
  useEffect(() => {
    if (!focusId || !questions.data) return;
    document
      .getElementById(`question-${focusId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, questions.data]);

  const seek = (seconds: number) => {
    player.current?.seek(seconds);
    document
      .querySelector('[aria-label^="مشغل الفيديو"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const data = questions.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="mt-10" aria-labelledby="questions-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="questions-heading"
            className="font-display text-xl font-extrabold text-midnight-900"
          >
            أسئلة الحصة
          </h2>
          <p className="mt-1 text-sm text-midnight-500">
            مش فاهم حاجة؟ اسأل هنا والمستر هيرد عليك. أسئلة زمايلك وإجاباتها كمان هنا.
          </p>
        </div>
        {data && data.open > 0 && (
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
            {formatNumber(data.open)} سؤال مستني رد
          </span>
        )}
      </div>

      <form
        className="mt-4 rounded-2xl border border-ivory-300 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (body.trim().length >= 3) ask.mutate();
        }}
      >
        <textarea
          value={body}
          onFocus={() => setMoment(player.current?.currentTime() ?? 0)}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="اكتب سؤالك هنا…"
          aria-label="سؤالك"
          className={LIGHT_FIELD}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {moment >= 1 ? (
            <label className="flex items-center gap-2 text-sm font-bold text-midnight-700">
              <input
                type="checkbox"
                checked={atMoment}
                onChange={(event) => setAtMoment(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              سؤالي عن الدقيقة {formatDuration(moment)} من الفيديو
            </label>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={body.trim().length < 3 || ask.isPending || !user}
            className="min-h-11 rounded-xl bg-[var(--accent)] px-5 text-sm font-black text-white transition-opacity disabled:opacity-50"
          >
            {ask.isPending ? 'بنبعت…' : 'ابعت السؤال'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm font-bold text-red-600">
            {error}
          </p>
        )}
      </form>

      <div className="mt-5 flex flex-wrap gap-1" role="tablist" aria-label="ترتيب الأسئلة">
        {SORTS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={sort === item.key}
            onClick={() => {
              setSort(item.key);
              setPage(1);
            }}
            className={cn(
              'min-h-9 rounded-lg px-3 text-sm font-bold transition-colors',
              sort === item.key
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-midnight-500 hover:text-midnight-800',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {questions.isLoading ? (
          <div className="skeleton h-28 rounded-2xl" />
        ) : !data?.items.length ? (
          <p className="rounded-2xl border border-dashed border-ivory-300 bg-white p-8 text-center text-sm text-midnight-500">
            {sort === 'mine' ? 'لسه مسألتش في الحصة دي.' : 'لسه مفيش أسئلة. كن أول واحد يسأل!'}
          </p>
        ) : (
          data.items.map((thread) => (
            <QuestionThread
              key={thread.id}
              thread={thread}
              viewerIsStaff={Boolean(user?.isStaff)}
              highlighted={thread.id === focusId}
              onSeek={seek}
              onChanged={refresh}
            />
          ))
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="min-h-10 rounded-xl border border-ivory-300 px-4 font-bold disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-xs text-midnight-500">
            صفحة {formatNumber(page)} من {formatNumber(totalPages)}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-10 rounded-xl border border-ivory-300 px-4 font-bold disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </section>
  );
}
