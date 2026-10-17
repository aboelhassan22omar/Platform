import type { Metadata } from 'next';
import { AdminQuestionBanks } from '@/features/admin/admin-question-banks';

export const metadata: Metadata = { title: 'بنك الأسئلة' };

export default function AdminQuestionBanksPage() {
  return <AdminQuestionBanks />;
}
