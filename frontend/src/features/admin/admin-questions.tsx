'use client';

import Link from 'next/link';
import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { LessonQuestionPage } from '@/types/api';
import { QuestionThread } from '@/features/questions/question-thread';

const TABS = [
  { key: 'open', label: 'مستني رد' },
  { key: 'answered', label: 'اتجاوب' },
  { key: 'hidden', label: 'مخفي' },
  { key: 'all', label: 'الكل' },
] as const;

interface CurriculumCourse {
  id: string;
  title: string;
  grade: { nameAr: string };
}

/**
 * Everything students asked under lessons, for the teacher and assistants.
 * Unanswered questions come first, the most wanted ("same question") on top.
 */
export function AdminQuestions() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof TABS)[number]['key']>('open');
  const [courseId, setCourseId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ status, page: String(page) });
  if (courseId) params.set('courseId', courseId);
  if (search.trim()) params.set('search', search.trim());
  const questions = useQuery({
    queryKey: ['admin-lesson-questions', params.toString()],
    queryFn: () => api.get<LessonQuestionPage>(`/admin/lesson-questions?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const courses = useQuery({
    queryKey: ['assessment-curriculum'],
    queryFn: () => api.get<CurriculumCourse[]>('/admin/assessments/curriculum'),
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-lesson-questions'] });
  const data = questions.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
          تحت كل حصة
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
          أسئلة الطلاب
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
          ردك بيظهر لكل طلاب الحصة، والطالب اللي سأل وكل اللي عندهم نفس السؤال بيوصلهم إشعار.
          الأسئلة اللي عليها «عندي نفس السؤال» كتير بتطلع فوق.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={status === tab.key}
            onClick={() => {
              setStatus(tab.key);
              setPage(1);
            }}
            className={cn(
              'min-h-10 rounded-xl border px-4 text-sm font-bold transition-colors',
              status === tab.key
                ? 'border-gold-500 bg-gold-500/15 text-gold-800 dark:text-gold-200'
                : 'border-gold-500/20 text-midnight-600 hover:border-gold-500/50 dark:text-ivory-300',
            )}
          >
            {tab.label}
            {tab.key === 'open' && data?.open ? (
              <span className="ms-2 rounded-full bg-midnight-950/10 px-2 py-0.5 text-[11px] dark:bg-white/10">
                {formatNumber(data.open)}
              </span>
            ) : null}
          </button>
        ))}
        <div className="flex w-full flex-wrap gap-2 sm:ms-auto sm:w-auto">
          <div className="w-full sm:w-56">
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setPage(1);
              }}
              aria-label="الكورس"
              className="input-base h-10 py-0"
            >
              <option value="">كل الكورسات</option>
              {courses.data?.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.grade.nameAr} · {course.title}
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
              placeholder="السؤال، الطالب أو الحصة"
              aria-label="بحث في الأسئلة"
              className="input-base h-10 py-0"
            />
          </div>
        </div>
      </div>

      {questions.isLoading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : !data?.items.length ? (
        <p className="rounded-2xl border border-dashed border-gold-500/30 bg-white p-10 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
          {status === 'open' ? 'مفيش أسئلة مستنية رد 👌' : 'مفيش أسئلة هنا.'}
        </p>
      ) : (
        <div className="space-y-3">
          {data.items.map((thread) => (
            <QuestionThread
              key={thread.id}
              thread={thread}
              viewerIsStaff
              adaptive
              onChanged={refresh}
              header={
                thread.lesson && (
                  <p className="mb-2 text-xs font-bold text-gold-800 dark:text-gold-300">
                    {thread.lesson.courseTitle} ·{' '}
                    <Link
                      href={`/lessons/${thread.lesson.id}?question=${thread.id}`}
                      target="_blank"
                      className="underline-offset-4 hover:underline"
                    >
                      {thread.lesson.title}
                    </Link>
                  </p>
                )
              }
            />
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
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
    </div>
  );
}
