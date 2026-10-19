'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ButtonLink } from '@/components/ui/button';
import { EASE_ENTRANCE, springSnappy } from '@/lib/motion';
import { GoldParticles } from '@/components/decor/gold-particles';
import { WingedSunOfHorus, RoyalCartouche } from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';

interface EraSlide {
  id: string;
  name: string;
  badge: string;
  title: string;
  quote: string;
  image: string;
  /** Where the eye should land when the panorama is cropped (CSS object-position). */
  focus: string;
  gradeLink: string;
  accent: string;
}

const HISTORICAL_ERAS: EraSlide[] = [
  {
    id: 'pharaonic',
    name: 'العصر الفرعوني',
    badge: 'فجر الحضارة والخلود',
    title: 'حضارة مصر القديمة',
    quote:
      'التاريخ مش مجرد حفظ أسرار ومعارك.. التاريخ فهم حقيقي لإزاي أجدادك بنوا أول دولة منظمة في تاريخ البشرية.',
    image: '/images/eras/pharaonic-cover.jpg',
    focus: '35% 50%',
    gradeLink: '/grades/first-secondary',
    accent: '#f59e0b',
  },
  {
    id: 'renaissance',
    name: 'عصر النهضة والكشوف',
    badge: 'العصر الحديث المبكر',
    title: 'الكشوف وبوصلة العالم',
    quote: 'إزاي التجارة والخرائط والجغرافيا غيرت مسار التاريخ وعادت بمصر لقلب الصراع العالمي.',
    image: '/images/eras/renaissance-cover.jpg',
    focus: '45% 45%',
    gradeLink: '/grades/second-secondary',
    accent: '#14b8a6',
  },
  {
    id: 'modern',
    name: 'بناء مصر الحديثة',
    badge: 'نهضة الأمة وبناء الدولة',
    title: 'من محمد علي للثورة',
    quote: 'التاريخ الحديث مفتاح فهم الحاضر، بناء الجيش والتعليم والسيادة الوطنية خطوة بخطوة.',
    image: '/images/eras/modern-cover.jpg',
    focus: '70% 45%',
    gradeLink: '/grades/third-secondary',
    accent: '#ef4444',
  },
  {
    id: 'revolution',
    name: 'ثورة يوليو ومصر المعاصرة',
    badge: 'إرادة الشعب الكبرى',
    title: 'التحولات الوطنية الكبرى',
    quote: 'صمود الأمة المصرية وبناء الجمهورية وقراءة الأحداث المعاصرة برؤية تاريخية واعية.',
    image: '/images/eras/revolution-cover.jpg',
    focus: '55% 45%',
    gradeLink: '/grades/second-baccalaureate',
    accent: '#f97316',
  },
  {
    id: 'bacc',
    name: 'منهجية البكالوريا',
    badge: 'التفكير النقدي والمقارن',
    title: 'تحليل الوثائق والنقد التاريخي',
    quote:
      'ندربك على قراءة الوثائق التاريخية ونقد الروايات المتعددة وربط القرارات السياسية بسياقاتها الحقيقية.',
    image: '/images/eras/bacc-cover.jpg',
    focus: '50% 55%',
    gradeLink: '/grades/first-baccalaureate',
    accent: '#6366f1',
  },
];

/** How long each era stays before the next one, in milliseconds. */
const ERA_MS = 7000;

const STATS = [
  { value: '٣٠٠٠+', label: 'سنة من الحضارة' },
  { value: '٥ حقب', label: 'شاملة المنهج' },
  { value: '١٠٠٪', label: 'نواتج التعلم' },
];

/**
 * The home hero: a journey through the five eras of the syllabus.
 *
 * Desktop: the era's panorama fills the whole hero and cross-fades with a
 * slow push-in; the text sits on a soft wash on the reading side.
 * Phones: the same panorama as a framed card above the text, where a
 * full-bleed photo would fight the text for a small screen.
 */
export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const switcherRef = useRef<HTMLDivElement>(null);

  const currentEra = HISTORICAL_ERAS[activeIndex];
  const autoplay = !isPaused && !reduceMotion;

  useEffect(() => {
    if (!autoplay) return;
    const timer = setTimeout(
      () => setActiveIndex((prev) => (prev + 1) % HISTORICAL_ERAS.length),
      ERA_MS,
    );
    return () => clearTimeout(timer);
  }, [activeIndex, autoplay]);

  // Phones: keep the active era chip in view in the scrollable row.
  useEffect(() => {
    const row = switcherRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-era="${currentEra.id}"]`);
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({
      left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [currentEra.id, reduceMotion]);

  return (
    <section
      data-theme="pharaonic-dawn"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="رحلة عبر عصور التاريخ"
      className="relative isolate overflow-hidden bg-gradient-to-b from-[#fbf8f0] via-[#f5edd8] to-[#eee2c6] text-midnight-950 transition-colors duration-300 dark:from-[#030712] dark:via-[#05131f] dark:to-[#091b29] dark:text-ivory-50 lg:min-h-[calc(100dvh-4rem)]"
    >
      {/* ------------------------------------------------------------------
          Desktop: the era panorama, full bleed
          ------------------------------------------------------------------ */}
      <div aria-hidden className="absolute inset-0 -z-10 hidden lg:block">
        {HISTORICAL_ERAS.map((era, index) => {
          const isActive = index === activeIndex;
          return (
            <motion.div
              key={era.id}
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 1.2, ease: 'easeInOut' }}
            >
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ scale: isActive && !reduceMotion ? 1 : 1.08 }}
                transition={{ duration: isActive ? ERA_MS / 1000 + 1.5 : 0, ease: 'linear' }}
              >
                <Image
                  src={era.image}
                  alt=""
                  fill
                  priority={index === 0}
                  loading={index === 0 ? undefined : 'eager'}
                  sizes="100vw"
                  quality={85}
                  className="object-cover"
                  style={{ objectPosition: era.focus }}
                />
              </motion.div>
            </motion.div>
          );
        })}

        {/* Reading side wash: solid behind the text, clear over the scene. */}
        <div className="absolute inset-0 bg-gradient-to-l from-[#fbf8f0] from-20% via-[#fbf8f0]/75 via-40% to-transparent to-70% dark:from-[#030712] dark:via-[#030712]/70" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#fbf8f0]/80 to-transparent dark:from-[#030712]/75" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#eee2c6] to-transparent dark:from-[#091b29]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(3,7,18,0.25)] dark:shadow-[inset_0_0_180px_rgba(0,0,0,0.4)]" />
      </div>

      {/* Phones and tablets: a soft, blurred glow of the era behind everything. */}
      <div aria-hidden className="absolute inset-0 -z-10 lg:hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={currentEra.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <Image
              src={currentEra.image}
              alt=""
              fill
              sizes="100vw"
              quality={40}
              className="scale-125 object-cover opacity-20 blur-2xl dark:opacity-30"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <GoldParticles count={36} className="z-0 opacity-60 lg:opacity-45" />
      <div
        className="texture-parchment pointer-events-none absolute inset-0 z-0 opacity-25 dark:opacity-35"
        aria-hidden
      />

      <div className="container-page relative z-10 flex w-full flex-col pb-14 pt-10 sm:pt-14 lg:min-h-[calc(100dvh-4rem)] lg:pb-10 lg:pt-12">
        {/* Winged sun and cartouche */}
        <div className="mb-6 flex flex-col items-center lg:mb-8">
          <WingedSunOfHorus className="h-9 opacity-90 sm:h-12" />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_ENTRANCE }}
            className="mt-2"
          >
            <RoyalCartouche
              title={`${platformConfig.teacher.displayName} — ${platformConfig.teacher.tagline}`}
            />
          </motion.div>
        </div>

        {/* Era switcher: one scrollable row on phones, a centred bar on wide screens */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="-mx-4 mb-6 sm:mx-auto sm:mb-10"
        >
          <div
            ref={switcherRef}
            role="tablist"
            aria-label="العصور"
            className="flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible sm:rounded-2xl sm:border sm:border-gold-500/30 sm:bg-white/80 sm:p-1.5 sm:shadow-lg sm:backdrop-blur-md dark:sm:bg-midnight-950/75 [&::-webkit-scrollbar]:hidden"
          >
            {HISTORICAL_ERAS.map((era, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={era.id}
                  data-era={era.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(index)}
                  className={`relative shrink-0 snap-center overflow-hidden rounded-xl px-4 py-2.5 text-sm font-bold transition-colors duration-300 sm:px-5 ${
                    isActive
                      ? 'font-black text-midnight-950 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                      : 'border border-gold-500/25 bg-white/70 text-midnight-700 hover:bg-gold-500/10 hover:text-midnight-950 dark:bg-midnight-950/60 dark:text-ivory-200/75 dark:hover:text-ivory-50 sm:border-transparent sm:bg-transparent dark:sm:bg-transparent'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeEraPill"
                      className="absolute inset-0 rounded-xl border border-gold-200 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500"
                      transition={springSnappy}
                    />
                  )}
                  <span className="relative z-10">{era.name}</span>
                  {/* Time left on this era before the next one comes up */}
                  {isActive && autoplay && (
                    <motion.span
                      key={`${era.id}-${activeIndex}`}
                      aria-hidden
                      className="absolute bottom-0 right-0 z-10 h-[3px] bg-midnight-950/35"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: ERA_MS / 1000, ease: 'linear' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Phones and tablets: the era as a framed card */}
        <div className="mx-auto mb-8 w-full max-w-xl lg:hidden">
          <div className="relative overflow-hidden rounded-3xl border border-gold-500/40 bg-midnight-950 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.25rem]">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={currentEra.id}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.06 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.7, ease: EASE_ENTRANCE }}
                >
                  <Image
                    src={currentEra.image}
                    alt={currentEra.title}
                    fill
                    priority={activeIndex === 0}
                    sizes="(max-width: 640px) 100vw, 576px"
                    className="object-cover"
                    style={{ objectPosition: currentEra.focus }}
                  />
                </motion.div>
              </AnimatePresence>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent" />
              <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                <span className="font-display text-base font-black text-white drop-shadow">
                  {currentEra.name}
                </span>
                <span className="rounded-lg border border-gold-300/50 bg-black/40 px-2.5 py-1 text-[11px] font-black text-gold-200 backdrop-blur-sm">
                  {currentEra.badge}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Text: the reading side on desktop */}
        <div className="flex flex-1 items-center">
          <div className="w-full text-center lg:max-w-[min(44rem,52%)] lg:text-right">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentEra.id}
                role="tabpanel"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE_ENTRANCE }}
              >
                <div className="mb-4 hidden items-center gap-2.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3.5 py-1.5 text-xs font-bold text-gold-700 shadow-sm dark:text-gold-300 lg:inline-flex">
                  <span className="h-2 w-2 animate-ping rounded-full bg-gold-500" />
                  <span>{currentEra.badge}</span>
                </div>

                <h1 className="font-display text-4xl font-black leading-[1.15] tracking-tight text-midnight-950 dark:text-ivory-50 sm:text-5xl xl:text-6xl">
                  رحلة عبر الزمان:
                  <span className="mt-2 block text-gradient-gold">{currentEra.title}</span>
                </h1>

                <figure className="relative mt-6 rounded-2xl border border-gold-500/25 bg-white/80 p-5 text-right shadow-md backdrop-blur-md dark:bg-midnight-950/65 dark:shadow-xl sm:p-6">
                  <span
                    aria-hidden
                    className="absolute right-3 top-2 select-none font-serif text-3xl text-gold-500/30"
                  >
                    “
                  </span>
                  <blockquote className="pr-4 pt-1 font-arabic text-base leading-relaxed text-midnight-900 dark:text-ivory-100/90 sm:text-lg">
                    {currentEra.quote}
                  </blockquote>
                  <figcaption className="mt-3 flex items-center justify-between gap-3 border-t border-gold-500/20 pt-2 text-xs font-bold text-gold-700 dark:text-gold-300/80">
                    <span>— {platformConfig.teacher.displayName}</span>
                    <span className="text-midnight-500 dark:text-ivory-300/55">
                      شرح تفصيلي للمنهج ونواتج التعلم
                    </span>
                  </figcaption>
                </figure>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4 lg:justify-start">
              <ButtonLink
                href="#pathway"
                variant="accent"
                size="lg"
                className="w-full px-8 py-3.5 text-base font-extrabold shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] sm:w-auto"
              >
                <span className="flex items-center gap-2">
                  <span>ادخل صرح التاريخ</span>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path
                      d="M11 4l-5 5 5 5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </ButtonLink>
              <ButtonLink
                href="#pathway"
                size="lg"
                className="w-full border border-gold-500/40 bg-white/80 text-midnight-900 backdrop-blur-sm hover:border-gold-500 hover:bg-gold-500/10 dark:bg-midnight-950/75 dark:text-gold-200 sm:w-auto"
              >
                بوابات المناهج والصفوف
              </ButtonLink>
            </div>

            <ul className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-gold-500/20 pt-6 lg:mx-0">
              {STATS.map((stat) => (
                <li key={stat.label} className="text-center lg:text-right">
                  <span className="block font-display text-xl font-black text-gold-700 dark:text-gold-300 sm:text-2xl">
                    {stat.value}
                  </span>
                  <span className="block text-xs font-medium text-midnight-600 dark:text-ivory-200/65">
                    {stat.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Desktop: a museum-style label for the scene */}
        <div className="pointer-events-none absolute bottom-10 left-6 hidden lg:block xl:left-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentEra.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5, ease: EASE_ENTRANCE }}
              className="rounded-2xl border border-gold-300/40 bg-black/45 px-5 py-3 text-white shadow-2xl backdrop-blur-md"
            >
              <p className="text-[11px] font-bold tracking-wide text-gold-200/90">
                {currentEra.badge}
              </p>
              <p className="font-display text-xl font-black">{currentEra.name}</p>
              <p className="mt-1 text-[11px] text-white/60" dir="ltr">
                {String(activeIndex + 1).padStart(2, '0')} /{' '}
                {String(HISTORICAL_ERAS.length).padStart(2, '0')}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export const HomeHero = Hero;
