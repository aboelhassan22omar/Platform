'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';
import { LiveBanner } from '@/features/live/live-banner';

const TABS = [
  { href: '/dashboard', label: 'نظرة عامة', exact: true },
  { href: '/dashboard/lessons', label: 'حصصي' },
  { href: '/dashboard/assessments', label: 'الواجبات والامتحانات' },
  { href: '/dashboard/leaderboard', label: 'المتصدرون' },
  { href: '/dashboard/subscriptions', label: 'اشتراكاتي' },
  { href: '/dashboard/profile', label: 'بياناتي' },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (tab: (typeof TABS)[number]) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#fcfaf4] dark:bg-[#030712] text-midnight-950 dark:text-ivory-50 transition-colors duration-300">
      {/* Tab bar. Horizontally scrollable on phones */}
      <div className="sticky top-16 z-30 border-b border-gold-500/20 bg-white/85 dark:bg-midnight-950/85 backdrop-blur-xl">
        <div className="container-page">
          <nav
            aria-label="أقسام حسابي"
            className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    layoutId="dashboard-tab"
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

      <div className="container-page py-8 sm:py-10">
        <LiveBanner />
        {children}
      </div>
    </div>
  );
}

