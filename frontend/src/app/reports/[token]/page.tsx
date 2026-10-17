import type { Metadata } from 'next';
import { ParentReportView } from '@/features/reports/parent-report-view';

export const metadata: Metadata = {
  title: 'تقرير المتابعة الأسبوعي',
  robots: { index: false, follow: false },
};

export default async function ParentReportPage({ params }: { params: Promise<{ token: string }> }) {
  return <ParentReportView token={(await params).token} />;
}
