'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { cn, formatDuration, formatRelative } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';
import type { ContinueWatchingItem, LibraryLesson } from '@/types/api';

type Lesson = LibraryLesson | ContinueWatchingItem;

const ACCESS_LABELS: Record<string, { label: string; className: string }> = {
  FREE_PREVIEW: {
    label: 'حصة مجانية',
    className: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-500/20',
  },
  LESSON: {
    label: 'حصة مشتراة',
    className: 'bg-gold-50 dark:bg-gold-950/40 text-gold-700 dark:text-gold-300 border border-gold-500/20',
  },
  CHAPTER: {
    label: 'باقة فصل',
    className: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20',
  },
  COURSE: {
    label: 'كورس كامل',
    className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
  },
  SUBSCRIPTION: {
    label: 'ضمن اشتراكك',
    className: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-500/20',
  },
};

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const progress = lesson.progress;
  const percent = progress?.percent ?? 0;
  const accessVia = 'accessVia' in lesson ? lesson.accessVia : undefined;
  const badge = accessVia ? ACCESS_LABELS[accessVia] : undefined;

  const isCompleted = progress?.completed ?? false;
  const hasStarted = percent > 0;

  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={springSnappy}
      data-theme={lesson.course.themeKey}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 shadow-card transition-all duration-300 hover:shadow-lifted hover:border-gold-500/40"
    >
      <Link href={`/lessons/${lesson.id}`} className="flex h-full flex-col">
        {/* --- Thumbnail --- */}
        <div className="relative aspect-video overflow-hidden bg-gradient-to-bl from-midnight-800 to-midnight-950">
          {lesson.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lesson.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{ background: 'var(--hero-wash)' }}
            />
          )}

          {/* Play affordance */}
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center bg-midnight-950/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path d="M5.5 3.5l9 5.5-9 5.5z" />
              </svg>
            </span>
          </span>

          {lesson.durationSeconds > 0 && (
            <span className="nums-tabular absolute bottom-2 left-2 rounded-md bg-midnight-950/80 px-2 py-0.5 text-[11px] font-bold text-ivory-100 backdrop-blur-sm">
              {formatDuration(lesson.durationSeconds)}
            </span>
          )}

          {isCompleted && (
            <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white shadow">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2.5 7.5L5.5 10.5L11.5 3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">اتشافت بالكامل</span>
            </span>
          )}

          {/* Progress bar sits on the thumbnail's bottom edge */}
          {hasStarted && !isCompleted && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-midnight-950/40">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: percent / 100 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'right center' }}
                className="h-full bg-[var(--accent)]"
              />
            </div>
          )}
        </div>

        {/* --- Body --- */}
        <div className="flex flex-1 flex-col p-4">
          {badge && (
            <span
              className={cn(
                'mb-2 inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-bold',
                badge.className,
              )}
            >
              {badge.label}
            </span>
          )}

          <h3 className="font-display text-sm font-extrabold leading-snug text-midnight-950 dark:text-ivory-50 line-clamp-2">
            {lesson.title}
          </h3>

          <p className="mt-1 text-[11px] text-midnight-500 dark:text-ivory-300/60 line-clamp-1">
            {lesson.course.title}
          </p>

          <div className="mt-auto flex items-center justify-between pt-3">
            {hasStarted ? (
              <span className="text-[11px] font-bold text-[var(--accent)]">
                {isCompleted ? 'اتشافت' : `${percent}٪`}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-midnight-500 dark:text-ivory-300/60">
                لسه مبدأتهاش
              </span>
            )}

            {progress?.lastWatchedAt && (
              <span className="text-[11px] text-midnight-400 dark:text-ivory-300/50">
                {formatRelative(progress.lastWatchedAt)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

