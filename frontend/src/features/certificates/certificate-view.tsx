'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import {
  CertificateSheet,
  type CertificateData,
  type CertificateTemplate,
} from './certificate-sheet';

type PublicCertificate = CertificateData & { template: CertificateTemplate };

/**
 * Only the certificate is printed, edge to edge on landscape A4, so "Save as
 * PDF" in the print dialog gives a clean file.
 */
const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .certificate-print, .certificate-print * { visibility: visible !important; }
  .certificate-print {
    position: fixed !important; top: 0 !important; left: 0 !important;
    width: 297mm !important; max-width: none !important; margin: 0 !important;
    border-radius: 0 !important; box-shadow: none !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}`;

export function CertificateView({ serial }: { serial: string }) {
  const { user } = useAuth();
  const [pageUrl, setPageUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ['certificate', serial],
    queryFn: () => api.get<PublicCertificate>(`/certificates/${encodeURIComponent(serial)}`),
  });

  useEffect(() => setPageUrl(window.location.href.split('?')[0]), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address bar still has the link.
    }
  };

  if (query.isLoading)
    return (
      <div className="container-page py-10">
        <div className="skeleton mx-auto aspect-[297/210] max-w-5xl rounded-2xl" />
      </div>
    );

  if (query.isError || !query.data)
    return (
      <div className="container-page py-16">
        <div
          role="alert"
          className="mx-auto max-w-md rounded-3xl border border-red-500/25 bg-white p-8 text-center dark:bg-midnight-950/80"
        >
          <p className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
            الشهادة مش موجودة
          </p>
          <p className="mt-2 text-sm text-midnight-600 dark:text-ivory-300/75">
            {query.error instanceof ApiError && query.error.status === 404
              ? 'الكود ده مش متسجل عندنا. اتأكد إنك كتبته صح.'
              : 'تعذر تحميل الشهادة، حاول تاني بعد شوية.'}
          </p>
        </div>
      </div>
    );

  const certificate = query.data;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `شهادة ${certificate.recipientName} في «${certificate.assessmentTitle}»: ${pageUrl}`,
  )}`;

  return (
    <div className="container-page space-y-6 py-8 sm:py-10">
      <style>{PRINT_CSS}</style>

      <header className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
            <span aria-hidden>✓</span> شهادة موثّقة من {certificate.template.issuerName}
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
            {certificate.template.title} — {certificate.recipientName}
          </h1>
          <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/75">
            كود التحقق <bdi className="font-mono font-bold">{certificate.serial}</bdi>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" onClick={() => window.print()}>
            تحميل PDF / طباعة
          </Button>
          <Button variant="outline" onClick={copyLink}>
            {copied ? 'اتنسخ ✓' : 'نسخ الرابط'}
          </Button>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl border border-emerald-500/40 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            مشاركة على واتساب
          </a>
        </div>
      </header>

      <CertificateSheet
        data={certificate}
        template={certificate.template}
        verifyUrl={pageUrl || undefined}
        className="certificate-print mx-auto max-w-5xl overflow-hidden rounded-2xl shadow-2xl ring-1 ring-gold-500/20"
      />

      <p className="mx-auto max-w-5xl text-center text-xs text-midnight-500 dark:text-ivory-300/60">
        من الموبايل: «تحميل PDF» ← اختار «حفظ كـ PDF» من قائمة الطابعة.
        {user && !user.isStaff && (
          <>
            {' '}
            <Link href="/dashboard/assessments" className="font-bold text-gold-700 underline">
              كل شهاداتي
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
