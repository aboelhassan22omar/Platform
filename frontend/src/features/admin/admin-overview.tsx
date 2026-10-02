'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { cn, formatEgp, formatNumber, toArabicDigits } from '@/lib/utils';
import { EASE_ENTRANCE, staggerContainer } from '@/lib/motion';
import type { AdminOverview as Overview } from '@/types/api';

interface SalesPoint {
  date: string;
  orders: number;
  revenueMinor: number;
}
interface RegistrationPoint {
  date: string;
  count: number;
}

/** One accent per grade, matching that grade's theme on the student side. */
const GRADE_COLOURS: Record<string, string> = {
  SEC_1: '#c8952a',
  SEC_2: '#2f7d6b',
  SEC_3: '#8c2f39',
  BACC_1: '#476199',
  BACC_2: '#b5622c',
};

export function AdminOverview() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<Overview>('/admin/dashboard/overview'),
    refetchInterval: 30_000,
  });

  const { data: sales } = useQuery({
    queryKey: ['admin-sales'],
    queryFn: () => api.get<SalesPoint[]>('/admin/dashboard/sales?days=30'),
  });

  const { data: registrations } = useQuery({
    queryKey: ['admin-registrations'],
    queryFn: () => api.get<RegistrationPoint[]>('/admin/dashboard/registrations?days=30'),
  });

  if (isLoading || !overview) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    );
  }

  const kpis = [
    {
      label: 'إجمالي الطلاب',
      value: overview.students.total,
      sub: `+${toArabicDigits(String(overview.students.newThisWeek))} الأسبوع ده`,
      tone: 'default' as const,
    },
    {
      label: 'متواجدون الآن',
      value: overview.online.total,
      sub: 'تقدير حسب آخر نبضة',
      tone: 'live' as const,
    },
    {
      label: 'اشتراكات فعّالة',
      value: overview.commerce.activeSubscriptions,
      sub: `${toArabicDigits(String(overview.commerce.activeEntitlements))} تصريح وصول`,
      tone: 'default' as const,
    },
    {
      label: 'عمليات بيع ناجحة',
      value: overview.commerce.paidOrders,
      sub: 'طلبات مدفوعة بالكامل',
      tone: 'default' as const,
    },
    {
      label: 'حصص منشورة',
      value: overview.content.publishedLessons,
      sub: `من ${toArabicDigits(String(overview.content.totalLessons))} حصة`,
      tone: 'default' as const,
    },
    {
      label: 'كورسات منشورة',
      value: overview.content.publishedCourses,
      sub: 'متاحة للطلاب',
      tone: 'default' as const,
    },
    {
      label: 'حسابات موقوفة',
      value: overview.students.suspended,
      sub: 'محتاجة مراجعة',
      tone: overview.students.suspended > 0 ? ('warning' as const) : ('default' as const),
    },
  ];

  const gradeData = overview.students.byGrade.map((row) => ({
    ...row,
    fill: GRADE_COLOURS[row.gradeLevel] ?? '#476199',
  }));

  const onlineByGrade = new Map(
    overview.online.byGrade.map((row) => [row.gradeLevel, row.count]),
  );

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------
          KPI row
          ------------------------------------------------------------------ */}
      <motion.section
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
        aria-label="المؤشرات الرئيسية"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Revenue gets its own emphasised card */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_ENTRANCE } },
          }}
          className="rounded-2xl border border-gold-400/50 bg-gradient-to-bl from-gold-100/70 via-white to-gold-50/50 dark:from-midnight-900/90 dark:via-midnight-950 dark:to-midnight-900 p-5 shadow-card sm:col-span-2 text-midnight-950 dark:text-ivory-50 transition-colors"
        >
          <p className="text-xs font-semibold text-gold-800 dark:text-gold-300">الإيرادات المحصّلة</p>
          <p className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50 sm:text-4xl">
            {formatEgp(overview.commerce.revenueMinor)}
          </p>
          <p className="mt-1 text-[11px] text-midnight-600 dark:text-ivory-300/70">
            محسوبة من الطلبات المدفوعة فعلياً فقط
          </p>
        </motion.div>

        {kpis.map((kpi) => (
          <motion.div
            key={kpi.label}
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_ENTRANCE } },
            }}
            className={cn(
              'rounded-2xl border bg-white dark:bg-midnight-950/80 p-5 shadow-card transition-colors',
              kpi.tone === 'warning' ? 'border-amber-400/60' : 'border-gold-500/25',
            )}
          >
            <div className="flex items-center gap-2">
              {kpi.tone === 'live' && (
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
              <p className="text-xs font-bold text-midnight-600 dark:text-ivory-300/80">{kpi.label}</p>
            </div>

            <p className="mt-2 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
              {formatNumber(kpi.value)}
            </p>

            <p className="mt-1 text-[11px] text-midnight-500 dark:text-ivory-300/60">{kpi.sub}</p>
          </motion.div>
        ))}
      </motion.section>

      {/* ------------------------------------------------------------------
          Grade distribution
          ------------------------------------------------------------------ */}
      <section
        aria-labelledby="grade-dist-heading"
        className="rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 p-5 shadow-card sm:p-6 transition-colors"
      >
        <h2
          id="grade-dist-heading"
          className="font-display text-lg font-extrabold text-midnight-950 dark:text-ivory-50"
        >
          توزيع الطلاب على الصفوف
        </h2>

        <div className="mt-5 h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gradeData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 149, 42, 0.15)" vertical={false} />
              <XAxis
                dataKey="nameAr"
                tick={{ fontSize: 11, fill: '#8b9bb4', fontFamily: 'var(--font-cairo)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#8b9bb4' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ fill: 'rgba(200,149,42,0.08)' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  backgroundColor: '#0a1120',
                  color: '#fff',
                  fontFamily: 'var(--font-cairo)',
                  fontSize: 12,
                  direction: 'rtl',
                }}
                formatter={(value) => [formatNumber(Number(value)), 'عدد الطلاب']}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={72}>
                {gradeData.map((entry) => (
                  <Cell key={entry.gradeLevel} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Per-grade totals with live online counts alongside */}
        <ul className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {gradeData.map((grade) => (
            <li
              key={grade.gradeLevel}
              className="rounded-xl border border-gold-500/20 bg-ivory-50/70 dark:bg-midnight-900/60 p-3 transition-colors"
            >
              <span
                aria-hidden
                className="block h-1 w-8 rounded-full"
                style={{ background: grade.fill }}
              />
              <p className="mt-2 text-xs font-bold text-midnight-800 dark:text-ivory-200">{grade.nameAr}</p>
              <p className="mt-0.5 font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
                {formatNumber(grade.count)}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {toArabicDigits(String(onlineByGrade.get(grade.gradeLevel) ?? 0))} متواجد
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------
          Trends
          ------------------------------------------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="التسجيلات — آخر ٣٠ يوم" empty={!registrations?.length}>
          <LineChart data={registrations ?? []} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 149, 42, 0.15)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
              }
              tick={{ fontSize: 10, fill: '#8b9bb4' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#8b9bb4' }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(245, 158, 11, 0.3)',
                backgroundColor: '#0a1120',
                color: '#fff',
                fontSize: 12,
                direction: 'rtl',
              }}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString('ar-EG', { dateStyle: 'medium' })
              }
              formatter={(value) => [formatNumber(Number(value)), 'طالب جديد']}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#e8bd46"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartCard>

        <ChartCard title="الإيرادات — آخر ٣٠ يوم" empty={!sales?.length}>
          <LineChart data={sales ?? []} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(200, 149, 42, 0.15)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) =>
                new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
              }
              tick={{ fontSize: 10, fill: '#8b9bb4' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => String(Math.round(value / 100))}
              tick={{ fontSize: 10, fill: '#8b9bb4' }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(245, 158, 11, 0.3)',
                backgroundColor: '#0a1120',
                color: '#fff',
                fontSize: 12,
                direction: 'rtl',
              }}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString('ar-EG', { dateStyle: 'medium' })
              }
              formatter={(value) => [formatEgp(Number(value)), 'الإيراد']}
            />
            <Line
              type="monotone"
              dataKey="revenueMinor"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactElement;
}) {
  return (
    <section className="rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 p-5 shadow-card transition-colors">
      <h2 className="font-display text-base font-extrabold text-midnight-950 dark:text-ivory-50">{title}</h2>
      {empty ? (
        <div className="mt-4 grid h-56 place-items-center rounded-xl border border-dashed border-gold-500/30 bg-ivory-50/50 dark:bg-midnight-900/40">
          <p className="text-sm text-midnight-500 dark:text-ivory-300/60">مفيش بيانات في الفترة دي</p>
        </div>
      ) : (
        <div className="mt-4 h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

