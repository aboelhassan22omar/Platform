import type { Metadata } from 'next';
import { AssessmentRunner } from '@/features/dashboard/assessment-runner';

export const metadata: Metadata = { title: 'حل التقييم' };
export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  return <AssessmentRunner id={(await params).id} />;
}
