import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'استعادة كلمة السر',
  description: 'استعادة كلمة السر باستخدام رقم الموبايل المسجل',
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="نسيت كلمة السر؟"
      subtitle="أكد رقمك بكود واتساب، وبعدها اختار كلمة سر جديدة."
      allowScroll
    >
      {/* The form reads query parameters, which needs a Suspense boundary. */}
      <Suspense fallback={<div className="skeleton h-56 w-full rounded-xl" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
