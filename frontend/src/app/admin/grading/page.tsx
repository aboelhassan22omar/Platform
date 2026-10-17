import type { Metadata } from 'next';
import { AdminGrading } from '@/features/admin/admin-grading';

export const metadata: Metadata = { title: 'التصحيح' };

export default function AdminGradingPage() {
  return <AdminGrading />;
}
