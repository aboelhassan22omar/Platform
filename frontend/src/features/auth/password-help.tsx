import Link from 'next/link';
import { platformConfig } from '@/config/platform.config';

/**
 * There is no self-service reset: support confirms who the student is and an
 * administrator sets a new password from the dashboard.
 */
export function PasswordHelp() {
  const { supportWhatsApp, supportWhatsAppLabel } = platformConfig.contact;
  const message = encodeURIComponent(
    'السلام عليكم، نسيت كلمة السر بتاعة حسابي على المنصة.\nالاسم:\nرقم الموبايل المسجل:',
  );

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed">
        <li>ابعت للدعم على واتساب اسمك ورقم الموبايل اللي سجلت بيه.</li>
        <li>الدعم هيتأكد من بياناتك ويعملك كلمة سر جديدة.</li>
        <li>سجّل الدخول بكلمة السر الجديدة، وتقدر تغيّرها بعدها من صفحة حسابك.</li>
      </ol>
      <a
        href={`https://wa.me/${supportWhatsApp}?text=${message}`}
        target="_blank"
        rel="noopener noreferrer"
        className="auth-submit"
      >
        كلّم الدعم على واتساب
      </a>
      <p className="text-center text-xs opacity-80">
        رقم الدعم: <bdi dir="ltr">{supportWhatsAppLabel}</bdi>
      </p>
      <p className="text-center text-sm">
        افتكرتها؟{' '}
        <Link href="/login" className="font-bold text-gold-600 dark:text-gold-400 hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
