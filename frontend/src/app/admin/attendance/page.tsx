import type { Metadata } from 'next';
import { AdminAttendance } from '@/features/admin/admin-attendance';

export const metadata: Metadata = { title: 'الحضور' };

export default function AdminAttendancePage() {
  return <AdminAttendance />;
}
