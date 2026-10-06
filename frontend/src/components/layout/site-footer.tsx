'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { LotusBlossom, PlatformLogo } from '@/components/decor/egyptian-motifs';
import { platformConfig } from '@/config/platform.config';

const NAV_SECTIONS = [
  {
    title: 'المنصة',
    links: [
      { href: '/', label: 'الرئيسية' },
      { href: '/grades', label: 'المناهج والصفوف' },
      { href: '/about', label: `عن ${platformConfig.teacher.displayName}` },
    ],
  },
  {
    title: 'حسابك',
    links: [
      { href: '/dashboard', label: 'ملفي الشخصي' },
      { href: '/dashboard/lessons', label: 'حصصي المسجلة' },
      { href: '/dashboard/subscriptions', label: 'اشتراكاتي' },
      { href: '/login', label: 'تسجيل الدخول' },
    ],
  },
  {
    title: 'المساعدة والقانونية',
    links: [
      { href: '/contact', label: 'تواصل معنا' },
      { href: '/faq', label: 'الأسئلة الشائعة' },
      { href: '/privacy', label: 'سياسة الخصوصية' },
      { href: '/terms', label: 'الشروط والأحكام' },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const { user } = useAuth();
  const sections = user?.isStaff
    ? NAV_SECTIONS.map((section, index) =>
        index === 1
          ? {
              ...section,
              title: 'الإدارة الملكية',
              links: [
                { href: '/admin', label: 'لوحة التحكم' },
                { href: '/admin/content', label: 'المحتوى والحصص' },
                { href: '/admin/students', label: 'شؤون الطلاب' },
              ],
            }
          : section,
      )
    : NAV_SECTIONS;

  // The live room owns the whole viewport, like a call.
  if (pathname.startsWith('/live/')) return null;

  return (
    <footer className="mt-auto border-t border-gold-500/25 bg-[#f5ebd8] dark:bg-[#02060c] text-midnight-950 dark:text-ivory-200 relative overflow-hidden transition-colors duration-300">
      {/* إفريز ذهبي علوي دقيق مع زهرة اللوتس في المنتصف */}
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden
          className="h-px w-full bg-gradient-to-r from-transparent via-gold-500/50 to-transparent"
        />
        <div className="absolute top-1/2 -translate-y-1/2 bg-[#f5ebd8] dark:bg-[#02060c] px-3">
          <LotusBlossom className="h-3.5 w-5 opacity-85 text-gold-600 dark:text-gold-400" />
        </div>
      </div>

      <div className="container-page relative z-10 py-7 sm:py-8 lg:py-9">
        {/* --- العرض المدمج المخصص لشاشات الهاتف والموبايل فقط (< md) --- */}
        <div className="block md:hidden space-y-5">
          {/* هوية المنصة المدمجة */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="inline-flex items-center">
              <PlatformLogo variant="full" />
            </Link>
            <p className="mt-2 text-xs leading-5 text-midnight-700/90 dark:text-ivory-200/75 max-w-xs">
              منصة التاريخ الأولى للثانوية العامة والبكالوريا المصرية مع{' '}
              {platformConfig.teacher.displayName}
            </p>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <span className="inline-flex items-center rounded-md border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 text-[11px] font-bold text-gold-700 dark:text-gold-300">
                ثانوية عامة
              </span>
              <span className="inline-flex items-center rounded-md border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 text-[11px] font-bold text-gold-700 dark:text-gold-300">
                بكالوريا مصرية
              </span>
            </div>
          </div>

          {/* شبكة أزرار التواصل السريع بنظام Touch-friendly للهاتف */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* واتساب الدعم الفني */}
            <a
              href={`https://wa.me/${platformConfig.contact.supportWhatsApp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors active:scale-95"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-600 text-[11px] font-bold text-white">
                W
              </span>
              <span>واتساب الدعم</span>
            </a>

            {/* واتساب المتابعة */}
            <a
              href={`https://wa.me/${platformConfig.contact.followUpWhatsApp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors active:scale-95"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-600 text-[11px] font-bold text-white">
                W
              </span>
              <span>فريق المتابعة</span>
            </a>

            {/* اتصال هاتفي سريع */}
            <a
              href={`tel:${platformConfig.contact.phone}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 transition-colors active:scale-95"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-amber-600 text-[11px] font-bold text-white">
                📞
              </span>
              <span>اتصال مباشر</span>
            </a>

            {/* فيسبوك الأستاذ */}
            <a
              href={platformConfig.contact.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs font-bold text-blue-700 dark:text-blue-400 transition-colors active:scale-95"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-600 text-[11px] font-bold text-white">
                f
              </span>
              <span>فيسبوك الأستاذ</span>
            </a>
          </div>

          {/* روابط التنقل السريعة في شبكة ثنائية أنيقة */}
          <div className="rounded-2xl border border-gold-500/20 bg-white/40 dark:bg-midnight-950/40 p-3.5 backdrop-blur-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-center text-xs">
              <Link
                href="/"
                className="py-1 text-midnight-800/90 dark:text-ivory-200/80 hover:text-gold-600 dark:hover:text-gold-400 font-medium"
              >
                الرئيسية
              </Link>
              <Link
                href="/grades"
                className="py-1 text-midnight-800/90 dark:text-ivory-200/80 hover:text-gold-600 dark:hover:text-gold-400 font-medium"
              >
                المناهج والصفوف
              </Link>
              <Link
                href="/about"
                className="py-1 text-midnight-800/90 dark:text-ivory-200/80 hover:text-gold-600 dark:hover:text-gold-400 font-medium"
              >
                عن الأستاذ
              </Link>
              <Link
                href="/contact"
                className="py-1 text-midnight-800/90 dark:text-ivory-200/80 hover:text-gold-600 dark:hover:text-gold-400 font-medium"
              >
                تواصل معنا
              </Link>
              <Link
                href="/dashboard"
                className="py-1 text-midnight-800/90 dark:text-ivory-200/80 hover:text-gold-600 dark:hover:text-gold-400 font-medium"
              >
                حسابي التعليمي
              </Link>
              <Link
                href="/terms"
                className="py-1 text-midnight-800/90 dark:text-ivory-200/80 hover:text-gold-600 dark:hover:text-gold-400 font-medium"
              >
                الشروط والخصوصية
              </Link>
            </div>
          </div>
        </div>

        {/* --- Brand + Contact + Navigation (ديسكتوب وتابلت فقط >= md) --- */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-6 gap-x-7 gap-y-7 lg:gap-x-8">
          {/* Brand info (2 columns) */}
          <div className="lg:col-span-2">
            <Link href="/" className="group inline-flex items-center">
              <PlatformLogo variant="full" />
            </Link>

            <p className="mt-3 max-w-md text-sm leading-6 text-midnight-700/90 dark:text-ivory-200/75">
              {platformConfig.brand.description}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 items-center rounded-lg border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 text-xs font-bold text-gold-700 dark:text-gold-300">
                ثانوية عامة
              </span>
              <span className="inline-flex min-h-7 items-center rounded-lg border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 text-xs font-bold text-gold-700 dark:text-gold-300">
                بكالوريا مصرية
              </span>
            </div>
          </div>

          {/* Nav columns (3 columns) */}
          {sections.map((section) => (
            <nav key={section.title} aria-label={section.title} className="text-start">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold text-gold-700 dark:text-gold-400">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden />
                {section.title}
              </h2>
              <ul className="mt-2 grid gap-0.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'group inline-flex min-h-9 items-center gap-2 text-[13px] font-medium leading-5 text-midnight-800/85 dark:text-ivory-200/80',
                        'transition-colors duration-200 hover:text-gold-700 dark:hover:text-gold-300',
                      )}
                    >
                      <span
                        aria-hidden
                        className="h-px w-0 bg-gold-500 transition-all duration-200 group-hover:w-2"
                      />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Social & Contact Channels (1 column) */}
          <div className="text-start">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-gold-700 dark:text-gold-400">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden />
              تواصل معنا
            </h2>

            <ul className="mt-2 space-y-0.5 text-[13px] leading-5">
              {/* فيسبوك */}
              <li>
                <a
                  href={platformConfig.contact.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-2.5 text-midnight-800 transition-colors hover:text-gold-700 dark:text-ivory-200/80 dark:hover:text-gold-300"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-blue-500/30 bg-blue-600/20 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    f
                  </span>
                  <span>الفيسبوك الرسمي</span>
                </a>
              </li>

              {/* واتساب الدعم */}
              <li>
                <a
                  href={`https://wa.me/${platformConfig.contact.supportWhatsApp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-2.5 text-midnight-800 transition-colors hover:text-emerald-700 dark:text-ivory-200/80 dark:hover:text-emerald-400"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-emerald-500/30 bg-emerald-600/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    W
                  </span>
                  <span className="nums-tabular">
                    واتساب: {platformConfig.contact.supportWhatsAppLabel}
                  </span>
                </a>
              </li>

              {/* واتساب المساعدين والمتابعة */}
              <li>
                <a
                  href={`https://wa.me/${platformConfig.contact.followUpWhatsApp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-2.5 text-midnight-800 transition-colors hover:text-emerald-700 dark:text-ivory-200/80 dark:hover:text-emerald-400"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-emerald-500/30 bg-emerald-600/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    W
                  </span>
                  <span className="nums-tabular">
                    واتساب: {platformConfig.contact.followUpWhatsAppLabel}
                  </span>
                </a>
              </li>

              {/* الاتصال الهاتفي */}
              <li>
                <a
                  href={`tel:${platformConfig.contact.phone}`}
                  className="inline-flex min-h-9 items-center gap-2.5 text-midnight-800 transition-colors hover:text-gold-700 dark:text-ivory-200/80 dark:hover:text-gold-300"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-amber-500/30 bg-amber-600/20 text-amber-700 dark:text-amber-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M7.2 3.5 9.5 8l-2.1 1.8a15.2 15.2 0 0 0 6.8 6.8l1.8-2.1 4.5 2.3-.8 3.4a2 2 0 0 1-2 1.5C9.2 21.7 2.3 14.8 2.3 6.3a2 2 0 0 1 1.5-2l3.4-.8Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="nums-tabular">اتصال: {platformConfig.contact.phoneLabel}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* --- الشريط السفلي: الحقوق وتطوير Aurexis --- */}
        <div className="mt-7 flex flex-col items-center justify-between gap-3 border-t border-gold-500/20 pt-4 text-center text-xs leading-5 text-midnight-700/85 dark:text-ivory-300/70 sm:flex-row sm:text-start">
          <p>
            © {year} {platformConfig.brand.platformName}. جميع الحقوق محفوظة.
          </p>
          <div>
            <a
              href="https://aurexis.cc/"
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="inline-flex min-h-9 items-center gap-2 text-gold-700 transition-colors hover:text-gold-600 dark:text-gold-400 dark:hover:text-gold-200"
            >
              <span className="font-sans text-xs font-semibold text-midnight-700/90 dark:text-ivory-200/90">
                Powered by
              </span>
              <span className="font-sans text-xs font-bold text-gold-600 underline decoration-gold-500/60 underline-offset-2 hover:text-gold-500 dark:text-gold-400 dark:hover:text-gold-300">
                Aurexis
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
