'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { LessonCard } from './lesson-card';
import { ButtonLink } from '@/components/ui/button';
import { AnimatedCounter } from '@/components/motion/counter';
import { formatDurationLabel, greetingFor, initialsOf, toArabicDigits } from '@/lib/utils';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import type { ContinueWatchingItem, Subscription } from '@/types/api';
import { platformConfig } from '@/config/platform.config';

const GRADE_LABELS: Record<string, string> = {
  SEC_1: 'أولى ثانوي',
  SEC_2: 'تانية ثانوي',
  SEC_3: 'تالتة ثانوي',
  BACC_1: 'أولى بكالوريا',
  BACC_2: 'تانية بكالوريا',
};

interface StudySummary {
  lessonsStarted: number;
  lessonsCompleted: number;
  lessonsInProgress: number;
  totalWatchedSeconds: number;
}

export function DashboardOverview() {
  const { user } = useAuth();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['study-summary'],
    queryFn: () => api.get<StudySummary>('/me/progress/summary'),
  });

  const { data: continueWatching, isLoading: continueLoading } = useQuery({
    queryKey: ['continue-watching'],
    queryFn: () => api.get<ContinueWatchingItem[]>('/me/continue-watching'),
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.get<Subscription[]>('/subscriptions/mine'),
  });

  if (!user) return null;

  const firstName = user.fullName.trim().split(/\s+/)[0];
  const activeSub = subscriptions?.find((sub) => sub.isActive);

  const stats = [
    {
      label: 'حصص بدأتها',
      value: summary?.lessonsStarted ?? 0,
      accent: 'text-midnight-950 dark:text-ivory-50',
    },
    {
      label: 'حصص خلصتها',
      value: summary?.lessonsCompleted ?? 0,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'حصص شغالة عليها',
      value: summary?.lessonsInProgress ?? 0,
      accent: 'text-gold-600 dark:text-gold-400',
    },
  ];

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------------
          Greeting
          ------------------------------------------------------------------ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_ENTRANCE }}
        className="relative overflow-hidden rounded-3xl border border-gold-500/30 bg-gradient-to-bl from-midnight-900 via-midnight-950 to-midnight-900 p-6 text-ivory-50 sm:p-8 shadow-xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-drift"
          style={{
            background:
              'radial-gradient(ellipse 60% 70% at 85% 10%, rgb(200 149 42 / 0.22), transparent 65%)',
          }}
        />
        <div
          className="texture-parchment pointer-events-none absolute inset-0 opacity-20"
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <motion.span
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 18 }}
              aria-hidden
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-gold-400/40 bg-gold-400/15 font-display text-lg font-black text-gold-200 sm:h-16 sm:w-16 sm:text-xl"
            >
              {initialsOf(user.fullName)}
            </motion.span>

            <div>
              <p className="text-xs text-ivory-200/60">{greetingFor(new Date().getHours())}</p>
              <h1 className="font-display text-xl font-black sm:text-2xl">
                أهلاً يا {firstName} 👋
              </h1>
              <p className="mt-1 text-sm text-ivory-200/70">
                جاهز نكمل رحلة {platformConfig.subject.name} ونحصد درجات التفوق؟
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-gold-400/30 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-300">
              {user.gradeLevel ? GRADE_LABELS[user.gradeLevel] : 'لم يُحدد الصف'}
            </span>
            <span className="rounded-lg border border-gold-400/30 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-300">
              {user.educationSystem === 'BACC' ? 'البكالوريا المصرية' : 'الثانوية العامة'}
            </span>
          </div>
        </div>

        {/* Subscription status */}
        <div className="relative mt-6 flex flex-col gap-3 rounded-2xl border border-ivory-50/15 bg-white/5 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          {activeSub ? (
            <>
              <div>
                <p className="text-sm font-bold text-ivory-50">{activeSub.plan.title}</p>
                <p className="mt-0.5 text-xs text-ivory-200/65">
                  باقي على انتهاء الاشتراك {toArabicDigits(String(activeSub.daysRemaining))} يوم
                </p>
              </div>
              <ButtonLink
                href="/dashboard/subscriptions"
                variant="outline"
                size="sm"
                className="border-gold-400/40 text-gold-300 hover:bg-gold-500/10"
              >
                تفاصيل الاشتراك
              </ButtonLink>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold text-ivory-50">مفيش اشتراك فعّال</p>
                <p className="mt-0.5 text-xs text-ivory-200/65">
                  اشترك وافتح كل حصص صفك، أو اشترِ الحصص اللي محتاجها.
                </p>
              </div>
              <ButtonLink href="/grades" variant="accent" size="sm">
                اشترك دلوقتي
              </ButtonLink>
            </>
          )}
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------
          Stats
          ------------------------------------------------------------------ */}
      <motion.section
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="visible"
        aria-label="ملخص تقدمك"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_ENTRANCE } },
            }}
            className="rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 p-5 shadow-card transition-colors"
          >
            <p className="text-xs font-bold text-midnight-600 dark:text-ivory-300/80">
              {stat.label}
            </p>
            {summaryLoading ? (
              <div className="skeleton mt-2 h-9 w-16" />
            ) : (
              <p className={`mt-1 font-display text-3xl font-black ${stat.accent}`}>
                <AnimatedCounter value={stat.value} />
              </p>
            )}
          </motion.div>
        ))}

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_ENTRANCE } },
          }}
          className="rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 p-5 shadow-card transition-colors"
        >
          <p className="text-xs font-bold text-midnight-600 dark:text-ivory-300/80">وقت المذاكرة</p>
          {summaryLoading ? (
            <div className="skeleton mt-2 h-9 w-24" />
          ) : (
            <p className="mt-1 font-display text-xl font-black text-midnight-950 dark:text-ivory-50">
              {formatDurationLabel(summary?.totalWatchedSeconds ?? 0)}
            </p>
          )}
        </motion.div>
      </motion.section>

      {/* ------------------------------------------------------------------
          كمّل من مكان ما وقفت
          ------------------------------------------------------------------ */}
      <section aria-labelledby="continue-heading">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="continue-heading"
            className="font-display text-xl font-black text-midnight-950 dark:text-ivory-50"
          >
            كمّل من مكان ما وقفت
          </h2>
          <Link
            href="/dashboard/lessons"
            className="text-sm font-bold text-gold-700 dark:text-gold-400 hover:underline"
          >
            كل حصصي
          </Link>
        </div>

        {continueLoading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-56 rounded-2xl" />
            ))}
          </div>
        ) : continueWatching?.length ? (
          <motion.ul
            variants={staggerContainer(0.07)}
            initial="hidden"
            animate="visible"
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {continueWatching.map((lesson) => (
              <motion.li
                key={lesson.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_ENTRANCE } },
                }}
              >
                <LessonCard lesson={lesson} />
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gold-500/30 bg-white dark:bg-midnight-950/80 p-8 text-center transition-colors">
            <p className="font-display text-base font-bold text-midnight-900 dark:text-ivory-100">
              لسه مبدأتش أي حصة
            </p>
            <p className="mt-1.5 text-sm text-midnight-500 dark:text-ivory-300/70">
              ابدأ بأي حصة، والمنصة هتفتكرلك مكان ما وقفت تلقائياً.
            </p>
            <ButtonLink href="/grades" variant="accent" size="sm" className="mt-4">
              اتصفح الحصص
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
