import type { Metadata } from 'next';
import { AdminLive } from '@/features/admin/admin-live';

export const metadata: Metadata = { title: 'إدارة اللايف' };
export default function AdminLivePage() {
  return <AdminLive />;
}
