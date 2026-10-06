'use client';

import { useState, useEffect } from 'react';
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
    image: '/images/eras/pharaonic-portrait.jpg',
    gradeLink: '/grades/first-secondary',
    accent: '#f59e0b',
  },
  {
    id: 'renaissance',
    name: 'عصر النهضة والكشوف',
    badge: 'العصر الحديث المبكر',
    title: 'الكشوف وبوصلة العالم',
    quote: 'إزاي التجارة والخرائط والجغرافيا غيرت مسار التاريخ وعادت بمصر لقلب الصراع العالمي.',
    image: '/images/eras/renaissance-portrait.jpg',
    gradeLink: '/grades/second-secondary',
    accent: '#14b8a6',
  },
  {
    id: 'modern',
    name: 'بناء مصر الحديثة',
    badge: 'نهضة الأمة وبناء الدولة',
    title: 'من محمد علي للثورة',
    quote: 'التاريخ الحديث مفتاح فهم الحاضر، بناء الجيش والتعليم والسيادة الوطنية خطوة بخطوة.',
    image: '/images/eras/modern-portrait.jpg',
    gradeLink: '/grades/third-secondary',
    accent: '#ef4444',
  },
  {
    id: 'revolution',
    name: 'ثورة يوليو ومصر المعاصرة',
    badge: 'إرادة الشعب الكبرى',
    title: 'التحولات الوطنية الكبرى',
    quote: 'صمود الأمة المصرية وبناء الجمهورية وقراءة الأحداث المعاصرة برؤية تاريخية واعية.',
    image: '/images/eras/revolution-portrait.jpg',
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
    image: '/images/eras/bacc-portrait.jpg',
    gradeLink: '/grades/first-baccalaureate',
    accent: '#6366f1',
  },
];

export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reduceMotion = useReducedMotion();

  const currentEra = HISTORICAL_ERAS[activeIndex];

  // تقليب تلقائي سلس بين العصور كل 7 ثوانٍ
  useEffect(() => {
    if (isPaused || reduceMotion) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HISTORICAL_ERAS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isPaused, reduceMotion]);

  return (
    <section
      data-theme="pharaonic-dawn"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative isolate min-h-[92vh] overflow-hidden bg-gradient-to-b from-[#fbf8f0] via-[#f5edd8] to-[#eee2c6] dark:from-[#030712] dark:via-[#05131f] dark:to-[#091b29] text-midnight-950 dark:text-ivory-50 flex items-center justify-center pt-24 pb-16 lg:py-28 transition-colors duration-300"
    >
      {/* محاكي ذرات وغبار الذهب */}
      <GoldParticles count={48} className="opacity-75 z-0" />

      {/* ملمس البردي */}
      <div
        className="texture-parchment pointer-events-none absolute inset-0 opacity-30 dark:opacity-40 z-0"
        aria-hidden
      />

      {/* إضاءة محيطية ذهبية علوية ناعمة ومحايدة في خلفية الصفحة بعيداً عن وجه المستر */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-[160px] opacity-15 dark:opacity-20 bg-gradient-to-b from-gold-400/30 to-amber-600/20"
      />

      <div className="container-page relative z-10 w-full">
        {/* قرص الشمس المجنح والخرطوشة */}
        <div className="flex flex-col items-center justify-center mb-6">
          <WingedSunOfHorus className="h-10 sm:h-14 opacity-90 transition-transform duration-700 hover:scale-105" />

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

        {/* مبدل العصور التفاعلي */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mx-auto max-w-4xl mb-8 sm:mb-12"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-white/85 dark:bg-midnight-950/80 border border-gold-500/30 backdrop-blur-md shadow-lg dark:shadow-2xl">
            {HISTORICAL_ERAS.map((era, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={era.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`relative px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? 'text-midnight-950 font-black shadow-[0_0_20px_rgba(245,158,11,0.6)]'
                      : 'text-midnight-700 hover:text-midnight-950 hover:bg-gold-500/10 dark:text-ivory-200/70 dark:hover:text-ivory-50'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeEraPill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 border border-gold-200"
                      transition={springSnappy}
                    />
                  )}
                  <span className="relative z-10">{era.name}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* جسم الهيرو الرئيسي: نص العصر ووجه الأستاذ */}
        <div className="grid gap-12 lg:grid-cols-12 items-center">
          {/* الجانب الأيمن: البيانات والتوجيه */}
          <div className="lg:col-span-7 text-center lg:text-right">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentEra.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: EASE_ENTRANCE }}
              >
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-700 dark:text-gold-300 text-xs font-bold mb-4 shadow-sm">
                  <span className="w-2 h-2 rounded-full animate-ping bg-gold-500" />
                  <span>{currentEra.badge}</span>
                </div>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-midnight-950 dark:text-ivory-50 tracking-tight leading-[1.15]">
                  رحلة عبر الزمان:
                  <span className="block mt-2 text-gradient-gold">{currentEra.title}</span>
                </h1>

                {/* اقتباس الأستاذ في هذا العصر */}
                <div className="mt-6 relative rounded-2xl bg-white/85 dark:bg-midnight-950/70 border border-gold-500/25 p-5 sm:p-6 backdrop-blur-md shadow-md dark:shadow-xl text-right">
                  <span className="absolute top-2 right-3 text-3xl font-serif text-gold-500/30 select-none">
                    “
                  </span>
                  <p className="font-arabic text-base sm:text-lg leading-relaxed text-midnight-900 dark:text-ivory-100/90 pt-1 pr-4">
                    {currentEra.quote}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-gold-700 dark:text-gold-300/80 font-bold border-t border-gold-500/20 pt-2">
                    <span>— {platformConfig.teacher.displayName}</span>
                    <span className="text-midnight-500 dark:text-ivory-300/50">
                      شرح تفصيلي للمنهج ونواتج التعلم
                    </span>
                  </div>
                </div>

                {/* أزرار الإجراء الملكية */}
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <ButtonLink
                    href="#pathway"
                    variant="accent"
                    size="lg"
                    className="w-full sm:w-auto text-base font-extrabold px-8 py-3.5 shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)]"
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
                    className="w-full sm:w-auto border border-gold-500/40 bg-white/80 dark:bg-midnight-950/80 text-midnight-900 dark:text-gold-200 hover:bg-gold-500/10 hover:border-gold-500 backdrop-blur-sm"
                  >
                    بوابات المناهج والصفوف
                  </ButtonLink>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* مؤشرات حجرية سريعة */}
            <div className="mt-10 grid grid-cols-3 gap-3 border-t border-gold-500/20 pt-6 max-w-lg mx-auto lg:mx-0">
              <div className="text-center lg:text-right">
                <span className="block font-display text-xl sm:text-2xl font-black text-gold-700 dark:text-gold-300">
                  ٣٠٠٠+
                </span>
                <span className="block text-xs text-midnight-600 dark:text-ivory-200/60 font-medium">
                  سنة من الحضارة
                </span>
              </div>
              <div className="text-center lg:text-right">
                <span className="block font-display text-xl sm:text-2xl font-black text-gold-700 dark:text-gold-300">
                  ٥ حقب
                </span>
                <span className="block text-xs text-midnight-600 dark:text-ivory-200/60 font-medium">
                  شاملة المنهج
                </span>
              </div>
              <div className="text-center lg:text-right">
                <span className="block font-display text-xl sm:text-2xl font-black text-gold-700 dark:text-gold-300">
                  ١٠٠٪
                </span>
                <span className="block text-xs text-midnight-600 dark:text-ivory-200/60 font-medium">
                  نواتج التعلم
                </span>
              </div>
            </div>
          </div>

          {/* الجانب الأيسر: لوح المستر بإطار صرحي فاخر */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[340px] sm:max-w-[420px] aspect-[4/5]">
              {/* إطار الكارت الفاخر بخلفية داكنة تحافظ على الألوان الطبيعية للبشرة */}
              <div className="absolute inset-0 rounded-3xl border-2 border-gold-500/40 bg-gradient-to-b from-white to-gold-50/50 dark:from-[#06121d] dark:to-[#030911] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_20px_rgba(245,158,11,0.12)]">
                <div className="relative h-full w-full overflow-hidden rounded-2xl border border-gold-400/30">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentEra.id}
                      initial={{ opacity: 0, scale: 1.04 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.5, ease: EASE_ENTRANCE }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={currentEra.image}
                        alt={`${platformConfig.teacher.displayName} في ${currentEra.name}`}
                        fill
                        priority
                        sizes="(max-width: 768px) 100vw, 420px"
                        className="object-cover object-center"
                      />

                      {/* تدرج سفلي طفيف وناعم لتسهيل قراءة الشارة دون لمس الوجه */}
                      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-midnight-950/90 via-midnight-950/40 to-transparent pointer-events-none" />

                      <div className="absolute bottom-3 inset-x-3 p-3 rounded-xl bg-white/90 dark:bg-midnight-950/85 border border-gold-500/30 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-extrabold text-midnight-950 dark:text-ivory-50 block">
                            {currentEra.name}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-gold-500/20 border border-gold-500/40 text-[11px] font-black text-gold-700 dark:text-gold-300">
                            {currentEra.badge}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* هالة ذهبية دافئة ناعمة عند قاعدة الكارت في الأسفل فقط بعيداً عن المنتصف والوجه */}
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-5 inset-x-6 h-12 rounded-full blur-2xl opacity-25 bg-gold-500"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const HomeHero = Hero;
