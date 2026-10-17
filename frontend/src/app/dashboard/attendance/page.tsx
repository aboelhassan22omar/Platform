import type { Metadata } from 'next';
import { MyAttendance } from '@/features/dashboard/my-attendance';

export const metadata: Metadata = { title: 'كارنيه الحضور' };

export default function AttendancePage() {
  return <MyAttendance />;
}
