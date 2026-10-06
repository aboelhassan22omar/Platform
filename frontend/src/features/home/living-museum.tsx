'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { platformConfig } from '@/config/platform.config';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import {
  EyeOfHorus,
  AnkhLifeKey,
  LotusBlossom,
  DjedPillar,
  HieroglyphRegister,
} from '@/components/decor/egyptian-motifs';

interface MuseumEra {
  id: string;
  name: string;
  titleAr: string;
  dynasty: string;
  historicalPeriod: string;
  portraitImage: string;
  coverImage: string;
  icon: 'ankh' | 'eye' | 'lotus' | 'djed';
  accent: string;
  quote: string;
  description: string;
  keyInsights: string[];
}

const MUSEUM_ERAS: MuseumEra[] = [
  {
    id: 'pharaonic',
    name: platformConfig.teacher.displayName,
    titleAr: 'العصر الفرعوني وتوحيد القطرين',
    dynasty: 'من عصر الأسرات حتى نهاية الدولة الحديثة',
    historicalPeriod: '٣٢٠٠ ق.م — ٣٣٢ ق.م',
    portraitImage: '/images/eras/pharaonic-portrait.jpg',
    coverImage: '/images/eras/pharaonic-cover.jpg',
    icon: 'ankh',
    accent: '#d97706',
    quote:
      'التاريخ مش مجرد حفظ أسرار ومعارك، التاريخ فهم حقيقي لإزاي أجدادك بنوا أول دولة منظمة في العالم.',
    description:
      'أسرار الحضارة المصرية القديمة؛ نشأة الإدارة والجيش ونظم الحكم والفتوحات التي شكلت أول إمبراطورية في التاريخ.',
    keyInsights: [
      'توحيد القطرين وتأسيس أول دولة مركزية',
      'عمارة الأهرامات والخلود الحضاري',
      'معركة قادش والريادة العسكرية المصرية',
    ],
  },
  {
    id: 'renaissance',
    name: platformConfig.teacher.displayName,
    titleAr: 'عصر النهضة والكشوف الجغرافية',
    dynasty: 'العصر الحديث المبكر وبداية التحول العالمي',
    historicalPeriod: '١٤٥٣ م — ١٧٩٨ م',
    portraitImage: '/images/eras/renaissance-portrait.jpg',
    coverImage: '/images/eras/renaissance-cover.jpg',
    icon: 'lotus',
    accent: '#0d9488',
    quote:
      'تحول طرق التجارة واكتشاف البوصلة والخرائط غيّر موازين القوى وأعاد رسم مصير الشرق الأوسط.',
    description:
      'تحولات موازين القوى العالمية بعد الكشوف الجغرافية، والنهضة الأوروبية، وأثر مسارات التجارة البحرية على مصر.',
    keyInsights: [
      'طريق رأس الرجاء الصالح وتحديات المماليك',
      'أثر النهضة الفكرية الأوروبية',
      'موقع مصر في قلب التجارة البحرية',
    ],
  },
  {
    id: 'modern',
    name: platformConfig.teacher.displayName,
    titleAr: 'تاريخ مصر الحديث والنهضة الكبرى',
    dynasty: 'من محمد علي حتى ثورة ١٩١٩',
    historicalPeriod: '١٧٩٨ م — ١٩٢٣ م',
    portraitImage: '/images/eras/modern-portrait.jpg',
    coverImage: '/images/eras/modern-cover.jpg',
    icon: 'eye',
    accent: '#b91c1c',
    quote:
      'منهج التاريخ الحديث هو حجر الأساس لفهم الحاضر، والربط بين الأسباب والنتائج هو طريقك للدرجة النهائية.',
    description:
      'بناء الدولة الحديثة والجيش والتعليم، ومواجهة الاحتلال، ونشأة الحركة الوطنية لتحقيق الاستقلال.',
    keyInsights: [
      'مشروع محمد علي وبناء الجيش الحديث',
      'الثورة العرابية والمقاومة الوطنية',
      'ثورة ١٩١٩ وترسيخ الشخصية المصرية',
    ],
  },
  {
    id: 'bacc',
    name: platformConfig.teacher.displayName,
    titleAr: 'منهجية الفكر والتحليل التاريخي',
    dynasty: 'نقد الوثائق والمقارنة الفلسفية المعاصرة',
    historicalPeriod: 'رؤية نقدية معاصرة',
    portraitImage: '/images/eras/bacc-portrait.jpg',
    coverImage: '/images/eras/bacc-cover.jpg',
    icon: 'djed',
    accent: '#4f46e5',
    quote:
      'المؤرخ الحقيقي لا يقرأ السطور فقط، بل يحلل ما وراءها ويفهم دوافع كل قرار سياسي وتاريخي.',
    description:
      'تدريب الطالب على قراءة النصوص الأصلية، تحليل النوايا والظروف، وربط القرارات بسياقاتها الحضارية.',
    keyInsights: [
      'تحليل ونقد المصادر التاريخية الأولية',
      'المقارنة الفلسفية بين الحضارات',
      'التفكير الاستنباطي وربط الأسباب',
    ],
  },
  {
    id: 'revolution',
    name: platformConfig.teacher.displayName,
    titleAr: 'ثورة يوليو ومصر المعاصرة',
    dynasty: 'من ثورة ٢٣ يوليو حتى ملحمة العبور',
    historicalPeriod: '١٩٥٢ م — حتى اليوم',
    portraitImage: '/images/eras/revolution-portrait.jpg',
    coverImage: '/images/eras/revolution-cover.jpg',
    icon: 'lotus',
    accent: '#ea580c',
    quote:
      'صمود الشعب المصري وتأميم القناة وملحمة العبور شواهد حية على أن إرادة هذه الأمة لا تنكسر.',
    description:
      'قراءة حية للقرارات المصيرية: الإصلاح الزراعي، جلاء القوات البريطانية، السد العالي، وملحمة نصر أكتوبر.',
    keyInsights: [
      'مبادئ ثورة يوليو والتحول الاجتماعي',
      'معركة تأميم السويس والعدوان الثلاثي',
      'ملحمة العبور واستعادة سيناء ١٩٧٣',
    ],
  },
];

export function LivingMuseum() {
  const [flippedId, setFlippedId] = useState<string | null>(null);

  return (
    <section
      id="living-museum"
      className="relative overflow-hidden bg-gradient-to-b from-[#eee2c6] via-[#f8f2e2] to-[#fbf8f0] dark:from-[#091b29] dark:via-[#05131f] dark:to-[#040e18] py-16 sm:py-24 text-midnight-950 dark:text-ivory-50 transition-colors duration-300"
    >
      <div
        className="texture-parchment pointer-events-none absolute inset-0 opacity-25"
        aria-hidden
      />

      <div className="container-page relative z-10">
        {/* --- عنوان القسم والخرطوشة الملكية --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 0.6, ease: EASE_ENTRANCE }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5 text-xs font-black text-amber-800 dark:text-gold-300">
            <EyeOfHorus className="h-4 w-5" />
            المتحف الوثائقي الحي
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-black text-midnight-950 dark:text-ivory-50">
            رحلة المستر عبر <span className="text-gradient-gold">٥٠٠٠ سنة تاريخ</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-midnight-800/80 dark:text-ivory-200/80">
            في كل عصر من عصور مصر، يرتدي المستر روح الزمن ومصادره الأصلية ليشرح لك التاريخ كما حدث
            بالفعل. استعرض الشخصيات والوثائق التاريخية أدناه.
          </p>

          <div className="mt-5">
            <HieroglyphRegister />
          </div>
        </motion.div>

        {/* --- شبكة بطاقات العصور مدمجة بدون مساحات فارغة وبكلام كامل غير مقصوص --- */}
        <motion.div
          variants={staggerContainer(0.08, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '0px 0px -8% 0px' }}
          className="mt-10 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          {MUSEUM_ERAS.map((era) => {
            const isFlipped = flippedId === era.id;

            return (
              <motion.div
                key={era.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_ENTRANCE } },
                }}
                className="w-full [perspective:1000px]"
              >
                {/* الحاوية القابلة للانقلاب ثلاثي الأبعاد بارتفاع مدمج محكم يلغي الفراغات */}
                <motion.div
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="relative h-[415px] w-full"
                >
                  {/* =========================================
                      الوجه الأمامي للكارت (Front Face)
                     ========================================= */}
                  <div
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    className={cn(
                      'absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border-2 transition-all duration-300 shadow-xs',
                      'border-gold-500/25 bg-white/95 dark:bg-midnight-950/85 hover:border-gold-400/60 hover:shadow-md',
                    )}
                  >
                    {/* 1. صورة الغلاف التاريخية البانورامية */}
                    <div className="relative h-24 w-full overflow-hidden bg-midnight-900/10 dark:bg-midnight-900 shrink-0">
                      <Image
                        src={era.coverImage}
                        alt={era.titleAr}
                        fill
                        sizes="300px"
                        className="object-cover object-center opacity-90 transition-transform duration-700 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-midnight-950 via-transparent to-transparent" />

                      {/* بادج الفترة التاريخية */}
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/40 bg-white/90 dark:bg-midnight-950/90 px-2 py-0.5 text-[9.5px] font-bold text-amber-800 dark:text-gold-300 backdrop-blur-md shadow-xs">
                          {era.historicalPeriod}
                        </span>
                      </div>
                    </div>

                    {/* 2. جسم الكارت */}
                    <div className="relative flex flex-col flex-1 justify-between px-3.5 pt-0 pb-2.5">
                      <div>
                        {/* البروفايل والأيقونة */}
                        <div className="flex items-end justify-between -mt-8 mb-1.5">
                          <div className="relative h-15 w-15 shrink-0 overflow-hidden rounded-2xl border-2 border-gold-400 shadow-[0_0_10px_rgba(245,158,11,0.35)] bg-amber-50 dark:bg-midnight-950">
                            <Image
                              src={era.portraitImage}
                              alt={era.name}
                              fill
                              sizes="60px"
                              className="object-cover object-[50%_15%]"
                            />
                            <div
                              title="شخصية تاريخية موثقة"
                              className="absolute bottom-0.5 right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-gold-400 text-midnight-950 shadow-md text-[8px] font-black"
                            >
                              ✓
                            </div>
                          </div>

                          <div className="p-1.5 rounded-xl bg-gold-500/10 border border-gold-400/30 text-amber-700 dark:text-gold-300">
                            {era.icon === 'ankh' && <AnkhLifeKey className="h-3.5 w-3" />}
                            {era.icon === 'eye' && <EyeOfHorus className="h-3 w-3.5" />}
                            {era.icon === 'lotus' && <LotusBlossom className="h-3 w-3.5" />}
                            {era.icon === 'djed' && <DjedPillar className="h-3.5 w-3" />}
                          </div>
                        </div>

                        {/* اسم الشخصية والعصر - مكتوبة كاملة بدون أي قص */}
                        <div>
                          <h3 className="font-display text-xs sm:text-sm font-black text-midnight-950 dark:text-ivory-50 leading-tight">
                            {era.name}
                          </h3>
                          <p className="mt-0.5 text-[10.5px] font-bold text-amber-800 dark:text-gold-400/90 leading-tight">
                            {era.titleAr}
                          </p>
                        </div>

                        {/* مقولة المستر - جملة كاملة واضحة ومقروءة بدون أي نقط أو قص */}
                        <div className="mt-2 rounded-xl border border-gold-500/15 bg-amber-50/70 dark:bg-midnight-900/60 p-2">
                          <p className="text-[10px] leading-relaxed text-midnight-900 dark:text-ivory-200/85 italic">
                            "{era.quote}"
                          </p>
                        </div>

                        {/* محاور ونواتج التعلم - مكتوبة بالكامل بدون أي اختصار أو قص */}
                        <div className="mt-2 space-y-1">
                          {era.keyInsights.slice(0, 2).map((insight, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-1.5 text-[9.5px] leading-snug text-midnight-700/85 dark:text-ivory-200/75"
                            >
                              <span className="mt-1 h-1 w-1 rounded-full bg-gold-500 shrink-0" />
                              <span>{insight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* زر اكشف الوثيقة البسيط النظيف: نص صريح بدون أي أيقونات وبدون أي تهنيج أو سلايدر */}
                      <div className="mt-2.5 border-t border-gold-500/15 pt-2">
                        <button
                          type="button"
                          onClick={() => setFlippedId(era.id)}
                          className="flex min-h-9 w-full items-center justify-center rounded-xl border border-gold-500/35 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors duration-200 hover:border-gold-500/60 hover:bg-gold-500/20 dark:text-gold-300 dark:hover:text-gold-100 shadow-xs"
                        >
                          <span>اكشف الوثيقة</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* =========================================
                      الوجه الخلفي للكارت: الوثيقة التاريخية الملكية (Back Face)
                     ========================================= */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                    className={cn(
                      'absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border-2 p-3 text-start shadow-xl',
                      'border-gold-400/80 bg-gradient-to-b from-[#fbf8f0] via-[#f5ecd5] to-[#eedeb8] dark:from-[#0d1e2e] dark:via-[#081522] dark:to-[#040b12]',
                    )}
                  >
                    {/* ملمس البردي الأثري */}
                    <div
                      className="texture-parchment pointer-events-none absolute inset-0 opacity-20"
                      aria-hidden
                    />

                    {/* إطار داخلي زخرفي ملكي */}
                    <div
                      className="pointer-events-none absolute inset-1.5 rounded-xl border border-dashed border-gold-400/25 dark:border-gold-400/20"
                      aria-hidden
                    />

                    {/* علامة مائية فرعونية ناعمة في الخلفية تمنع الفراغ وتضفي عمقاً ملكياً */}
                    <div
                      className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.05] dark:opacity-[0.07] select-none"
                      aria-hidden
                    >
                      <EyeOfHorus className="h-44 w-44 text-gold-500" />
                    </div>

                    {/* شريط علوي ذهبي ملكي */}
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-600"
                      aria-hidden
                    />

                    {/* محتوى الوثيقة التاريخية - بدون أي شريط تمرير أو سلايدر إطلاقاً (overflow-hidden) */}
                    <div className="relative z-10 flex flex-col flex-1 justify-between overflow-hidden select-none">
                      <div>
                        {/* رأس الوثيقة المعتمدة (تم حذف زر الاكس بناءً على طلب المستخدم) */}
                        <div className="flex items-center gap-2 border-b border-gold-500/20 pb-1.5">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-gold-400/40 bg-gradient-to-br from-gold-400/25 to-amber-600/25 text-amber-800 dark:text-gold-300 shadow-xs">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                              <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-gold-400">
                                وثيقة أرشيفية معتمدة
                              </span>
                            </div>
                            <h4 className="font-display text-xs sm:text-[13px] font-black text-midnight-950 dark:text-ivory-50 leading-tight">
                              {era.titleAr}
                            </h4>
                          </div>
                        </div>

                        {/* الإطار التاريخي للعصر */}
                        <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-bold text-amber-900 dark:text-gold-300/90 bg-gold-500/10 dark:bg-gold-500/10 px-2 py-1 rounded-lg border border-gold-500/20">
                          <span className="text-[8.5px] font-medium text-midnight-600 dark:text-ivory-300/70">
                            الإطار التاريخي:
                          </span>
                          <span className="font-black nums-tabular">{era.dynasty}</span>
                        </div>

                        {/* سياق الوثيقة التاريخية */}
                        <div className="mt-1.5 rounded-xl border border-gold-500/20 bg-amber-50/70 dark:bg-midnight-950/70 p-2 shadow-xs">
                          <div className="flex items-center gap-1 text-[8.5px] font-black text-amber-800 dark:text-gold-400 mb-0.5">
                            <span>📜</span>
                            <span>سياق الوثيقة وتحليل العصر:</span>
                          </div>
                          <p className="text-[10px] leading-relaxed text-midnight-900 dark:text-ivory-100/95 font-medium">
                            {era.description}
                          </p>
                        </div>

                        {/* نواتج التعلم ومحاور الفهم بنقاط ماسية ذهبية */}
                        <div className="mt-1.5 border-t border-gold-500/20 pt-1">
                          <div className="flex items-center justify-between text-[9px] font-black text-amber-800 dark:text-gold-400 mb-0.5">
                            <span>أبرز نواتج التعلم ومحاور الفهم:</span>
                            <span className="text-[8px] text-midnight-600 dark:text-ivory-300/60 font-medium">
                              ٣ محاور مركزية
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {era.keyInsights.map((insight) => (
                              <li
                                key={insight}
                                className="flex items-start gap-1.5 text-[9.5px] leading-tight text-midnight-800 dark:text-ivory-200/90"
                              >
                                <span className="mt-0.5 text-gold-500 text-[10px] leading-none shrink-0">
                                  ◆
                                </span>
                                <span className="font-medium">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* بطاقة الفترة ونوع التحليل */}
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          <div className="rounded-lg border border-gold-500/20 bg-gold-500/10 px-2 py-1 text-[9px] font-bold text-amber-900 dark:text-gold-300 flex flex-col">
                            <span className="text-[8px] font-medium text-midnight-600 dark:text-ivory-300/70">
                              الفترة الزمنية:
                            </span>
                            <span className="font-black nums-tabular mt-0.5">
                              {era.historicalPeriod}
                            </span>
                          </div>
                          <div className="rounded-lg border border-gold-500/20 bg-gold-500/10 px-2 py-1 text-[9px] font-bold text-amber-900 dark:text-gold-300 flex flex-col">
                            <span className="text-[8px] font-medium text-midnight-600 dark:text-ivory-300/70">
                              طبيعة التقييم:
                            </span>
                            <span className="font-black mt-0.5">أسئلة الربط والتحليل</span>
                          </div>
                        </div>
                      </div>

                      {/* زر العودة النظيف: نص صريح بدون أي أيقونات وبدون أي تهنيج أو سلايدر */}
                      <div className="mt-2 pt-1 border-t border-gold-500/20">
                        <button
                          type="button"
                          onClick={() => setFlippedId(null)}
                          className="flex min-h-9 w-full items-center justify-center rounded-xl border border-gold-400/80 bg-gradient-to-r from-gold-500/20 via-gold-400/35 to-gold-500/20 hover:from-gold-500/35 hover:via-gold-400/50 hover:to-gold-500/35 px-3 py-1.5 text-xs font-black text-amber-950 dark:text-gold-100 shadow-[0_2px_12px_rgba(245,158,11,0.2)] hover:shadow-[0_2px_18px_rgba(245,158,11,0.4)] transition-colors duration-200"
                        >
                          <span>العودة لبطاقة العصر</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
