'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from 'motion/react';
import { cn } from '@/lib/utils';
import { drawerPanel, overlayBackdrop, springSnappy } from '@/lib/motion';
import { useAuth } from '@/components/providers/auth-provider';
import { Button, ButtonLink } from '@/components/ui/button';
import { PlatformLogo } from '@/components/decor/egyptian-motifs';
import { ThemeToggle } from '@/components/providers/theme-provider';
import { primaryNavigation } from '@/config/navigation';
import { useStore } from '@/features/store/store-provider';

export function SiteHeader() {
  const { cartCount } = useStore();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => setIsScrolled(latest > 12));

  useEffect(() => setIsMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/#')) return false;
    return pathname.startsWith(href);
  };

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'sticky top-0 z-50 w-full transition-all duration-300',
          isScrolled
            ? 'border-b border-gold-500/25 bg-white/95 dark:bg-[#030914]/92 backdrop-blur-xl shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.6)]'
            : 'border-b border-gold-500/15 bg-white/80 dark:bg-[#030914]/65 backdrop-blur-md',
        )}
      >
        <div className="container-page">
          <div className="flex h-16 items-center justify-between gap-3 sm:gap-4">
            {/* Brand Logo */}
            <Link href="/" className="group flex shrink-0 items-center">
              <PlatformLogo variant="full" className="max-sm:gap-2 max-sm:[&>span:first-child]:w-9 max-sm:[&>div:last-child>div>span:last-child]:hidden max-sm:[&>div:last-child>span]:text-[8px] max-sm:[&>div:last-child>div>span:first-child]:text-xs" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="التنقل الرئيسي">
              {primaryNavigation.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                    isActive(link.href)
                      ? 'text-gold-700 dark:text-gold-300 font-bold'
                      : 'text-midnight-800/80 hover:text-gold-700 hover:bg-gold-500/10 dark:text-ivory-200/80 dark:hover:text-gold-200 dark:hover:bg-gold-500/10',
                  )}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                      transition={springSnappy}
                    />
                  )}
                </Link>
              ))}
            </nav>

            {/* Actions (ديسكتوب وتابلت >= sm / lg) */}
            <div className="flex items-center gap-2">
              {(pathname === '/store' || pathname.startsWith('/store/')) && <Link href="/store/cart" aria-label={`عربة التسوق (${cartCount})`} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/25 text-gold-700 dark:text-gold-300">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 3h2l3 12h11l3-9H6M9 20h.01M18 20h.01" strokeLinecap="round"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
                {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-gold-500 px-1 text-center text-[10px] font-bold text-midnight-950">{cartCount}</span>}
              </Link>}
              <ThemeToggle className="hidden sm:inline-flex" />

              {isLoading ? (
                <div className="skeleton hidden sm:inline-block h-9 w-24 rounded-xl bg-midnight-900/60" />
              ) : user ? (
                <>
                  {user.isStaff && (
                    <ButtonLink
                      href="/admin"
                      variant="accent"
                      size="sm"
                      className="hidden sm:inline-flex shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                    >
                      لوحة التحكم
                    </ButtonLink>
                  )}
                  {!user.isStaff && (
                    <ButtonLink href="/dashboard" variant="accent" size="sm" className="hidden sm:inline-flex">
                      ملفي الشخصي
                    </ButtonLink>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void logout()}
                    className="hidden sm:inline-flex text-midnight-700 hover:text-midnight-950 hover:bg-gold-500/10 dark:text-ivory-200 dark:hover:text-ivory-50 dark:hover:bg-midnight-900"
                  >
                    تسجيل الخروج
                  </Button>
                </>
              ) : (
                <>
                  <ButtonLink
                    href="/login"
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex text-midnight-800 hover:text-gold-700 hover:bg-gold-500/10 dark:text-ivory-200 dark:hover:text-gold-200 dark:hover:bg-midnight-900"
                  >
                    تسجيل الدخول
                  </ButtonLink>
                  <ButtonLink
                    href="/register"
                    variant="accent"
                    size="sm"
                    className="hidden sm:inline-flex shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                  >
                    ابدأ دلوقتي
                  </ButtonLink>
                </>
              )}

              {/* زر قائمة الموبايل الفاخر والواضح — للموبايل والشاشات الصغيرة فقط */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                aria-label="افتح القائمة الرئيسية"
                aria-expanded={isMenuOpen}
                className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-xl border-2 border-gold-500/40 bg-gold-500/10 dark:bg-midnight-900/80 text-gold-700 dark:text-gold-300 hover:border-gold-400 hover:bg-gold-500/20 active:scale-95 shadow-sm transition-all lg:hidden"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              variants={overlayBackdrop}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-midnight-950/75 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              variants={drawerPanel}
              initial="hidden"
              animate="visible"
              exit="hidden"
              role="dialog"
              aria-modal="true"
              aria-label="قائمة التنقل"
              className={cn(
                'fixed inset-y-0 z-[70] flex w-[min(21rem,88vw)] flex-col bg-[#fdfbf7] dark:bg-[#040a14] border-s border-gold-500/30 text-midnight-950 dark:text-ivory-50 shadow-2xl lg:hidden',
                'right-0',
              )}
              style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* ترويسة القائمة الجانبية — مسافة مريحة واسعة بين اللوجو والكلمة */}
              <div className="flex items-center justify-between border-b border-gold-500/20 px-5 py-4">
                <div className="flex items-center gap-5">
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <PlatformLogo variant="mark" size="sm" className="h-7 w-7" />
                  </div>
                  <span className="font-display text-base font-extrabold text-gold-700 dark:text-gold-300">
                    قائمة المنصة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-gold-500/30 text-midnight-700 hover:text-gold-700 hover:bg-gold-500/10 dark:text-ivory-300 dark:hover:text-gold-300 dark:hover:bg-midnight-900 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path
                      d="M4 4l10 10M14 4L4 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {/* قسم بيانات الحساب والاسم في أعلى المنيو فقط كما هو */}
              {user && (
                <div className="border-b border-gold-500/20 px-4 py-3.5">
                  <div className="rounded-2xl border border-gold-500/35 bg-gradient-to-br from-gold-500/15 via-gold-500/5 to-transparent p-3.5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold-500/40 bg-gold-500/20 font-display text-base font-black text-gold-700 dark:text-gold-300 shadow-sm">
                        {user.fullName ? user.fullName[0] : 'ط'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-black text-midnight-950 dark:text-ivory-50 truncate">
                          {user.fullName || 'طالب مسجل'}
                        </p>
                        <p className="text-[11px] font-semibold text-gold-700 dark:text-gold-400 truncate">
                          {user.isStaff ? 'الإدارة الملكية' : 'حساب الطالب'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* قسم تبديل الوضع الليلي / النهاري داخل المنيو */}
              <div className="border-b border-gold-500/20 px-4 py-3">
                <div className="flex items-center justify-between rounded-xl border border-gold-500/20 bg-white/60 dark:bg-midnight-900/50 p-2.5 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-500/15 text-gold-600 dark:text-gold-400 text-sm">
                      🌓
                    </span>
                    <div>
                      <p className="text-xs font-bold text-midnight-950 dark:text-ivory-50">
                        مظهر المنصة
                      </p>
                      <p className="text-[11px] text-midnight-600 dark:text-ivory-300/70">
                        الوضع الليلي / النهاري
                      </p>
                    </div>
                  </div>
                  <ThemeToggle />
                </div>
              </div>

              {/* روابط التنقل الرئيسية */}
              <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="التنقل">
                <ul className="space-y-1">
                  {primaryNavigation.map((link, index) => (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + index * 0.04, duration: 0.25 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={cn(
                          'block rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                          isActive(link.href)
                            ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300 border border-gold-500/30 font-bold'
                            : 'text-midnight-800/80 hover:bg-gold-500/10 hover:text-gold-700 dark:text-ivory-200/80 dark:hover:bg-midnight-900 dark:hover:text-gold-200',
                        )}
                      >
                        {link.label}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              {/* تذييل القائمة: الزرارين بتوع الحساب وتسجيل الخروج في الأسفل بدلاً من الواتس */}
              <div className="border-t border-gold-500/20 p-4 mt-auto bg-[#fdfbf7] dark:bg-[#040a14]">
                {user ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={user.isStaff ? '/admin' : '/dashboard'}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gold-500/40 bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 text-midnight-950 py-3 text-xs font-black shadow-md transition-all hover:brightness-105 active:scale-95"
                    >
                      <span>{user.isStaff ? 'لوحة التحكم' : 'حسابي'}</span>
                      <span aria-hidden>←</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        void logout();
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400 py-3 text-xs font-bold transition-all hover:bg-red-500/20 active:scale-95"
                    >
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center rounded-xl border border-gold-500/40 bg-white/90 dark:bg-midnight-900/90 py-3 text-xs font-bold text-midnight-950 dark:text-ivory-50 shadow-sm"
                    >
                      تسجيل الدخول
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center rounded-xl bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 py-3 text-xs font-black text-midnight-950 shadow-md"
                    >
                      ابدأ دلوقتي
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
