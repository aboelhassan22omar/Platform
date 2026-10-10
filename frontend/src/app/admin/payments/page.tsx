import type { Metadata } from 'next';
import { AdminPayments } from '@/features/admin/admin-payments';

export const metadata: Metadata = { title: 'سجل المدفوعات' };

export default function PaymentsPage() {
  return <AdminPayments />;
}
