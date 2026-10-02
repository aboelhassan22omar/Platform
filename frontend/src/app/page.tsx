import { apiFetchServer } from '@/lib/api';
import { headers } from 'next/headers';
import { HomeHero } from '@/features/home/hero';
import { LivingMuseum } from '@/features/home/living-museum';
import { PathwaySelector } from '@/features/home/pathway-selector';
import { FeatureGrid } from '@/features/home/feature-grid';
import { HistoryTimeline } from '@/features/home/history-timeline';
import { HomeCta } from '@/features/home/home-cta';
import type { EducationSystemSummary } from '@/types/api';
import { platformConfig } from '@/config/platform.config';
import { GenericSubjectHome } from '@/features/home/generic-subject-home';

// The catalogue changes rarely; a short revalidate keeps the homepage fast
// without serving a stale course list for long.
export const revalidate = 60;

export default async function HomePage() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const systems =
    (await apiFetchServer<EducationSystemSummary[]>('/academic/systems', cookieHeader)) ??
    [];

  if (platformConfig.subject.key !== 'history') {
    return <GenericSubjectHome systems={systems} />;
  }

  return (
    <main className="bg-[#fcfaf4] dark:bg-[#030712] min-h-screen text-midnight-950 dark:text-ivory-50 selection:bg-gold-500 selection:text-midnight-950 transition-colors duration-300">
      {/* ١. بوابة الخلود التاريخية (Hero مع مبدل العصور التفاعلي وصور المستر) */}
      <HomeHero />

      {/* ٢. المتحف الحي: رحلة المستر عبر ٥٠٠٠ سنة تاريخ (كروت 3D تفاعلية لكل عصر) */}
      <LivingMuseum />

      {/* ٣. برديات المناهج ومسارات التفوق (الثانوية العامة والبكالوريا المصرية) */}
      <div id="pathway" className="scroll-mt-20">
        <PathwaySelector systems={systems} />
      </div>

      {/* ٤. مخطوطة النيل: خط الزمان التاريخي الشامل لمصر */}
      <HistoryTimeline />

      {/* ٥. دستور التفوق التاريخي: كنوز وأركان المنصة الذكية */}
      <FeatureGrid />

      {/* ٦. مرسوم البدء الملكي (Call To Action) */}
      <HomeCta />
    </main>
  );
}
