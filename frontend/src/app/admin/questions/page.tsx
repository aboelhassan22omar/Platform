import type { Metadata } from 'next';
import { AdminQuestions } from '@/features/admin/admin-questions';

export const metadata: Metadata = { title: 'أسئلة الطلاب' };

export default function AdminQuestionsPage() {
  return <AdminQuestions />;
}
