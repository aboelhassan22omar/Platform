'use client';

import { motion } from 'motion/react';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import { InteractiveTilt } from '@/components/motion/interactive-tilt';
import {
  HieroglyphRegister,
  TempleCornerBrackets,
  EyeOfHorus,
  AnkhLifeKey,
  LotusBlossom,
  DjedPillar,
} from '@/components/decor/egyptian-motifs';

const HISTORICAL_RELICS = [
  {
    title: 'ميزان العدالة: شراء بالدرس',
    badge: 'استقلالية كاملة',
    body: 'مش مجبر تدفع اشتراك شهري كامل؛ تقدر تشتري أي درس محتاجه لوحده ويفضل معاك مدى الحياة تراجعه في أي وقت.',
    iconType: 'scale',
  },
  {
    title: 'خزائن الحكمة: باقات فصول موفرة',
    badge: 'وفر أكثر',
    body: 'اشترك في باقة الفصل بالكامل أو الباقة الشهرية ووفر لحد ٤٠٪ مع كل المذكرات والامتحانات الشاملة.',
    iconType: 'treasury',
  },
  {
    title: 'سجل الأنساب: تقارير لولي الأمر',
    badge: 'متابعة لحظية',
    body: 'حساب مخصص لولي الأمر برقم موبايله لمتابعة الحضور، الامتحانات، ومعدل المشاهدة أولاً بأول.',
    iconType: 'ledger',
  },
  {
    title: 'بردية الأجهزة: استئناف المشاهدة',
    badge: 'مرونة الاستخدام',
    body: 'ابدأ الدرس على الموبايل وكمّله على اللابتوب أو التابلت؛ المنصة بتسجل الثانية اللي وقفت عندها بدقة.',
    iconType: 'mobile',
  },
  {
    title: 'صرح الحماية: مشغل فيديو آمن',
    badge: 'جودة فائقة',
    body: 'بث سريع ومحمي بتقنية التكيف التلقائي مع سرعة الإنترنت، شغال حتى مع أضعف باقات الموبايل.',
    iconType: 'pyramid',
  },
  {
    title: 'بوابة النور: دروس تجريبية مجانية',
    badge: 'المحراب المفتوح',
    body: 'في كل صف دراسي، توجد حصص نموذجية مفتوحة مجاناً بالكامل، اتفرج عليها وجرب طريقة الشرح بنفسك قبل أي التزام.',
    iconType: 'gate',
  },
];

export function FeatureGrid() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-gradient-to-b from-[#fbf8f0] via-[#f5edd8] to-[#eee2c6] dark:from-[#030912] dark:via-[#05131f] dark:to-[#06121e] py-20 sm:py-28 text-midnight-950 dark:text-ivory-50 transition-colors duration-300"
    >
      <div className="texture-parchment pointer-events-none absolute inset-0 opacity-25" aria-hidden />

      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 right-1/4 w-96 h-96 rounded-full blur-[140px] opacity-15 bg-gold-400"
      />

      {/* هالة تدرج سفلي ناعمة تدمج القسم بانسيابية مع القسم التالي */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 inset-x-0 h-48 opacity-25 dark:opacity-15"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgb(245 158 11 / 0.25), transparent 75%)',
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
            <LotusBlossom className="h-4 w-5" />
            دستور التفوق التاريخي
          </span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-black text-midnight-950 dark:text-ivory-50">
            أركان المنصة: <span className="text-gradient-gold">صُنعت لتذاكر باقتدار</span>
          </h2>
          <p className="mt-3.5 text-base sm:text-lg leading-relaxed text-midnight-800/80 dark:text-ivory-200/80">
            كل ميزة في المنصة مستوحاة من ركائز الانضباط التاريخي؛ لتمنحك الراحة والمرونة القصوى وتجعل المذاكرة تجربة مشوقة.
          </p>

          <div className="mt-6">
            <HieroglyphRegister />
          </div>
        </motion.div>

        <motion.ul
          variants={staggerContainer(0.08, 0.12)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '0px 0px -8% 0px' }}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {HISTORICAL_RELICS.map((relic) => (
            <motion.li
              key={relic.title}
              variants={{
                hidden: { opacity: 0, y: 28 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: EASE_ENTRANCE },
                },
              }}
              className="h-full"
            >
              <InteractiveTilt className="group h-full rounded-2xl border border-gold-500/25 bg-white/95 dark:bg-midnight-950/80 p-7 transition-all duration-300 hover:border-gold-400/60 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)] shadow-xs">
                <TempleCornerBrackets />

                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-gold-400/40 bg-gold-400/10 text-amber-700 dark:text-gold-300 transition-colors duration-300 group-hover:bg-gold-500 group-hover:text-midnight-950 shadow-xs">
                    {relic.iconType === 'scale' && <EyeOfHorus className="h-6 w-7" />}
                    {relic.iconType === 'treasury' && <AnkhLifeKey className="h-6 w-5" />}
                    {relic.iconType === 'ledger' && <DjedPillar className="h-6 w-5" />}
                    {relic.iconType === 'mobile' && <LotusBlossom className="h-6 w-7" />}
                    {relic.iconType === 'pyramid' && <EyeOfHorus className="h-6 w-7" />}
                    {relic.iconType === 'gate' && <AnkhLifeKey className="h-6 w-5" />}
                  </span>

                  <span className="text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded bg-gold-500/10 border border-gold-500/20 text-amber-800 dark:text-gold-300">
                    {relic.badge}
                  </span>
                </div>

                <h3 className="mt-5 font-display text-xl font-black text-midnight-950 dark:text-ivory-50 group-hover:text-amber-700 dark:group-hover:text-gold-200 transition-colors">
                  {relic.title}
                </h3>

                <p className="mt-2.5 text-sm leading-relaxed text-midnight-700/80 dark:text-ivory-200/75">
                  {relic.body}
                </p>
              </InteractiveTilt>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

