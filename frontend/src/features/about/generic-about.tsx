import Image from 'next/image';
import Link from 'next/link';
import { platformConfig } from '@/config/platform.config';

const teachingPrinciples = [
  ['الفهم قبل الحفظ', 'كل درس يبدأ بالصورة الكبيرة ثم ينتقل للتفاصيل والأسئلة.'],
  ['التدرج', 'المحتوى مرتب من التأسيس إلى المستويات الأعلى بدون قفزات مربكة.'],
  ['القياس المستمر', 'اختبارات قصيرة ومتابعة تقدم تكشف نقاط القوة والتحسن مبكرًا.'],
] as const;

export function GenericAbout() {
  return (
    <main className="min-h-screen bg-[#fcfaf4] text-midnight-950 dark:bg-[#030712] dark:text-ivory-50">
      <section className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <p className="text-sm font-black text-gold-700 dark:text-gold-300">عن الأستاذ</p>
          <h1 className="mt-3 text-balance font-display text-4xl font-black sm:text-5xl">{platformConfig.teacher.displayName}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-9 text-midnight-600 dark:text-ivory-300/80">
            هدفنا أن تصبح مادة {platformConfig.subject.name} مفهومة ومنظمة، وأن يعرف كل طالب ماذا يذاكر وكيف يتدرب وكيف يقيس تقدمه.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/grades" className="inline-flex min-h-11 items-center rounded-xl bg-gold-500 px-6 font-black text-midnight-950 hover:bg-gold-400">استعرض المناهج</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center rounded-xl border border-gold-500/35 px-6 font-bold hover:bg-gold-500/10">تواصل معنا</Link>
          </div>
        </div>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl border border-gold-500/20 shadow-lifted">
          <Image src="/images/teacher-hero.png" alt={platformConfig.teacher.displayName} fill priority sizes="(max-width: 1024px) 90vw, 420px" className="object-cover" />
        </div>
      </section>
      <section className="container-page pb-20" aria-labelledby="teaching-method">
        <h2 id="teaching-method" className="text-center font-display text-3xl font-black">منهجية تعليم واضحة</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {teachingPrinciples.map(([title, description]) => <article key={title} className="rounded-2xl border border-gold-500/20 bg-white p-6 dark:bg-midnight-950/75"><h3 className="font-display text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-midnight-600 dark:text-ivory-300/75">{description}</p></article>)}
        </div>
      </section>
    </main>
  );
}
