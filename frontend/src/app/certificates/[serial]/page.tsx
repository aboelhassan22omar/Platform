import type { Metadata } from 'next';
import { CertificateView } from '@/features/certificates/certificate-view';

export const metadata: Metadata = { title: 'شهادة', robots: { index: false, follow: false } };

export default async function CertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  return <CertificateView serial={(await params).serial} />;
}
