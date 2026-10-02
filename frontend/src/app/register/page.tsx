import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth/register-form';
import { AuthShell } from '@/features/auth/auth-shell';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default function RegisterPage() {
  return (
    <AuthShell
      title="ابدأ رحلتك مع التاريخ"
      subtitle="اعمل حسابك في خطوات بسيطة، واختار نظامك وصفك علشان نجهز لك المحتوى المناسب."
      wide
      showSiteChrome
    >
      <Suspense fallback={<div className="skeleton h-[32rem] w-full rounded-lg" />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
