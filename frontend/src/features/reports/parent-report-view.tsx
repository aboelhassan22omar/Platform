'use client';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { platformConfig } from '@/config/platform.config';
import type { ParentReportData } from '@/types/api';
import { ParentReportSummary, ReportTheme, reportPeriod } from './parent-report-summary';

export function ParentReportView({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-report', token],
    queryFn: () => api.get<ParentReportData>(`/reports/${encodeURIComponent(token)}`),
    retry: false,
  });
  const { brand, contact } = platformConfig;

  return (
    <div className="parent-report min-h-[calc(100dvh-4rem)] bg-[var(--report-page)] px-4 py-8">
      <ReportTheme />
      <div className="mx-auto w-full max-w-lg">
        <header className="flex items-center gap-3">
          <Image
            src={brand.logoLight}
            alt={brand.logoAlt}
            width={44}
            height={44}
            className="h-11 w-11 object-contain dark:hidden"
          />
          <Image
            src={brand.logoDark}
            alt={brand.logoAlt}
            width={44}
            height={44}
            className="hidden h-11 w-11 object-contain dark:block"
          />
          <div>
            <p className="text-xs font-bold text-[var(--report-muted)]">{brand.platformName}</p>
            <p className="font-display text-sm font-black text-[var(--report-bar)]">
              تقرير المتابعة الأسبوعي
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="mt-8 space-y-3">
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-48 rounded-2xl" />
          </div>
        ) : error || !data ? (
          <p className="mt-10 rounded-2xl border border-[var(--report-line)] bg-[var(--report-surface)] p-6 text-center text-sm font-bold text-[var(--report-ink)]">
            التقرير ده مش موجود أو انتهت صلاحيته. لو محتاجه كلّم فريق المتابعة.
          </p>
        ) : (
          <>
            <div className="mb-5 mt-6">
              <h1 className="font-display text-2xl font-black text-[var(--report-ink)]">
                {data.student.name}
              </h1>
              <p className="mt-1 text-sm text-[var(--report-muted)]">
                {data.student.grade ? `${data.student.grade} · ` : ''}
                {reportPeriod(data)}
              </p>
            </div>
            <ParentReportSummary data={data} />
          </>
        )}

        <a
          href={`https://wa.me/${contact.followUpWhatsApp}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[#1f8f4e] px-4 text-sm font-black text-white transition-colors hover:bg-[#187540]"
        >
          كلّم فريق المتابعة على واتساب
        </a>
        <p className="mt-3 text-center text-[11px] text-[var(--report-muted)]">
          الأرقام دي محسوبة من المنصة نفسها: وقت الفيديوهات اللي اتشافت فعلًا والامتحانات اللي
          اتحلّت.
        </p>
      </div>
    </div>
  );
}
