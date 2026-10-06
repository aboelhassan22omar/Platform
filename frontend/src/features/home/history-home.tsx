import { HomeHero } from './hero';
import { LivingMuseum } from './living-museum';
import { PathwaySelector } from './pathway-selector';
import { FeatureGrid } from './feature-grid';
import { HistoryTimeline } from './history-timeline';
import { HomeCta } from './home-cta';
import type { EducationSystemSummary } from '@/types/api';
export function HistoryHome({ systems }: { systems: EducationSystemSummary[] }) {
  return (
    <div className="bg-[#fcfaf4] dark:bg-[#030712] min-h-screen text-midnight-950 dark:text-ivory-50 selection:bg-gold-500 selection:text-midnight-950 transition-colors duration-300">
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
    </div>
  );
}
