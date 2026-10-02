'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { platformConfig } from '@/config/platform.config';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { getTheme } from '@/themes/registry';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import type { GradeDetail } from '@/types/api';

/**
 * The hero for one academic level.
 *
 * All five grades render through this component, but the theme registry
 * changes the accent metal, the decorative motif, the background composition,
 * the chronological strip and even the stagger rhythm — so تالتة ثانوي feels
 * composed and exam-focused while أولى ثانوي feels expansive and ancient.
 *
 * `data-theme` on the wrapper re-points the CSS accent tokens, which is what
 * lets one set of components carry five identities.
 */
export function GradeHero({ grade }: { grade: GradeDetail }) {
  const theme = getTheme(grade.themeKey);
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const motifY = useTransform(scrollYProgress, [0, 1], ['0%', '24%']);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      data-theme={grade.themeKey}
      className={`relative isolate overflow-hidden bg-gradient-to-b ${theme.heroSurface}`}
    >
      <motion.div
        aria-hidden
        style={{ y: motifY, opacity: fade }}
        className="pointer-events-none absolute -inset-y-[8%] inset-x-0 hidden md:block"
      >
        <motion.div
          animate={reduceMotion ? undefined : { scale: [1, 1.04, 1], x: ['0%', '-1.25%', '0%'] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <Image
            src={theme.heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </motion.div>
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden md:block bg-[linear-gradient(90deg,rgba(5,19,31,0.12)_0%,rgba(5,19,31,0.5)_42%,rgba(5,19,31,0.94)_100%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-midnight-950/65" />

      <div className="texture-parchment pointer-events-none absolute inset-0" aria-hidden />

      <motion.div
        variants={staggerContainer(theme.heroStagger, 0.05)}
        initial="hidden"
        animate="visible"
        className="container-page relative py-16 sm:py-24"
      >
        <motion.nav
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_ENTRANCE } },
          }}
          aria-label="مسار التنقل"
          className="flex flex-wrap items-center gap-2 text-xs text-ivory-200/60"
        >
          <a href="/" className="transition-colors hover:text-ivory-50">
            الرئيسية
          </a>
          <span aria-hidden>/</span>
          <a href="/grades" className="transition-colors hover:text-ivory-50">
            الصفوف الدراسية
          </a>
          <span aria-hidden>/</span>
          <span className="text-ivory-100">{grade.nameAr}</span>
        </motion.nav>

        <motion.span
          variants={{
            hidden: { opacity: 0, y: 18 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_ENTRANCE } },
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/35 bg-[var(--accent)]/12 px-4 py-2 text-xs font-bold text-ivory-50 backdrop-blur-sm"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: theme.accentHex }}
            aria-hidden
          />
          {theme.eraLabel}
        </motion.span>

        <motion.h1
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_ENTRANCE } },
          }}
          className="mt-5 max-w-3xl font-display text-4xl font-black leading-tight text-ivory-50 sm:text-5xl lg:text-6xl"
        >
          {grade.nameAr}
        </motion.h1>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 24 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_ENTRANCE } },
          }}
          className="mt-4 max-w-2xl text-base leading-relaxed text-ivory-200/80 sm:text-lg"
        >
          {grade.description ?? theme.eraTagline}
        </motion.p>

        {/* شريط تعريف المحاضر الراقي على شاشات الهاتف فقط — بدون أي تشويش أو تغطية للنصوص */}
        <div className="mt-6 flex items-center gap-3.5 rounded-2xl border border-[var(--accent)]/35 bg-midnight-950/80 p-3 shadow-lg backdrop-blur-md md:hidden">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--accent)]/50 shadow-md">
            <Image
              src={theme.portraitImage}
              alt={platformConfig.teacher.displayName}
              fill
              sizes="56px"
              className="object-cover object-top"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-sm font-black text-ivory-50 truncate">
                {platformConfig.teacher.displayName}
              </p>
              <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-bold text-ivory-100">
                محاضر المادة
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ivory-200/70 truncate">
              خبير مادة التاريخ — {theme.eraLabel}
            </p>
          </div>
        </div>

        {/* --- Chronological strip, unique per grade --- */}
        <motion.ul
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08, delayChildren: 0.3 },
            },
          }}
          className="mt-8 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-3"
          aria-label="محطات زمنية في المنهج"
        >
          {theme.timeline.map((point) => (
            <motion.li
              key={point.label}
              variants={{
                hidden: { opacity: 0, y: 16, scale: 0.94 },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.45, ease: EASE_ENTRANCE },
                },
              }}
              className="rounded-xl border border-ivory-50/12 bg-ivory-50/5 p-2.5 sm:px-4 sm:py-3 backdrop-blur-sm transition-colors duration-300 hover:border-[var(--accent)]/45"
            >
              <span
                className="block font-display text-xs sm:text-sm font-black"
                style={{ color: theme.accentHex }}
              >
                {point.label}
              </span>
              <span className="mt-0.5 block text-[10px] sm:text-[11px] text-ivory-200/65 line-clamp-1 sm:line-clamp-none">
                {point.caption}
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
