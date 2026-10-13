'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/ui/qr-code';
import { api, ApiError } from '@/lib/api';
import { formatEgp } from '@/lib/utils';
import type { Order } from '@/types/api';

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

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
          حوّل المبلغ، وبعدها ابعتلنا الرقم اللي حوّلت منه وصورة التحويل. هنراجعه ونفتحلك المحتوى.
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
      {details.state === 'submitted' ? <SubmittedNotice /> : <ProofForm order={order} />}
    </section>
  );
}

function SubmittedNotice() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-5 text-center"
    >
      <p className="font-display text-lg font-black text-[var(--text-primary)]">
        وصلنا إثبات التحويل ✓
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
        بنراجعه دلوقتي، وأول ما نأكد هيوصلك إشعار والمحتوى هيتفتح لوحده. ممكن تقفل الصفحة.
      </p>
    </div>
  );
}

function ProofForm({ order }: { order: Order }) {
  const details = order.payment.transfer!;
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const pick = (selected: File | undefined) => {
    setError('');
    if (!selected) return;
    if (!RECEIPT_TYPES.includes(selected.type)) {
      setError('ارفع صورة JPG أو PNG (سكرين شوت التحويل).');
      return;
    }
    if (selected.size > MAX_RECEIPT_BYTES) {
      setError('الصورة أكبر من ٥ ميجا، ابعت سكرين شوت بدلها.');
      return;
    }
    setFile(selected);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(selected);
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError('');
    const senderPhone = phone.replace(/[^\d]/g, '');
    if (!/^01[0125]\d{8}$/.test(senderPhone)) {
      setError('اكتب الرقم اللي حوّلت منه صح (01xxxxxxxxx).');
      return;
    }
    if (!file) {
      setError('ارفع صورة التحويل.');
      return;
    }
    setPending(true);
    try {
      const ticket = await api.post<{
        key: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>(`/orders/${order.reference}/transfer/receipt`, {
        contentType: file.type,
        sizeBytes: file.size,
      });
      const upload = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: ticket.headers,
        body: file,
      });
      if (!upload.ok) throw new Error('تعذر رفع الصورة، جرّب تاني.');
      await api.post(`/orders/${order.reference}/transfer`, {
        senderPhone,
        transactionReference: reference.trim() || undefined,
        receiptKey: ticket.key,
      });
      await queryClient.invalidateQueries({ queryKey: ['order', order.reference] });
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : 'تعذر إرسال البيانات، جرّب تاني.',
      );
    } finally {
      setPending(false);
    }
  };

  const field =
    'mt-1 block min-h-11 w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none';

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5"
    >
      <div>
        <h2 className="font-display text-lg font-black text-[var(--text-primary)]">
          بعد ما تحوّل، ابعت الإثبات
        </h2>
        {details.state === 'rejected' && (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          >
            الإثبات اللي بعته محتاج تعديل: <strong>{details.rejectionReason}</strong>
          </p>
        )}
      </div>

      <label className="block text-sm font-bold text-[var(--text-secondary)]">
        الرقم اللي حوّلت منه
        <input
          dir="ltr"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="01xxxxxxxxx"
          maxLength={14}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={field}
        />
      </label>

      <div>
        <p className="text-sm font-bold text-[var(--text-secondary)]">صورة التحويل (سكرين شوت)</p>
        <label className="mt-1 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-subtle)] p-3 text-center text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]">
          {preview ? (
            <img
              src={preview}
              alt="معاينة صورة التحويل"
              className="max-h-56 rounded-lg object-contain"
            />
          ) : (
            <span>اضغط هنا واختار صورة التحويل من الموبايل</span>
          )}
          {preview && <span className="text-xs font-bold text-[var(--accent)]">تغيير الصورة</span>}
          <input
            type="file"
            accept={RECEIPT_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </label>
      </div>

      <label className="block text-sm font-bold text-[var(--text-secondary)]">
        رقم العملية <span className="font-normal text-[var(--text-muted)]">(اختياري)</span>
        <input
          dir="ltr"
          maxLength={100}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          className={field}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" variant="accent" size="lg" fullWidth isLoading={pending}>
        ابعت الإثبات للمراجعة
      </Button>
    </form>
  );
}
