import type { Metadata } from 'next';
import { StudentAssessments } from '@/features/dashboard/student-assessments';

export const metadata: Metadata = { title: 'الواجبات والامتحانات' };
export default function AssessmentsPage() {
  return <StudentAssessments />;
}
