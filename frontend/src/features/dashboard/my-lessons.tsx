'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '@/lib/api';
import { LessonCard } from './lesson-card';
import { ButtonLink } from '@/components/ui/button';
import { cn, pluralizeAr } from '@/lib/utils';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import type { LibraryLesson } from '@/types/api';

type Filter = 'all' | 'in-progress' | 'completed' | 'not-started';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'in-progress', label: 'شغال عليها' },
  { key: 'not-started', label: 'لسه مبدأتهاش' },
  { key: 'completed', label: 'خلصتها' },
];

export function MyLessons() {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['my-lessons'],
    queryFn: () => api.get<LibraryLesson[]>('/me/lessons'),
  });

  const filtered = useMemo(() => {
    if (!lessons) return [];

    const term = search.trim();
    return lessons.filter((lesson) => {
      if (term && !lesson.title.includes(term) && !lesson.course.title.includes(term)) {
        return false;
      }

      const percent = lesson.progress?.percent ?? 0;
      const completed = lesson.progress?.completed ?? false;

      switch (filter) {
        case 'in-progress':
          return percent > 0 && !completed;
        case 'completed':
          return completed;
        case 'not-started':
          return percent === 0;
        case 'all':
        default:
          return true;
      }
    });
  }, [lessons, filter, search]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-56 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!lessons?.length) {
    return (
      <div className="rounded-3xl border border-dashed border-gold-500/30 bg-white dark:bg-midnight-950/80 p-10 text-center sm:p-16 transition-colors shadow-sm">
        <span
          aria-hidden
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold-50 dark:bg-midnight-900 text-gold-600 dark:text-gold-400 border border-gold-500/20"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 5.5A2 2 0 016 3.5h5v17H6a2 2 0 01-2-2z" strokeWidth="1.6" />
            <path d="M20 5.5a2 2 0 00-2-2h-5v17h5a2 2 0 002-2z" strokeWidth="1.6" />
          </svg>
        </span>
        <h2 className="mt-5 font-display text-xl font-black text-midnight-950 dark:text-ivory-50">
          مكتبتك لسه فاضية
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-midnight-600 dark:text-ivory-300/70">
          أول ما تشتري حصة أو تشترك في باقة، هتلاقي كل حصصك هنا جاهزة للمشاهدة فوراً.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/grades" variant="accent">
            اتصفح الصفوف
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* --- Header + filters --- */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">حصصي</h1>
          <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/70">
            عندك {pluralizeAr(lessons.length, ['حصة واحدة', 'حصتان', 'حصة'])} متاحة للمشاهدة
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="تصفية الحصص"
            className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={cn(
                  'rounded-xl px-4 py-2 text-xs font-bold transition-all',
                  filter === option.key
                    ? 'border border-gold-500/40 bg-gold-500/15 text-gold-800 dark:text-gold-300 shadow-sm'
                    : 'border border-gold-500/20 bg-white/70 dark:bg-midnight-950/60 text-midnight-600 dark:text-ivory-300/70 hover:text-midnight-900 dark:hover:text-ivory-100',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن حصة أو كورس..."
              aria-label="بحث في حصصي"
              className="min-h-10 w-full rounded-xl border border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900/90 px-3.5 text-xs text-midnight-900 dark:text-ivory-50 placeholder:text-midnight-400 dark:placeholder:text-midnight-500 focus:border-gold-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* --- Grid --- */}
      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-gold-500/30 bg-white dark:bg-midnight-950/80 p-8 text-center transition-colors">
          <p className="font-display text-sm font-bold text-midnight-800 dark:text-ivory-200">
            مفيش حصص مطابقة للبحث أو الفلتر
          </p>
        </div>
      ) : (
        <motion.ul
          variants={staggerContainer(0.06)}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((lesson) => (
              <motion.li
                key={lesson.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.35, ease: EASE_ENTRANCE },
                  },
                }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <LessonCard lesson={lesson} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
