'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QrCode } from '@/components/ui/qr-code';
import { api, ApiError } from '@/lib/api';
import { formatEgp } from '@/lib/utils';
import type { Order } from '@/types/api';

/** wa.me needs the number in international form without "+" (2010...). */
const whatsappLink = (phone: string, text: string) =>
  `https://wa.me/2${phone}?text=${encodeURIComponent(text)}`;

const nowHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/** Vodafone Cash transfer USSD (*9*7*number*amount#); `#` must be escaped in a tel: link. */
const vodafoneCashDial = (phone: string, amountMinor: number) =>
  `tel:*9*7*${phone}${amountMinor % 100 === 0 ? `*${amountMinor / 100}` : ''}%23`;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="min-h-9 shrink-0 rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
      aria-label={label}
    >
      {copied ? 'اتنسخ ✓' : 'نسخ'}
    </button>
  );
}

/**
 * Manual transfer: where to send the money (number, QR, one-tap link) and the
 * proof form (sender number + screenshot). Nothing unlocks until an admin
 * approves the proof against the receiving wallet.
 */
export function TransferForm({ order }: { order: Order }) {
  const details = order.payment.transfer!;
  const isInstapay = details.method === 'INSTAPAY';
  const methodName = isInstapay ? 'إنستا باي' : 'فودافون كاش';
  const dialLink = vodafoneCashDial(details.phone, order.totalMinor);
  const ussdCode = decodeURIComponent(dialLink.replace(/^tel:/, ''));
  const qrValue = isInstapay ? details.instapayLink : dialLink;
  const openLink = isInstapay ? details.instapayLink : dialLink;

  return (
    <section className="w-full space-y-5 text-start">
      <header className="text-center">
        <p className="text-xs font-black text-[var(--accent)]">خطوة أخيرة</p>
        <h1 className="mt-1 font-display text-2xl font-black text-[var(--text-primary)]">
          حوّل {formatEgp(order.totalMinor)} بـ{methodName}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          حوّل المبلغ، وبعدها ابعتلنا صورة التحويل على واتساب. هنراجعه ونفتحلك المحتوى.
        </p>
      </header>

      {/* --- Where to send ------------------------------------------------ */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          {qrValue && (
            <div className="flex shrink-0 flex-col items-center gap-2">
              <QrCode
                value={qrValue}
                size={152}
                label={
                  isInstapay ? 'كود QR للتحويل بإنستا باي' : 'كود QR لكود التحويل بفودافون كاش'
                }
              />
              <p className="max-w-[10.5rem] text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
                {isInstapay
                  ? 'امسحه من تطبيق إنستا باي أو كاميرا موبايلك'
                  : 'امسحه بكاميرا موبايلك وهيفتحلك كود التحويل جاهز'}
              </p>
            </div>
          )}
          <dl className="w-full min-w-0 space-y-3">
            <div>
              <dt className="text-xs font-bold text-[var(--text-muted)]">
                {isInstapay ? 'رقم إنستا باي' : 'رقم فودافون كاش'}
              </dt>
              <dd className="mt-1 flex items-center justify-between gap-3">
                <bdi
                  dir="ltr"
                  className="font-display text-2xl font-black tracking-wide text-[var(--text-primary)]"
                >
                  {details.phone}
                </bdi>
                <CopyButton value={details.phone} label="نسخ الرقم" />
              </dd>
            </div>
            {details.instapayAddress && (
              <div>
                <dt className="text-xs font-bold text-[var(--text-muted)]">عنوان إنستا باي</dt>
                <dd className="mt-1 flex items-center justify-between gap-3">
                  <bdi dir="ltr" className="truncate font-bold text-[var(--text-primary)]">
                    {details.instapayAddress}
                  </bdi>
                  <CopyButton value={details.instapayAddress} label="نسخ العنوان" />
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-bold text-[var(--text-muted)]">المبلغ</dt>
              <dd className="mt-1 font-display text-xl font-black text-[var(--accent)]">
                {formatEgp(order.totalMinor)}
              </dd>
            </div>
            {details.recipientName && (
              <p className="rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                اتأكد إن اسم المستلم في التطبيق: <strong>{details.recipientName}</strong>
              </p>
            )}
          </dl>
        </div>

        {openLink && (
          <a
            href={openLink}
            target={isInstapay ? '_blank' : undefined}
            rel={isInstapay ? 'noopener noreferrer' : undefined}
            className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-base font-black text-[var(--accent-contrast)] shadow-[0_10px_30px_-14px_var(--accent)] transition hover:brightness-110"
          >
            {isInstapay ? 'افتح إنستا باي وحوّل' : 'حوّل بفودافون كاش من موبايلك'}
          </a>
        )}
        {!isInstapay && (
          <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
            الزرار بيكتبلك الكود{' '}
            <span dir="ltr" className="inline-block font-mono" style={{ unicodeBidi: 'isolate' }}>
              {ussdCode}
            </span>
            ، ومن أي محفظة تانية حوّل على نفس الرقم.
          </p>
        )}
      </div>

      {/* --- Proof -------------------------------------------------------- */}
      <WhatsAppProof order={order} />
    </section>
  );
}

function WhatsAppProof({ order }: { order: Order }) {
  const details = order.payment.transfer!;
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(details.senderPhone ?? '');
  const [time, setTime] = useState(details.transferTime ?? nowHHMM());
  const [error, setError] = useState('');
  const sent = details.state === 'submitted';
  const senderPhone = phone.replace(/[^\d]/g, '').replace(/^20(?=1)/, '0');
  const valid = /^01[0125]\d{8}$/.test(senderPhone);
  const methodName = details.method === 'INSTAPAY' ? 'إنستا باي' : 'فودافون كاش';
  const message = [
    `السلام عليكم، حوّلت ثمن الطلب ${order.reference}`,
    `المبلغ: ${formatEgp(order.totalMinor)} (${methodName})`,
    `الرقم اللي حوّلت منه: ${valid ? senderPhone : '...'}`,
    `وقت التحويل: حوالي ${time || '...'}`,
    'ومرفق صورة التحويل 👇',
  ].join('\n');
  const link = details.whatsappPhone ? whatsappLink(details.whatsappPhone, message) : null;

  const field =
    'mt-1 block min-h-11 w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none';

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
      <div>
        <h2 className="font-display text-lg font-black text-[var(--text-primary)]">
          بعد ما تحوّل، ابعت الصورة على واتساب
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
          اكتب الرقم اللي حوّلت منه ووقت التحويل، ودوس الزرار: هيفتحلك واتساب برسالة جاهزة، ابعت
          معاها سكرين شوت التحويل.
        </p>
        {details.state === 'rejected' && (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          >
            محتاجين نراجع تحويلك تاني: <strong>{details.rejectionReason}</strong>
          </p>
        )}
        {sent && (
          <p
            role="status"
            className="mt-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--text-secondary)]"
          >
            تمام ✓ طلبك عندنا وبنراجعه. أول ما نأكد وصول المبلغ هيوصلك إشعار والمحتوى هيتفتح لوحده.
            لو لسه ما بعتش الصورة على واتساب، ابعتها دلوقتي.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-[var(--text-secondary)]">
          الرقم اللي حوّلت منه
          <input
            dir="ltr"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="01xxxxxxxxx"
            maxLength={14}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setError('');
            }}
            className={field}
          />
        </label>
        <label className="block text-sm font-bold text-[var(--text-secondary)]">
          وقت التحويل تقريبًا
          <input
            type="time"
            dir="ltr"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className={field}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (!valid) {
              event.preventDefault();
              setError('اكتب الرقم اللي حوّلت منه صح (01xxxxxxxxx).');
              return;
            }
            // Recorded for the admin's review; WhatsApp opens in parallel so
            // the browser keeps it as a direct tap (no popup blocking).
            void api
              .post(`/orders/${order.reference}/transfer`, {
                senderPhone,
                transferTime: time || undefined,
              })
              .then(() => queryClient.invalidateQueries({ queryKey: ['order', order.reference] }))
              .catch((caught) =>
                setError(
                  caught instanceof ApiError
                    ? caught.message
                    : 'الرسالة اتفتحت على واتساب، بس ما قدرناش نسجّل البيانات هنا. ابعت الصورة عادي.',
                ),
              );
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-5 text-base font-black text-white shadow-[0_10px_30px_-14px_#1fa855] transition hover:brightness-110"
        >
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.5 3.9 1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
          </svg>
          ابعت صورة التحويل على واتساب
        </a>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">ابعت صورة التحويل للدعم على واتساب.</p>
      )}
      {details.whatsappPhone && (
        <p className="text-center text-xs text-[var(--text-muted)]">
          أو ابعتها يدويًا على واتساب:{' '}
          <bdi dir="ltr" className="font-bold text-[var(--text-secondary)]">
            {details.whatsappPhone}
          </bdi>
        </p>
      )}
    </div>
  );
}
