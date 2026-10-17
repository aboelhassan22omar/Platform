import type { Metadata } from 'next';
import { AdminMessages } from '@/features/admin/admin-messages';

export const metadata: Metadata = { title: 'رسائل واتساب' };

export default function AdminMessagesPage() {
  return <AdminMessages />;
}
