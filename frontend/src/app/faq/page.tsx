import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/page-hero';
import { FaqList } from '@/features/home/faq-list';

export const metadata: Metadata = {
  title: 'أسئلة شائعة',
  description: 'إجابات على أكتر الأسئلة اللي بتتسأل عن المنصة',
};

export default function FaqPage() {
  return (
    <div className="bg-ivory-50 dark:bg-midnight-950 transition-colors duration-300">
      <PageHero
        title="أسئلة شائعة"
        subtitle="لو سؤالك مش هنا، تواصل معانا وهنرد عليك."
      />
      <FaqList />
    </div>
  );
}
