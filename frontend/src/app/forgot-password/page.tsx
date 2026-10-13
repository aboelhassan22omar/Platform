import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/auth-shell';
import { PasswordHelp } from '@/features/auth/password-help';

export const metadata: Metadata = {
  title: 'نسيت كلمة السر',
  description: 'استعادة الدخول لحسابك عن طريق الدعم',
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="نسيت كلمة السر؟"
      subtitle="تواصل مع الدعم وهيعملولك كلمة سر جديدة."
      allowScroll
    >
      <PasswordHelp />
    </AuthShell>
  );
}
