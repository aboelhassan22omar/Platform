'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { EASE_ENTRANCE, springSnappy, staggerContainer } from '@/lib/motion';
import { getTheme } from '@/themes/registry';
import type { EducationSystemSummary } from '@/types/api';
import {
  TempleCornerBrackets,
  EyeOfHorus,
  LotusBlossom,
  AnkhLifeKey,
  HieroglyphRegister,
} from '@/components/decor/egyptian-motifs';

export function PathwaySelector({ systems }: { systems: EducationSystemSummary[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = systems.find((system) => system.key === selected);

  return (
    <section
      id="pathway"
      className="relative overflow-hidden bg-gradient-to-b from-[#fbf8f0] via-[#f5edd8] to-[#eee2c6] dark:from-[#040e18] dark:via-[#05131f] dark:to-[#081726] py-20 sm:py-28 text-midnight-950 dark:text-ivory-50 transition-colors duration-300"
      aria-labelledby="pathway-heading"
    >
      <div
        className="texture-parchment pointer-events-none absolute inset-0 opacity-25"
        aria-hidden
      />

      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full blur-[160px] opacity-15 bg-gold-500"
      />

      <div className="container-page relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 0.6, ease: EASE_ENTRANCE }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5 text-xs font-black text-amber-800 dark:text-gold-300">
            <AnkhLifeKey className="h-4 w-4" />
            بوابات المناهج والصفوف
          </span>
          <h2
            id="pathway-heading"
            className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-black text-midnight-950 dark:text-ivory-50"
          >
            اختر <span className="text-gradient-gold">مسارك التعليمي</span>
          </h2>
          <p className="mt-3.5 text-base sm:text-lg leading-relaxed text-midnight-800/80 dark:text-ivory-200/80">
            سواء كنت في الثانوية العامة أو البكالوريا المصرية، فك ختم البردية الملكية واستعرض الصفوف
            والحصص المعتمدة الخاصة بنظامك.
          </p>

          <div className="mt-6">
            <HieroglyphRegister />
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer(0.12, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2"
        >
          {systems.map((system) => {
            const isActive = selected === system.key;
            const isGeneral = system.key === 'GENERAL';

            return (
              <motion.button
                key={system.key}
                type="button"
                variants={{
                  hidden: { opacity: 0, y: 28 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_ENTRANCE } },
                }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.985 }}
                transition={springSnappy}
                onClick={() => setSelected((prev) => (prev === system.key ? null : system.key))}
                aria-pressed={isActive}
                className={cn(
                  'group relative overflow-hidden rounded-3xl border-2 p-6 sm:p-8 text-start transition-all duration-500',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400',
                  isActive
                    ? 'border-gold-400 bg-white dark:bg-gradient-to-b dark:from-midnight-900 dark:to-midnight-950 text-midnight-950 dark:text-ivory-50 shadow-[0_0_35px_rgba(245,158,11,0.25)]'
                    : 'border-gold-500/25 bg-white/85 dark:bg-midnight-950/60 text-midnight-950 dark:text-ivory-100 hover:border-gold-400/50 hover:bg-white dark:hover:bg-midnight-950/80 shadow-xs',
                )}
              >
                <TempleCornerBrackets />

                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500',
                    'bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(245,158,11,0.2),transparent_70%)]',
                    isActive && 'opacity-100',
                  )}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold-400/40 bg-gold-400/10 text-amber-800 dark:text-gold-300">
                        {isGeneral ? (
                          <EyeOfHorus className="h-6 w-7" />
                        ) : (
                          <LotusBlossom className="h-6 w-7" />
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] font-extrabold text-amber-700 dark:text-gold-400 uppercase tracking-wider block">
                          {isGeneral ? 'المسار العام المعتمد' : 'المسار التحليلي الحديث'}
                        </span>
                        <h3 className="font-display text-xl sm:text-2xl font-black">
                          {system.nameAr}
                        </h3>
                      </div>
                    </div>

                    <span
                      aria-hidden
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-all duration-300',
                        isActive
                          ? 'border-gold-400 bg-gold-400 text-midnight-950 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                          : 'border-neutral-300 dark:border-ivory-300/30 text-transparent group-hover:border-gold-400/50',
                      )}
                    >
                      <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 7.5L5.5 11L12 3.5"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-midnight-800/80 dark:text-ivory-200/80">
                    {system.descriptionAr}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-gold-500/20 pt-3">
                    <span className="text-xs font-bold text-amber-800 dark:text-gold-300">
                      {system.grades.length === 2
                        ? 'صفّين دراسيين معتمدين'
                        : 'ثلاثة صفوف دراسية كاملة'}
                    </span>
                    <span className="text-xs font-black text-midnight-700/60 dark:text-ivory-300/60 group-hover:text-amber-800 dark:group-hover:text-gold-200 transition-colors flex items-center gap-1">
                      {isActive ? 'البردية مفتوحة الآن (انقر للإغلاق)' : 'انقر لفك الختم'}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                        <path
                          d="M9 3l-4 4 4 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={active.key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease: EASE_ENTRANCE }}
              className="overflow-hidden"
            >
              <div className="mx-auto mt-14 max-w-5xl">
                <div className="text-center mb-8">
                  <span className="text-xs font-bold text-amber-700 dark:text-gold-400 uppercase tracking-widest block">
                    صفوف {active.nameAr}
                  </span>
                  <h4 className="mt-1 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
                    اختر صفك الدراسي لفتح سجل الحصص
                  </h4>
                </div>

                <motion.ul
                  variants={staggerContainer(0.09, 0.15)}
                  initial="hidden"
                  animate="visible"
                  className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {active.grades.map((grade) => {
                    const theme = getTheme(grade.themeKey);
                    return (
                      <motion.li
                        key={grade.id}
                        variants={{
                          hidden: { opacity: 0, y: 24, scale: 0.97 },
                          visible: {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            transition: { duration: 0.5, ease: EASE_ENTRANCE },
                          },
                        }}
                      >
                        <Link
                          href={`/grades/${grade.slug}`}
                          data-theme={theme.key}
                          className={cn(
                            'group relative flex h-full flex-col overflow-hidden rounded-2xl',
                            'border border-gold-500/30 bg-white/95 dark:bg-midnight-950/90 p-6 text-midnight-950 dark:text-ivory-50 transition-all duration-300',
                            'hover:-translate-y-2 hover:border-gold-400 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] shadow-xs',
                          )}
                        >
                          <TempleCornerBrackets />

                          <span
                            aria-hidden
                            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-600"
                          />

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-amber-800 dark:text-gold-300">
                              {theme.eraLabel}
                            </span>
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: theme.accentHex }}
                            />
                          </div>

                          <h5 className="mt-2.5 font-display text-xl font-black text-midnight-950 dark:text-ivory-50 group-hover:text-amber-700 dark:group-hover:text-gold-300 transition-colors">
                            {grade.nameAr}
                          </h5>

                          <p className="mt-2.5 flex-1 text-sm leading-relaxed text-midnight-700/80 dark:text-ivory-200/70">
                            {grade.description ?? theme.eraTagline}
                          </p>

                          <div className="mt-6 pt-3 border-t border-gold-500/20 flex items-center justify-between">
                            <span className="text-xs font-black text-amber-800 dark:text-gold-300 group-hover:text-amber-950 dark:group-hover:text-gold-200">
                              افتح سجل الحصص
                            </span>
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/10 text-amber-800 dark:text-gold-300 group-hover:bg-gold-500 group-hover:text-midnight-950 transition-colors">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                aria-hidden
                                className="transition-transform duration-300 group-hover:-translate-x-1"
                              >
                                <path
                                  d="M10 3.5L5.5 8l4.5 4.5"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </div>
                        </Link>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
