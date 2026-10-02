import type { Metadata } from 'next';
import { RequireAuth } from '@/features/auth/require-auth';
import { AdminShell } from '@/features/admin/admin-shell';

export const metadata: Metadata = { title: 'لوحة التحكم' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // staffOnly is a UX guard; the API enforces the real authorisation.
  return (
    <RequireAuth staffOnly>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
