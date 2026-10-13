'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AdminCourseDetail, AdminCourseSummary } from './admin-content.types';

type Mode = 'new' | 'existing';

const field =
  'mt-1 block min-h-11 w-full rounded-xl border-2 border-ivory-300 bg-white px-3 text-sm text-midnight-900 focus:border-gold-500 focus:outline-none dark:border-midnight-700 dark:bg-midnight-900 dark:text-ivory-50';
const labelClass = 'block text-sm font-bold text-midnight-800 dark:text-ivory-100';

/**
 * Publishes a live recording as a lesson video: either a new lesson in a
 * chapter, or replacing the video of an existing lesson. The file is copied
 * and transcoded like any upload, so students watch it in the normal player.
 */
export function PublishRecordingDialog({
  recordingId,
  sessionTitle,
  gradeId,
  onClose,
  onPublished,
}: {
  recordingId: string;
  sessionTitle: string;
  gradeId: string;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [mode, setMode] = useState<Mode>('new');
  const [courseId, setCourseId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState(sessionTitle);
  const [price, setPrice] = useState('');
  const [free, setFree] = useState(false);
  const [publishNow, setPublishNow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const courses = useQuery({
    queryKey: ['admin-courses', gradeId],
    queryFn: () =>
      api.get<AdminCourseSummary[]>(
        `/admin/content/courses?gradeId=${encodeURIComponent(gradeId)}`,
      ),
  });
  const course = useQuery({
    queryKey: ['admin-course', courseId],
    queryFn: () => api.get<AdminCourseDetail>(`/admin/content/courses/${courseId}`),
    enabled: Boolean(courseId),
  });

  const chapters = useMemo(
    () =>
      (course.data?.units ?? []).flatMap((unit) =>
        unit.chapters.map((chapter) => ({ ...chapter, unitTitle: unit.title })),
      ),
    [course.data],
  );
  const lessons = useMemo(
    () =>
      chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => ({ ...lesson, chapterTitle: chapter.title })),
      ),
    [chapters],
  );

  const publish = useMutation({
    mutationFn: () => {
      const pounds = Number(price || 0);
      return api.post<{ lessonId: string; lessonTitle: string }>(
        `/admin/content/live-recordings/${recordingId}/publish`,
        mode === 'existing'
          ? { lessonId }
          : {
              chapterId,
              title: title.trim(),
              priceMinor: free || !pounds ? null : Math.round(pounds * 100),
              isFreePreview: free,
              status: publishNow ? 'PUBLISHED' : 'DRAFT',
            },
      );
    },
    onSuccess: onPublished,
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'مقدرناش ننشر التسجيل'),
  });

  const ready =
    mode === 'existing'
      ? Boolean(lessonId)
      : Boolean(chapterId) &&
        title.trim().length >= 2 &&
        (free || price === '' || Number(price) >= 0);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 bg-midnight-950/75 backdrop-blur-sm"
        onClick={() => !publish.isPending && onClose()}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-recording-title"
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold-500/30 bg-ivory-50 p-5 shadow-2xl dark:bg-midnight-950"
      >
        {publish.isSuccess ? (
          <div className="space-y-3 text-center">
            <p className="font-display text-xl font-black text-emerald-700 dark:text-emerald-400">
              اتنشر ✓
            </p>
            <p className="text-sm text-midnight-700 dark:text-ivory-200">
              التسجيل بقى فيديو حصة <strong>{publish.data.lessonTitle}</strong>. بيتجهز دلوقتي
              بجودات مختلفة، وهيظهر للطلاب أول ما يخلص (دقايق حسب طول اللايف).
            </p>
            <div className="flex justify-center gap-2">
              <Link
                href={`/lessons/${publish.data.lessonId}`}
                className="inline-flex min-h-10 items-center rounded-xl border border-gold-500/40 px-4 text-sm font-bold text-gold-700 hover:bg-gold-500/10 dark:text-gold-300"
              >
                افتح الحصة
              </Link>
              <Button variant="accent" size="sm" onClick={onClose}>
                تم
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              if (ready) publish.mutate();
            }}
          >
            <div>
              <p className="text-xs font-bold text-gold-700 dark:text-gold-300">نشر تسجيل اللايف</p>
              <h2
                id="publish-recording-title"
                className="mt-1 font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
              >
                {sessionTitle}
              </h2>
              <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
                التسجيل هيبقى فيديو حصة، والطلاب اللي معاهم الحصة دي هيتفرجوا عليه في المشغل العادي.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="فين ينزل التسجيل">
              {(
                [
                  ['new', 'حصة جديدة'],
                  ['existing', 'حصة موجودة'],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'min-h-11 rounded-xl border-2 text-sm font-bold transition-colors',
                    mode === value
                      ? 'border-gold-500 bg-gold-500/15 text-midnight-950 dark:text-ivory-50'
                      : 'border-ivory-300 text-midnight-600 dark:border-midnight-700 dark:text-ivory-300',
                  )}
                >
                  {text}
                </button>
              ))}
            </div>

            <label className={labelClass}>
              الكورس
              <select
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setChapterId('');
                  setLessonId('');
                }}
                className={field}
              >
                <option value="">اختار الكورس</option>
                {(courses.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            {mode === 'new' ? (
              <>
                <label className={labelClass}>
                  الفصل
                  <select
                    value={chapterId}
                    onChange={(event) => setChapterId(event.target.value)}
                    disabled={!courseId}
                    className={field}
                  >
                    <option value="">{courseId ? 'اختار الفصل' : 'اختار الكورس الأول'}</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.unitTitle} ← {chapter.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  اسم الحصة
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    className={field}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    سعر الحصة لوحدها (جنيه)
                    <input
                      inputMode="decimal"
                      dir="ltr"
                      placeholder="فاضي = ضمن الباقات بس"
                      value={free ? '' : price}
                      disabled={free}
                      onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))}
                      className={field}
                    />
                  </label>
                  <div className="space-y-2 pt-6">
                    <label className="flex items-center gap-2 text-sm font-bold text-midnight-800 dark:text-ivory-100">
                      <input
                        type="checkbox"
                        checked={free}
                        onChange={(e) => setFree(e.target.checked)}
                      />
                      مجانية لكل طلاب الصف
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold text-midnight-800 dark:text-ivory-100">
                      <input
                        type="checkbox"
                        checked={publishNow}
                        onChange={(e) => setPublishNow(e.target.checked)}
                      />
                      انشرها للطلاب على طول
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <label className={labelClass}>
                الحصة
                <select
                  value={lessonId}
                  onChange={(event) => setLessonId(event.target.value)}
                  disabled={!courseId}
                  className={field}
                >
                  <option value="">{courseId ? 'اختار الحصة' : 'اختار الكورس الأول'}</option>
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.chapterTitle} ← {lesson.title}
                      {lesson.videoAsset ? ' (عليها فيديو)' : ''}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-midnight-500 dark:text-ivory-300/60">
                  لو الحصة عليها فيديو، التسجيل هيحل محله. الفيديو القديم يفضل شغال لحد ما الجديد
                  يجهز.
                </span>
              </label>
            )}

            {error && (
              <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="accent"
                fullWidth
                isLoading={publish.isPending}
                disabled={!ready}
              >
                انشر التسجيل
              </Button>
              <Button type="button" variant="ghost" disabled={publish.isPending} onClick={onClose}>
                إلغاء
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
