import Image from 'next/image';
import Link from 'next/link';
import { platformConfig } from '@/config/platform.config';
import { getSubjectProfile } from '@/config/subject-profile';
import type { EducationSystemSummary } from '@/types/api';
import { PathwaySelector } from './pathway-selector';

export function GenericSubjectHome({ systems }: { systems: EducationSystemSummary[] }) {
  const profile = getSubjectProfile(platformConfig.subject.key);

  return (
    <div className="min-h-screen bg-[#fcfaf4] text-midnight-950 dark:bg-[#030712] dark:text-ivory-50">
      <section
        className="relative isolate overflow-hidden px-4 py-16 sm:py-24"
        style={{ background: `linear-gradient(135deg, ${profile.accent.from}, ${profile.accent.via}, ${profile.accent.to})` }}
      >
        <div className="container-page grid items-center gap-10 lg:grid-cols-2">
          <div className="relative z-10 text-ivory-50">
            <p className="text-sm font-black text-gold-300">{profile.hero.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              {profile.hero.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-ivory-200 sm:text-lg">
              {profile.hero.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="inline-flex min-h-11 items-center rounded-xl bg-gold-500 px-6 font-black text-midnight-950 transition hover:bg-gold-400" href="#pathway">
                اختار صفك وابدأ
              </Link>
              <Link className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-6 font-bold text-white transition hover:bg-white/10" href="/about">
                اعرف أكثر عن {platformConfig.teacher.displayName}
              </Link>
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-white/5 shadow-2xl">
            <Image src={profile.hero.image} alt={platformConfig.teacher.displayName} fill priority sizes="(max-width: 1024px) 90vw, 420px" className="object-cover" />
          </div>
        </div>
      </section>

      <section className="container-page py-14 sm:py-20" aria-labelledby="platform-benefits">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-black text-gold-700 dark:text-gold-300">كل ما تحتاجه في مكان واحد</p>
          <h2 id="platform-benefits" className="mt-2 font-display text-3xl font-black sm:text-4xl">طريقة أبسط لإتقان {platformConfig.subject.name}</h2>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {profile.benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-2xl border border-gold-500/20 bg-white p-6 shadow-card dark:bg-midnight-950/70">
              <h3 className="font-display text-xl font-black">{benefit.title}</h3>
              <p className="mt-3 leading-7 text-midnight-600 dark:text-ivory-300/75">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <div id="pathway" className="scroll-mt-20"><PathwaySelector systems={systems} /></div>
    </div>
  );
}
