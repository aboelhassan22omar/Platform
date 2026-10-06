import type { Metadata } from 'next';
import { AdminAssessments } from '@/features/admin/admin-assessments';

export const metadata: Metadata = { title: 'إدارة الواجبات والامتحانات' };
export default function AdminAssessmentsPage() {
  return <AdminAssessments />;
}
