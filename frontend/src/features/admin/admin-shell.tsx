'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';

const TABS = [
  { href: '/admin', label: 'نظرة عامة', exact: true },
  { href: '/admin/students', label: 'الطلاب' },
  { href: '/admin/content', label: 'المحتوى' },
  { href: '/admin/store', label: 'المتجر' },
  { href: '/admin/assessments', label: 'الامتحانات' },
  { href: '/admin/question-banks', label: 'بنك الأسئلة' },
  { href: '/admin/grading', label: 'التصحيح' },
  { href: '/admin/questions', label: 'أسئلة الطلاب' },
  { href: '/admin/live', label: 'اللايف' },
  { href: '/admin/pricing', label: 'الأسعار' },
  { href: '/admin/payments', label: 'المدفوعات' },
  { href: '/admin/messages', label: 'واتساب' },
  { href: '/admin/settings', label: 'الإعدادات' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (tab: (typeof TABS)[number]) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#fcfaf4] dark:bg-[#030712] text-midnight-950 dark:text-ivory-50 transition-colors duration-300">
      {/* Every section stays visible: the tabs wrap instead of scrolling out of
          sight. Pinned under the header on wide screens only, where they fit in
          one or two short rows; on a phone the block scrolls away with the page. */}
      <div className="z-30 border-b border-gold-500/20 bg-white/85 backdrop-blur-xl dark:bg-midnight-950/85 lg:sticky lg:top-16">
        <div className="container-page">
          <div className="py-2">
            <nav aria-label="أقسام لوحة التحكم" className="flex flex-wrap gap-1">
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive(tab) ? 'page' : undefined}
                  className={cn(
                    'relative shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition-colors',
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
          </div>
        </div>
      </div>

      <div className="container-page py-8">{children}</div>
    </div>
  );
}
