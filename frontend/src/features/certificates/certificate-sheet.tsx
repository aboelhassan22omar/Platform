'use client';

import { Fragment, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { platformConfig } from '@/config/platform.config';
import { cn, formatDate, toArabicDigits } from '@/lib/utils';

export interface CertificateTemplate {
  title: string;
  intro: string;
  /** Supports {exam}, {score} and {date}. */
  body: string;
  issuerName: string;
  signatureName: string;
  signatureTitle: string;
}

export interface CertificateData {
  serial: string;
  recipientName: string;
  assessmentTitle: string;
  percentage: number;
  issuedAt: string;
}

const GOLD = '#bd7f18';
const INK = '#05131f';
/** Diamond ornaments centred on the outer frame's corners. */
const CORNERS = [
  { top: '2.2cqw', right: '2.2cqw', translate: '50% -50%' },
  { top: '2.2cqw', left: '2.2cqw', translate: '-50% -50%' },
  { bottom: '2.2cqw', right: '2.2cqw', translate: '50% 50%' },
  { bottom: '2.2cqw', left: '2.2cqw', translate: '-50% 50%' },
];

function useQr(value: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value]);
  return src;
}

/** The body text with {exam}, {score} and {date} filled in; the exam and score in bold. */
function Body({ text, data }: { text: string; data: CertificateData }) {
  const values: Record<string, string> = {
    '{exam}': data.assessmentTitle,
    '{score}': `${toArabicDigits(data.percentage)}٪`,
    '{date}': formatDate(data.issuedAt),
  };
  return (
    <>
      {text.split(/(\{exam\}|\{score\}|\{date\})/).map((part, index) =>
        part in values ? (
          <strong key={index} className="font-black" style={{ color: INK }}>
            {values[part]}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * A4-landscape certificate, scaled to its container's width (all sizes are in
 * container units), so the same component renders the admin preview, the
 * student's page and the printed PDF. Always on light "paper", whatever the
 * site theme.
 */
export function CertificateSheet({
  data,
  template,
  verifyUrl,
  className,
}: {
  data: CertificateData;
  template: CertificateTemplate;
  /** Encoded in the QR. Omitted in the admin preview. */
  verifyUrl?: string;
  className?: string;
}) {
  const qr = useQr(verifyUrl ?? null);

  return (
    <div className={cn('[container-type:inline-size]', className)}>
      <div
        dir="rtl"
        className="relative aspect-[297/210] w-full overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 50% 40%, #fffdf6 0%, #fbf3df 70%, #f3e4bf 100%)',
          color: INK,
          fontFamily: 'var(--font-arabic)',
        }}
      >
        {/* Double gold frame with corner ornaments. */}
        <div
          className="absolute inset-[2.2cqw] rounded-[0.6cqw]"
          style={{ border: `0.45cqw solid ${GOLD}` }}
        />
        <div
          className="absolute inset-[3.3cqw] rounded-[0.4cqw]"
          style={{ border: `0.12cqw solid ${GOLD}` }}
        />
        {CORNERS.map((corner, index) => (
          <span
            key={index}
            className="absolute h-[3.2cqw] w-[3.2cqw] rotate-45"
            style={{ ...corner, border: `0.3cqw solid ${GOLD}`, background: '#fbf3df' }}
            aria-hidden
          />
        ))}

        <div className="absolute inset-[6cqw] flex flex-col items-center text-center">
          <img
            src={platformConfig.brand.logoLight}
            alt=""
            className="h-[7cqw] w-auto object-contain"
            draggable={false}
          />
          <p className="mt-[0.6cqw] text-[1.5cqw] font-bold tracking-wide" style={{ color: GOLD }}>
            {template.issuerName}
          </p>

          <h2
            className="mt-[1.6cqw] text-[5cqw] font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', color: GOLD }}
          >
            {template.title}
          </h2>

          {template.intro && (
            <p className="mt-[2.2cqw] text-[1.8cqw] text-[#306b7a]">{template.intro}</p>
          )}
          <p
            className="mt-[1cqw] max-w-full truncate px-[2cqw] pb-[0.6cqw] text-[4.2cqw] font-black leading-tight"
            style={{
              fontFamily: 'var(--font-display)',
              borderBottom: `0.15cqw solid ${GOLD}`,
            }}
          >
            {data.recipientName}
          </p>
          <p className="mt-[2cqw] max-w-[80%] text-[1.9cqw] leading-[1.7] text-[#1c414e]">
            <Body text={template.body} data={data} />
          </p>

          <div className="mt-auto grid w-full grid-cols-3 items-end gap-[2cqw]">
            <div className="text-[1.4cqw]">
              <p className="font-black">{formatDate(data.issuedAt)}</p>
              <p className="mt-[0.4cqw] text-[#4c8996]">تاريخ الإصدار</p>
            </div>
            <div className="grid place-items-center">
              <div
                className="grid h-[9cqw] w-[9cqw] place-items-center rounded-full text-center"
                style={{ border: `0.35cqw double ${GOLD}`, background: '#fff9e8' }}
              >
                <div>
                  <p
                    className="text-[2.6cqw] font-black leading-none"
                    style={{ color: GOLD, fontFamily: 'var(--font-display)' }}
                  >
                    {toArabicDigits(data.percentage)}٪
                  </p>
                  <p className="mt-[0.3cqw] text-[1cqw] font-bold text-[#306b7a]">الدرجة</p>
                </div>
              </div>
            </div>
            <div className="text-[1.4cqw]">
              <p
                className="font-black"
                style={{ fontFamily: 'var(--font-display)', fontSize: '1.9cqw' }}
              >
                {template.signatureName}
              </p>
              <div
                className="mx-auto mt-[0.4cqw] h-[0.12cqw] w-[70%]"
                style={{ background: GOLD }}
              />
              <p className="mt-[0.4cqw] text-[#4c8996]">{template.signatureTitle}</p>
            </div>
          </div>
        </div>

        {/* Verification: QR + serial, top-left corner (clear of the signature). */}
        <div className="absolute left-[5cqw] top-[5cqw] flex items-start gap-[0.8cqw]" dir="ltr">
          {qr && <img src={qr} alt="" className="h-[6cqw] w-[6cqw]" draggable={false} />}
          <p className="text-[0.95cqw] leading-tight text-[#4c8996]">
            <span dir="rtl" className="block">
              كود التحقق
            </span>
            <span className="font-mono font-bold tracking-wider" style={{ color: INK }}>
              {data.serial}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
