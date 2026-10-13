import type { Metadata } from 'next';
import { AdminTransfers } from '@/features/admin/admin-transfers';

export const metadata: Metadata = { title: 'مراجعة التحويلات' };

export default function TransfersPage() {
  return <AdminTransfers />;
}
