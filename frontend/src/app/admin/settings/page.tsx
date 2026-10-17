import type { Metadata } from 'next';
import { AdminSettings } from '@/features/admin/admin-settings';

export const metadata: Metadata = { title: 'الحماية والشهادات' };

export default function AdminSettingsPage() {
  return <AdminSettings />;
}
