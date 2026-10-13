'use client';

import { useEffect, useState } from 'react';
import type { OtpChallenge } from '@/components/providers/auth-provider';
import { api, ApiError } from '@/lib/api';

export function OtpVerificationForm({
  challenge,
  phone,
  onChallenge,
  onVerify,
  onBack,
}: {
  challenge: OtpChallenge;
  phone: string;
  onChallenge: (next: OtpChallenge) => void;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [deadlines, setDeadlines] = useState(() => ({
    expires: Date.now() + challenge.expiresIn * 1000,
    resend: Date.now() + challenge.resendAfterSeconds * 1000,
  }));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setCode('');
    setDeadlines({
      expires: Date.now() + challenge.expiresIn * 1000,
      resend: Date.now() + challenge.resendAfterSeconds * 1000,
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);
  // Click-to-chat: poll until the student's WhatsApp message comes back as a code.
  const viaLink = challenge.delivery === 'whatsapp-link';
  const [linkStatus, setLinkStatus] = useState<'pending' | 'code_sent' | 'failed'>('pending');
  useEffect(() => {
    setLinkStatus('pending');
    if (!viaLink) return;
    let stopped = false;
    const poll = async () => {
      try {
        const { status } = await api.post<{ status: string }>('/auth/otp/status', {
          challengeId: challenge.challengeId,
        });
        if (stopped) return;
        if (status === 'code_sent') return setLinkStatus('code_sent');
        if (status !== 'pending') return setLinkStatus('failed');
      } catch {
        // Transient; keep polling.
      }
      if (!stopped) timer = window.setTimeout(poll, 3000);
    };
    let timer = window.setTimeout(poll, 3000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [challenge, viaLink]);
  const resendSeconds = Math.max(0, Math.ceil((deadlines.resend - now) / 1000));
  const expiresSeconds = Math.max(0, Math.ceil((deadlines.expires - now) / 1000));

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('اكتب كود التحقق المكوّن من ٦ أرقام.');
      return;
    }
    setBusy(true);
    try {
      await onVerify(code);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'تعذر التحقق، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (busy || resendSeconds) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const next = await api.post<OtpChallenge>('/auth/otp/resend', {
        challengeId: challenge.challengeId,
      });
      onChallenge(next);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'تعذر إرسال الكود، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={verify} noValidate className="auth-form" aria-busy={busy}>
      <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 text-center">
        <h2 className="font-display text-lg font-black">تأكيد رقم الواتساب</h2>
        {viaLink ? (
          <p className="mt-1 text-sm">
            افتح واتساب من الموبايل اللي عليه رقم <bdi dir="ltr">{phone}</bdi> وابعت الرسالة زي ما
            هي، وهيوصلك كود التحقق في نفس الشات.
          </p>
        ) : (
          <p className="mt-1 text-sm">
            اكتب الكود المرسل إلى <bdi dir="ltr">{phone}</bdi>
          </p>
        )}
      </div>
      {viaLink && (
        <div className="space-y-2 text-center">
          <a
            href={challenge.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="auth-submit"
          >
            افتح واتساب وابعت الرسالة
          </a>
          <p className="text-xs opacity-80">
            الرابط ما فتحش؟ ابعت <bdi className="font-bold">{challenge.whatsappMessage}</bdi> على
            رقم <bdi dir="ltr">+{challenge.businessNumber}</bdi>
          </p>
          <p role="status" aria-live="polite" className="text-sm font-bold">
            {linkStatus === 'code_sent' ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ الكود اتبعتلك على واتساب، اكتبه تحت.
              </span>
            ) : linkStatus === 'failed' ? (
              <span className="text-red-600 dark:text-red-400">
                تعذر إرسال الكود. اطلب رابط جديد وجرب تاني.
              </span>
            ) : (
              <span className="opacity-80">مستنيين رسالتك على واتساب…</span>
            )}
          </p>
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="whatsapp-otp">كود التحقق</label>
        <div className="auth-input-wrap">
          <input
            id="whatsapp-otp"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(
                event.target.value
                  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
                  .replace(/\D/g, '')
                  .slice(0, 6),
              );
              setError(null);
            }}
            autoFocus
            required
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby="otp-status otp-error"
            className="text-center text-xl tracking-[0.4em]"
          />
        </div>
      </div>
      <p id="otp-status" className="text-center text-xs opacity-80">
        {expiresSeconds
          ? `الكود صالح لمدة ${Math.floor(expiresSeconds / 60)}:${String(expiresSeconds % 60).padStart(2, '0')}`
          : 'انتهت صلاحية الكود. ابدأ من جديد لطلب كود آخر.'}
      </p>
      {error && (
        <p id="otp-error" role="alert" className="auth-field__error">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="text-center text-sm text-emerald-500">
          {viaLink ? 'تم تجهيز رابط جديد، ابعت الرسالة الجديدة.' : 'تم إرسال كود جديد.'}
        </p>
      )}
      <button type="submit" className="auth-submit" disabled={busy || !expiresSeconds}>
        {busy ? 'جاري التحقق…' : 'تأكيد الكود'}
      </button>
      <div className="auth-register-actions">
        <button type="button" className="auth-secondary-button" disabled={busy} onClick={onBack}>
          رجوع
        </button>
        <button
          type="button"
          className="auth-secondary-button"
          disabled={busy || resendSeconds > 0 || !expiresSeconds}
          onClick={resend}
        >
          {resendSeconds
            ? `إعادة الإرسال بعد ${resendSeconds} ث`
            : viaLink
              ? 'طلب رابط جديد'
              : 'إعادة إرسال الكود'}
        </button>
      </div>
    </form>
  );
}
