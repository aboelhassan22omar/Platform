'use client';

import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { EASE_ENTRANCE } from '@/lib/motion';
import {
  TempleCornerBrackets,
  DjedPillar,
  HieroglyphRegister,
} from '@/components/decor/egyptian-motifs';

interface TimelineStation {
  year: string;
  title: string;
  epoch: string;
  note: string;
  grade: string;
  grades: string[];
  glyph: string;
  highlight: string;
}

const HISTORICAL_STATIONS: TimelineStation[] = [
  {
    year: '٣١٠٠ ق.م',
    title: 'توحيد القطرين وفجر الحضارة',
    epoch: 'العصر العتيق والدولة القديمة',
    note: 'الملك مينا يوحد التاجين ويؤسس أول دولة مركزية منظمة في تاريخ البشرية وبداية عصر بناة الأهرام.',
    grade: 'الصف الأول الثانوي',
    grades: ['أولى ثانوي', 'أولى بكالوريا'],
    glyph: '𓋹',
    highlight: 'لوحة نارمر وتأسيس نظام الحكم المركزي',
  },
  {
    year: '٣٣٢ ق.م',
    title: 'الإسكندرية ومنارة العلم',
    epoch: 'العصر الهيلينستي والروماني',
    note: 'تأسيس الإسكندرية كأعظم مركز علمي وحضاري يربط الشرق بالغرب، ومصر تحت حكم البطالمة والرومان.',
    grade: 'الصف الأول الثانوي',
    grades: ['أولى ثانوي', 'أولى بكالوريا'],
    glyph: '𓂀',
    highlight: 'المكتبة والمنارة والتجارة البحرية الدولية',
  },
  {
    year: '٦٤١ م',
    title: 'الفسطاط والقاهرة التاريخية',
    epoch: 'الحضارة الإسلامية والمملوكية',
    note: 'بناء الفسطاط، وتأسيس القاهرة الفاطمية وقلعة صلاح الدين وعصر المماليك كدرع العالم الإسلامي.',
    grade: 'الصف الثاني الثانوي',
    grades: ['تانية ثانوي'],
    glyph: '𓉐',
    highlight: 'العمارة الإسلامية والتجارة العالمية والمقاومة',
  },
  {
    year: '١٧٩٨ م',
    title: 'الحملة الفرنسية وبداية الصدمة',
    epoch: 'احتكاك مصر بأوروبا الحديثة',
    note: 'مقاومة الشعب المصري للفرنسيين في الصعيد والقاهرة، حجر رشيد، واكتشاف أسرار الكتابة الهيروغليفية.',
    grade: 'الصف الثالث الثانوي',
    grades: ['تالتة ثانوي'],
    glyph: '𓌃',
    highlight: 'ثورات القاهرة والمجمع العلمي وفك رموز رشيد',
  },
  {
    year: '١٨٠٥ م',
    title: 'محمد علي وبناء الدولة الحديثة',
    epoch: 'النهضة الكبرى والجيش الوطني',
    note: 'إرادة الشعب تختار حاكمها لأول مرة؛ بناء الجيش، نظام الاحتكار، المدارس العليا، والتوسع الإقليمي.',
    grade: 'الصف الثالث الثانوي',
    grades: ['تالتة ثانوي'],
    glyph: '𓍯',
    highlight: 'مشروع النهضة والسياسة الخارجية وبناء الجيش',
  },
  {
    year: '١٩٥٢ م',
    title: 'ثورة يوليو ومصر المعاصرة',
    epoch: 'التحولات الوطنية والجمهورية',
    note: 'إسقاط الملكية، جلاء القوات البريطانية، تأميم قناة السويس، معركة السد العالي، وملحمة نصر أكتوبر.',
    grade: 'الصف الثالث الثانوي',
    grades: ['تالتة ثانوي', 'تانية بكالوريا'],
    glyph: '𓆣',
    highlight: 'السيادة الوطنية واستعادة القناة وملحمة أكتوبر',
  },
];

export function HistoryTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const [activeStation, setActiveStation] = useState<number | null>(null);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-gradient-to-b from-[#eee2c6] via-[#f7f2e4] to-[#fbf8f0] dark:from-[#081726] dark:via-[#05131f] dark:to-[#030912] py-20 sm:py-28 text-midnight-950 dark:text-ivory-50 transition-colors duration-300"
    >
      <div
        className="texture-parchment pointer-events-none absolute inset-0 opacity-25"
        aria-hidden
      />

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 inset-x-0 h-96 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% 100%, rgb(245 158 11 / 0.35), transparent 75%)',
        }}
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
            <DjedPillar className="h-4 w-4" />
            مخطوطة النيل الخالدة
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-black text-midnight-950 dark:text-ivory-50">
            شريان التاريخ: <span className="text-gradient-gold">رحلة ٥٠ قرناً</span>
          </h2>
          <p className="mt-3.5 text-base sm:text-lg leading-relaxed text-midnight-800/80 dark:text-ivory-200/80">
            كل محطة تاريخية شكلت عقل الأمة ومصيرها. مرر عبر العصور وشاهد كيف يترابط منهجك خطوة
            بخطوة.
          </p>

          <div className="mt-6">
            <HieroglyphRegister />
          </div>
        </motion.div>

        <div className="mt-16 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {HISTORICAL_STATIONS.map((station, index) => {
              const isSelected = activeStation === index;
              return (
                <motion.div
                  key={station.year}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '0px 0px -6% 0px' }}
                  transition={{ delay: index * 0.08, duration: 0.5, ease: EASE_ENTRANCE }}
                  whileHover={{ y: -6, transition: { duration: 0.25, ease: 'easeOut' } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveStation((prev) => (prev === index ? null : index))}
                  className={`group relative rounded-2xl border-2 p-6 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'border-gold-400 bg-white dark:bg-midnight-900/95 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-gold-400/50'
                      : 'border-gold-500/20 bg-white/90 dark:bg-midnight-950/70 hover:border-gold-400/70 hover:shadow-[0_0_24px_rgba(245,158,11,0.18)] shadow-xs'
                  }`}
                >
                  <TempleCornerBrackets />

                  <div>
                    <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-500/20 text-amber-800 dark:text-gold-300 text-base font-serif">
                          {station.glyph}
                        </span>
                        <span className="font-display text-lg font-black text-amber-800 dark:text-gold-300 nums-tabular">
                          {station.year}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gold-400/10 text-amber-800 dark:text-gold-400 border border-gold-400/20">
                        {station.epoch}
                      </span>
                    </div>

                    <div className="mt-4">
                      <h3 className="font-display text-lg font-extrabold text-midnight-950 dark:text-ivory-50 group-hover:text-amber-700 dark:group-hover:text-gold-200 transition-colors">
                        {station.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-midnight-700/80 dark:text-ivory-200/75">
                        {station.note}
                      </p>
                    </div>
                  </div>

                  {/* في المنهج الدراسي - تصميم بسيط وأنيق ومريح */}
                  <div className="mt-4 pt-3 border-t border-gold-500/15">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-amber-800 dark:text-gold-400 shrink-0">
                        في المنهج الدراسي:
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {station.grades.map((grade) => (
                          <span
                            key={grade}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-gold-500/10 dark:bg-gold-500/15 text-amber-900 dark:text-gold-200 border border-gold-500/20"
                          >
                            {grade}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-midnight-700/80 dark:text-ivory-200/75">
                      <span className="text-gold-500 text-[8px] mt-1 shrink-0">●</span>
                      <span className="leading-relaxed">{station.highlight}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {activeStation !== null ? (
            <motion.div
              key={activeStation}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="mt-10 rounded-2xl border border-gold-400/50 bg-white/95 dark:bg-midnight-950/85 p-5 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_25px_rgba(245,158,11,0.2)]"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl font-serif text-amber-600 dark:text-gold-400">
                  {HISTORICAL_STATIONS[activeStation].glyph}
                </span>
                <div>
                  <span className="text-xs text-amber-700 dark:text-gold-400 font-bold block">
                    المحطة المختارة: {HISTORICAL_STATIONS[activeStation].year}
                  </span>
                  <span className="font-display text-base sm:text-lg font-black text-midnight-950 dark:text-ivory-50 block">
                    {HISTORICAL_STATIONS[activeStation].title} —{' '}
                    {HISTORICAL_STATIONS[activeStation].epoch}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveStation(null)}
                  className="text-xs font-bold text-midnight-600 hover:text-amber-800 dark:text-ivory-300 dark:hover:text-gold-300 px-3 py-1.5 rounded-lg border border-gold-400/20 hover:bg-gold-500/10 transition-colors"
                >
                  إلغاء التحديد
                </button>
                <a
                  href="#pathway"
                  className="px-4 py-2 rounded-xl bg-gold-500/20 border border-gold-400/50 text-amber-800 dark:text-gold-300 text-xs font-black hover:bg-gold-500 hover:text-midnight-950 transition-colors"
                >
                  اختر صفك وابدأ
                </a>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="timeline-guide"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-10 rounded-2xl border border-gold-400/30 bg-white/95 dark:bg-midnight-950/80 p-5 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl font-serif text-amber-600 dark:text-gold-400">𓋹</span>
                <div>
                  <span className="text-xs text-amber-700 dark:text-gold-400 font-bold block">
                    شريان التاريخ المصري عبر ٥٠ قرناً
                  </span>
                  <span className="font-display text-base sm:text-lg font-black text-midnight-950 dark:text-ivory-50 block">
                    اضغط على أي محطة لاستعراض تفاصيلها وربطها بالمنهج الدراسي
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="#pathway"
                  className="px-4 py-2 rounded-xl bg-gold-500/20 border border-gold-400/50 text-amber-800 dark:text-gold-300 text-xs font-black hover:bg-gold-500 hover:text-midnight-950 transition-colors"
                >
                  اختر صفك وابدأ
                </a>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
