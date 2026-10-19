'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { DeleteAccount } from '@/features/dashboard/delete-account';
import { platformConfig } from '@/config/platform.config';

const card =
  'rounded-2xl border border-ivory-300 bg-white p-6 shadow-card dark:border-midnight-700 dark:bg-midnight-900';
const heading = 'font-display text-lg font-extrabold text-midnight-900 dark:text-ivory-50';
const body = 'mt-3 space-y-2 text-sm leading-7 text-midnight-700 dark:text-ivory-200/85';

export function AccountDeletionGuide({ done }: { done: boolean }) {
  const { user } = useAuth();
  const support = platformConfig.contact.supportWhatsApp;

  return (
    <div className="container-page max-w-3xl space-y-5 py-10 sm:py-14">
      {done && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-5 text-sm font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          اتحذف حسابك وبياناتك الشخصية، وخرجنا من حسابك على كل الأجهزة.
        </p>
      )}

      {user && !user.isStaff && !done && <DeleteAccount standalone />}

      <section className={card} aria-labelledby="how-heading">
        <h2 id="how-heading" className={heading}>
          من التطبيق أو الموقع
        </h2>
        <ol className={`${body} list-decimal ps-5`}>
          <li>سجّل دخولك على حسابك.</li>
          <li>
            افتح <strong>حسابي</strong> ثم <strong>بياناتي</strong>.
          </li>
          <li>
            انزل لآخر الصفحة واضغط <strong>حذف حسابي</strong>، واكتب كلمة السر وأكّد.
          </li>
        </ol>
        {!user && (
          <p className="mt-4 text-sm">
            <Link
              href="/login?next=%2Fdelete-account"
              className="font-bold text-gold-700 underline-offset-4 hover:underline dark:text-gold-300"
            >
              سجّل الدخول واحذف حسابك من هنا
            </Link>
          </p>
        )}
      </section>

      <section className={card} aria-labelledby="no-access-heading">
        <h2 id="no-access-heading" className={heading}>
          مش قادر تدخل على حسابك؟
        </h2>
        <p className={body}>
          ابعتلنا على واتساب الدعم{' '}
          <a
            href={`https://wa.me/${support}`}
            className="font-bold text-gold-700 underline-offset-4 hover:underline dark:text-gold-300"
            dir="ltr"
          >
            {platformConfig.contact.supportWhatsAppLabel}
          </a>{' '}
          من رقم الموبايل المسجّل بيه الحساب، واكتب «عايز أحذف حسابي». هنتأكد إن الرقم بتاعك ونحذف
          الحساب خلال ٧ أيام بالكتير.
        </p>
      </section>

      <section className={card} aria-labelledby="data-heading">
        <h2 id="data-heading" className={heading}>
          إيه اللي بيتمسح وإيه اللي بيفضل
        </h2>
        <div className={body}>
          <p className="font-bold">بيتمسح على طول:</p>
          <ul className="list-disc ps-5">
            <li>اسمك واسم المستخدم ورقم موبايلك ورقم ولي أمرك وكلمة السر.</li>
            <li>الأجهزة المسجّلة وجلسات الدخول ورموز الإشعارات.</li>
            <li>الإشعارات ورسائل واتساب وتقارير ولي الأمر وسجل أيام المذاكرة.</li>
          </ul>
          <p className="pt-2 font-bold">بيفضل من غير أي بيانات تعرّف بيك:</p>
          <ul className="list-disc ps-5">
            <li>
              سجل المدفوعات والطلبات، لأن القانون بيلزمنا نحتفظ بالسجلات المالية للمدة اللي بيحددها.
            </li>
            <li>درجات الامتحانات والأسئلة اللي كتبتها تحت الحصص، باسم «حساب محذوف» بدل اسمك.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
