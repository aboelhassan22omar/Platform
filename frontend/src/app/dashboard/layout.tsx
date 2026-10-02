import type { Metadata } from 'next';
import { DashboardShell } from '@/features/dashboard/dashboard-shell';
import { RequireAuth } from '@/features/auth/require-auth';

export const metadata: Metadata = { title: 'ملفي الشخصي' };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth studentOnly>
      <DashboardShell>{children}</DashboardShell>
    </RequireAuth>
  );
}
