import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';
import { AuthShell } from '@/features/auth/auth-shell';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default function LoginPage() {
  return (
    <AuthShell
      title="كمّل رحلتك من مكان ما وقفت"
      subtitle="سجّل دخولك علشان تتابع حصصك، تقدمك، وكل اللي حجزته على المنصة."
      showSiteChrome
    >
      <Suspense fallback={<div className="skeleton h-72 w-full rounded-lg" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
