'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';
import { useAuth } from '@/components/providers/auth-provider';

const TABS = [
  { href: '/admin', label: 'نظرة عامة', exact: true },
  { href: '/admin/students', label: 'الطلاب' },
  { href: '/admin/content', label: 'المحتوى ورفع الفيديوهات' },
  { href: '/admin/assessments', label: 'الواجبات والامتحانات' },
  { href: '/admin/live', label: 'اللايف' },
  { href: '/admin/pricing', label: 'الأسعار' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (tab: (typeof TABS)[number]) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#fcfaf4] dark:bg-[#030712] text-midnight-950 dark:text-ivory-50 transition-colors duration-300">
      <div className="sticky top-16 z-30 border-b border-gold-500/20 bg-white/85 dark:bg-midnight-950/85 backdrop-blur-xl">
        <div className="container-page">
          <div className="flex items-center justify-between gap-4 py-2">
            <nav
              aria-label="أقسام لوحة التحكم"
              className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive(tab) ? 'page' : undefined}
                  className={cn(
                    'relative shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors',
                    isActive(tab)
                      ? 'text-gold-800 dark:text-gold-300'
                      : 'text-midnight-600 dark:text-ivory-300/70 hover:text-midnight-900 dark:hover:text-ivory-100',
                  )}
                >
                  {isActive(tab) && (
                    <motion.span
                      layoutId="admin-tab"
                      transition={springSnappy}
                      className="absolute inset-0 rounded-xl bg-gold-500/15 border border-gold-500/30 shadow-sm"
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </Link>
              ))}
            </nav>

            {user && (
              <span className="hidden shrink-0 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3.5 py-1.5 text-xs font-black text-gold-700 dark:text-gold-300 sm:block">
                👑 {user.role === 'SUPER_ADMIN' ? 'مدير الصرح العام' : 'الإدارة الملكية'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container-page py-8">{children}</div>
    </div>
  );
}

