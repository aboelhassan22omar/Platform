import type { Metadata } from 'next';
import Image from 'next/image';
import { Reveal } from '@/components/motion/reveal';
import { fadeUp } from '@/lib/motion';
import { ButtonLink } from '@/components/ui/button';
import {
  RoyalCartouche,
  HieroglyphCorner,
  PlatformLogo,
  WingedSunOfHorus,
  HieroglyphRegister,
} from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';
import { GenericAbout } from '@/features/about/generic-about';

export const metadata: Metadata = {
  title: `عن ${platformConfig.teacher.displayName} | ${platformConfig.teacher.tagline}`,
  description: `تعرّف على ${platformConfig.teacher.displayName} ومنهجيته التعليمية في تبسيط وفهم مادة ${platformConfig.subject.name}.`,
};

const STATS = [
  { value: '+١٥', label: 'عاماً من الخبرة والعطاء', sub: 'في تدريس مناهج التاريخ والثانوية' },
  { value: '+٢٥,٠٠٠', label: 'طالب وطالبة تخرجوا', sub: 'من مختلف محافظات جمهورية مصر العربية' },
  { value: '٩٩.٤٪', label: 'نسبة النجاح والتفوق', sub: 'بين طلاب المنصة في الامتحانات الرسمية' },
  {
    value: '+١٢٠',
    label: 'من أوائل الجمهورية والإدارات',
    sub: `تتلمذوا على يد ${platformConfig.teacher.tagline}`,
  },
];

const PILLARS = [
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'الفهم والتحليل قبل الحفظ',
    description:
      'نرفض أسلوب التلقين والحفظ الأعمى. نحول التاريخ إلى قصة حية مشوقة ذات حبكة درامية وربط سببي ذكي بين الأحداث والفرمانات، لترسخ في ذهن الطالب دون مجهود مضاعف.',
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'خرائط زمنية وجداول مقارنة ذكية',
    description:
      'أحدث استراتيجيات الخرائط الذهنية والربط الجغرافي المكاني، مما يمكن الطالب من المقارنة بين الشخصيات والمعاهدات والثورات في لمح البصر وحل أسئلة الربط المعقدة.',
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    title: 'بنك أسئلة نواتج التعلم الحديثة',
    description:
      'تدريب مكثف على أسئلة الفهم العميق والمستويات العليا، والأسئلة الاستنتاجية التي تحاكي مواصفات الورقة الامتحانية لوزارة التربية والتعليم بدقة متناهية.',
  },
  {
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'متابعة دورية وتقارير أداء فورية',
    description:
      'فريق إشراف وتوجيه متكامل، امتحانات إلكترونية فورية التصحيح مع تحليل لنقاط القوة والضعف، وتقارير دورية ترفع لولي الأمر لمتابعة تقدم الطالب أولاً بأول.',
  },
];

const TESTIMONIALS = [
  {
    name: 'أحمد محمود القاضي',
    school: 'الأول على محافظة الجيزة — ٦٠/٦٠ في التاريخ',
    quote: `${platformConfig.teacher.displayName} مش مجرد مدرس تاريخ، ده بيخليك تعيش العصر بكل تفاصيله. خرائطه الذهنية وطريقة ربطه للفرمانات والمعاهدات خلت التاريخ أسهل وأمتع مادة عندي في تالتة ثانوي.`,
  },
  {
    name: 'مريم شريف عبد الرحمن',
    school: 'المركز الخامس جمهورية — الثانوية العامة',
    quote: `كنت خايفة جداً من حفظ التواريخ والأحداث، لكن مع ${platformConfig.teacher.tagline} وشرح ${platformConfig.teacher.displayName}، فهمت نواتج التعلم وعرفت إزاي أحل أي سؤال غير نمطي بثقة وسرعة.`,
  },
  {
    name: 'يوسف طارق النجار',
    school: 'طالب بكالوريا مصرية — درجات نهائية',
    quote:
      'المنصة المنظمة والامتحانات بعد كل حصة كانت السبب إني قفلت التاريخ بدون أي ضغط عصبي. شكراً لأعظم مؤرخ في مصر!',
  },
];

export default function AboutPage() {
  if (platformConfig.subject.key !== 'history') return <GenericAbout />;
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbf8f0] via-[#f7f2e4] to-[#eee2c6] dark:from-[#030712] dark:via-[#05131f] dark:to-[#081726] text-midnight-950 dark:text-ivory-50 transition-colors duration-300">
      {/* --- الهيدر الملكي لصفحة عن الأستاذ --- */}
      <section className="relative overflow-hidden min-h-[540px] sm:min-h-[600px] lg:min-h-[660px] xl:min-h-[700px] flex items-center bg-[#040a14] text-ivory-50 py-16 sm:py-20 lg:py-24 border-b border-gold-500/20">
        {/* خلفية الصرح التاريخي ومستر عمرو محروس بالبدلة السوداء والمخطوطات — مقاس بانورامي كامل (ديسكتوب وتابلت فقط >= md) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          <Image
            src="/images/about-hero-banner.jpg"
            alt={`${platformConfig.teacher.displayName} في صرح التاريخ المصري القديم`}
            fill
            priority
            unoptimized
            className="object-cover object-[26%_top]"
          />
        </div>

        {/* دمج ناعم وسلس من اليمين يضمن وضوح النصوص مع إبقاء مستر عمرو وصرح المكتبة والفوانيس بوضوح تام */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden md:block bg-[linear-gradient(to_top,#040a14_0%,rgb(4_10_20/0.75)_50%,rgb(4_10_20/0.15)_100%)] sm:bg-[linear-gradient(to_left,#040a14_0%,#040a14_20%,rgb(4_10_20/0.85)_35%,rgb(4_10_20/0.35)_55%,transparent_72%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbf8f0] dark:from-[#030712] via-transparent to-transparent"
        />

        <div className="container-page relative z-10 w-full">
          <Reveal variants={fadeUp}>
            <div className="max-w-2xl sm:mr-auto lg:mr-0 ml-auto text-right">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/15 px-4 py-1.5 text-xs font-black text-gold-300 mb-4 shadow-sm backdrop-blur-xs">
                <WingedSunOfHorus className="h-4 w-7 text-gold-400" />
                {platformConfig.teacher.tagline} — رحلة ١٥ عاماً من الريادة وصناعة الأوائل
              </span>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ivory-50 leading-tight">
                الأستاذ{' '}
                <span className="text-gradient-gold">{platformConfig.teacher.shortName}</span>
              </h1>

              <p className="mt-4 text-base sm:text-lg leading-relaxed text-ivory-200/90 font-medium max-w-xl">
                خبير مادة التاريخ للثانوية العامة والبكالوريا المصرية، وصاحب البصمة الأبرز في تبسيط
                المناهج وبناء الوعي التاريخي الحقيقي وتأهيل الطلاب للمراكز الأولى على مستوى
                الجمهورية.
              </p>

              {/* شريط تعريف الأستاذ على الهاتف فقط (< md) */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gold-500/30 bg-[#06121d]/90 p-3 shadow-lg backdrop-blur-md md:hidden">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gold-500/50 shadow-md">
                  <Image
                    src="/images/teacher-about-portrait.jpg"
                    alt={platformConfig.teacher.displayName}
                    fill
                    sizes="56px"
                    className="object-cover object-top"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-black text-ivory-50 truncate">
                    {platformConfig.teacher.displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-gold-300 truncate">
                    خبرة ١٥ عاماً في تدريس التاريخ
                  </p>
                </div>
              </div>

              <div className="mt-5 max-w-xs">
                <HieroglyphRegister />
              </div>

              {/* أوسمة تميز الأستاذ */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-200">
                  <span>𓋹</span>
                  <span>١٥+ عاماً خبرة في تدريس التاريخ</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-200">
                  <span>𓂀</span>
                  <span>مؤلف سلسلة «{platformConfig.teacher.tagline}»</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-bold text-gold-200">
                  <span>𓎛</span>
                  <span>صانع أوائل الجمهورية والإدارات</span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- قسم السيرة الذاتية وصورة البرواز الملكي الفخمة --- */}
      <section className="container-page py-12 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
          {/* البرواز الملكي الفخم لصورة مستر عمرو محروس الرسمية */}
          <Reveal variants={fadeUp}>
            <div className="relative group">
              {/* هالة التوهج الذهبي خلف البرواز */}
              <div
                aria-hidden
                className="absolute -inset-2 rounded-3xl opacity-50 blur-xl transition-opacity duration-500 group-hover:opacity-75"
                style={{
                  background: 'radial-gradient(circle, rgb(200 149 42 / 0.45), transparent 70%)',
                }}
              />

              <div className="relative overflow-hidden rounded-3xl border-2 border-gold-500/50 bg-[#060d19] shadow-2xl">
                <HieroglyphCorner position="top-left" />
                <HieroglyphCorner position="top-right" />
                <HieroglyphCorner position="bottom-left" />
                <HieroglyphCorner position="bottom-right" />

                {/* صورة مستر عمرو محروس الأصلية الرسمية داخل البرواز */}
                <div className="relative aspect-[3/4] w-full overflow-hidden">
                  <Image
                    src="/images/teacher-about-portrait.jpg"
                    alt={`${platformConfig.teacher.displayName} - ${platformConfig.teacher.tagline}`}
                    fill
                    priority
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 360px"
                    className="object-cover object-[center_top] transition-transform duration-700 group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-[#060d19]/90 via-transparent to-transparent opacity-80"
                  />

                  {/* الخرطوشة الملكية المثبتة بأسفل البرواز — تم إبقاء اسم المستر فقط */}
                  <div className="absolute bottom-3.5 inset-x-4 text-center">
                    <RoyalCartouche variant="gold">
                      <span className="text-xs font-black tracking-wider">
                        {platformConfig.teacher.displayName}
                      </span>
                    </RoyalCartouche>
                    <p className="mt-2 text-xs font-bold text-ivory-100 drop-shadow">
                      مؤلف ومؤسس منصة «{platformConfig.brand.shortPlatformName}»
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* نصوص السيرة والفلسفة التعليمية */}
          <Reveal variants={fadeUp} delay={0.08}>
            <div className="space-y-6 leading-loose text-midnight-800 dark:text-ivory-200">
              <div className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gold-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-gold-600 dark:text-gold-400">
                  السيرة والمسيرة التعليمية
                </span>
              </div>

              <h2 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl leading-snug">
                التاريخ قصة تُروى ووعي يُبنى،{' '}
                <span className="text-gradient-gold">وليس مجرد تواريخ تُحفظ</span>
              </h2>

              <p className="text-base text-midnight-700 dark:text-ivory-200/90 leading-relaxed">
                على مدار أكثر من عقد ونصف، كرّس{' '}
                <strong>{platformConfig.teacher.displayName}</strong> جهوده لتغيير المفهوم التقليدي
                عن مادة التاريخ في أذهان طلاب الثانوية العامة والبكالوريا المصرية. فبدلاً من أن تكون
                المادة عبئاً للحفظ المرهق والنسيان السريع، أصبحت مع «
                {platformConfig.teacher.tagline}» رحلة عقلية ثرية وممتعة عبر الحضارات، تكشف أسرار
                الماضي وتفسر وقائع الحاضر.
              </p>

              <p className="text-base text-midnight-700 dark:text-ivory-200/90 leading-relaxed">
                يقدم {platformConfig.teacher.displayName} منهجية تدريس استثنائية ترتكز على تفكيك
                نواتج التعلم الوزارية، وربط الأسباب بالنتائج عبر الخرائط الذهنية والوثائق التاريخية
                المصورة، مما مكن عشرات الآلاف من الطلاب عبر السنين من اجتياز الامتحانات المصيرية
                بثقة واقتدار واعتلاء منصات التتويج بين أوائل الجمهورية.
              </p>

              {/* بطاقات إحصائيات سريعة */}
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-gold-500/30 bg-white/80 dark:bg-midnight-900/80 p-3.5 text-center shadow-sm backdrop-blur-xs">
                  <span className="block text-xl font-black text-gold-600 dark:text-gold-400">
                    ١٥+
                  </span>
                  <span className="text-xs font-bold text-midnight-600 dark:text-ivory-300">
                    سنة خبرة وتألق
                  </span>
                </div>
                <div className="rounded-2xl border border-gold-500/30 bg-white/80 dark:bg-midnight-900/80 p-3.5 text-center shadow-sm backdrop-blur-xs">
                  <span className="block text-xl font-black text-gold-600 dark:text-gold-400">
                    ٢٥ ألف+
                  </span>
                  <span className="text-xs font-bold text-midnight-600 dark:text-ivory-300">
                    طالب متميز
                  </span>
                </div>
                <div className="col-span-2 rounded-2xl border border-gold-500/30 bg-white/80 dark:bg-midnight-900/80 p-3.5 text-center shadow-sm sm:col-span-1 backdrop-blur-xs">
                  <span className="block text-xl font-black text-gold-600 dark:text-gold-400">
                    الأوائل
                  </span>
                  <span className="text-xs font-bold text-midnight-600 dark:text-ivory-300">
                    جمهورية وإدارات
                  </span>
                </div>
              </div>

              {/* أزرار الإجراءات السريعة */}
              <div className="flex flex-wrap gap-4 pt-4">
                <ButtonLink
                  href="/grades"
                  variant="accent"
                  size="lg"
                  className="bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 text-midnight-950 font-black shadow-lg hover:shadow-gold-500/20"
                >
                  استكشف المناهج والصفوف
                </ButtonLink>
                <ButtonLink
                  href="/contact"
                  variant="outline"
                  size="lg"
                  className="border-gold-500/40 text-midnight-900 dark:text-ivory-50 hover:border-gold-500 hover:bg-gold-500/10"
                >
                  تواصل مع الأستاذ وفريقه
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- شريط الأرقام والإنجازات الذهبي --- */}
      <section className="border-y border-gold-500/20 bg-[#040a14] py-12 text-white">
        <div className="container-page">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((stat, i) => (
              <Reveal key={stat.label} variants={fadeUp} delay={i * 0.08}>
                <div className="text-center">
                  <p className="font-display text-3xl font-black text-gold-400 sm:text-4xl drop-shadow-sm">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-ivory-100">{stat.label}</p>
                  <p className="mt-0.5 text-xs text-ivory-300/70">{stat.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- ركائز منهج أسطورة التاريخ --- */}
      <section className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <RoyalCartouche variant="gold">
            <span className="text-xs font-bold tracking-wider">منظومة التفوق والريادة</span>
          </RoyalCartouche>
          <h2 className="mt-4 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
            ركائز منهج <span className="text-gradient-gold">{platformConfig.teacher.tagline}</span>
          </h2>
          <p className="mt-2 text-sm text-midnight-600 dark:text-ivory-300/75">
            كيف نصنع الفارق ونحول التاريخ إلى مادة التفوق الأولى لطلابنا بالثانوية والبكالوريا؟
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
          {PILLARS.map((pillar, idx) => (
            <Reveal key={pillar.title} variants={fadeUp} delay={idx * 0.07}>
              <div className="group relative rounded-2xl border border-gold-500/25 bg-white/90 dark:bg-midnight-900/80 p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/50 hover:shadow-xl backdrop-blur-xs">
                <span
                  aria-hidden
                  className="grid h-12 w-12 place-items-center rounded-xl bg-gold-500/10 text-gold-600 dark:text-gold-400 transition-colors group-hover:bg-gold-500 group-hover:text-midnight-950"
                >
                  {pillar.icon}
                </span>
                <h3 className="mt-4 font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-midnight-600 dark:text-ivory-300/80">
                  {pillar.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- شهادات الأبطال والطلاب الأوائل --- */}
      <section className="border-t border-gold-500/20 bg-gold-500/5 dark:bg-[#040c17]/60 py-16 sm:py-24">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-gold-600 dark:text-gold-400">
              شهادات الأبطال
            </span>
            <h2 className="mt-2 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
              قصص نجاح من دفعة{' '}
              <span className="text-gradient-gold">{platformConfig.teacher.tagline}</span>
            </h2>
            <p className="mt-2 text-sm text-midnight-600 dark:text-ivory-300/75">
              طلاب وثقوا بالمنهج وحققوا الدرجات النهائية والمراكز الأولى على مستوى مصر.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, idx) => (
              <Reveal key={t.name} variants={fadeUp} delay={idx * 0.08}>
                <div className="flex h-full flex-col justify-between rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-900 p-6 shadow-sm">
                  <div>
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-midnight-700 dark:text-ivory-200/90 italic">
                      &laquo;{t.quote}&raquo;
                    </p>
                  </div>
                  <div className="mt-6 border-t border-gold-500/20 pt-4">
                    <p className="font-display text-sm font-extrabold text-midnight-950 dark:text-ivory-100">
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gold-600 dark:text-gold-400">{t.school}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- مرسوم البدء الملكي (Call to Action) --- */}
      <section className="container-page py-16 text-center">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border-2 border-gold-500/40 bg-gradient-to-b from-[#060d19] to-[#040a14] p-8 sm:p-12 text-white shadow-2xl">
          <PlatformLogo variant="mark" size="md" className="mx-auto mb-4" />
          <h2 className="font-display text-2xl font-black text-ivory-50 sm:text-3xl">
            جاهز تنضم لأبطال التاريخ هذا العام؟
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-ivory-200/80">
            سواء كنت في الثانوية العامة أو البكالوريا المصرية، مكانك محفوظ بين الأوائل. ابدأ رحلتك
            التعليمية مع {platformConfig.teacher.displayName} الآن.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <ButtonLink
              href="/grades"
              variant="accent"
              size="lg"
              className="bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 text-midnight-950 font-black shadow-lg"
            >
              ابدأ المذاكرة الآن
            </ButtonLink>
            <ButtonLink
              href="/contact"
              variant="outline"
              size="lg"
              className="border-gold-400/40 text-ivory-100 hover:border-gold-400"
            >
              استفسر عن المواعيد والسناتر
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
