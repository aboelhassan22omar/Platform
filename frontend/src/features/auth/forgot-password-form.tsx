'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import type { OtpChallenge } from '@/components/providers/auth-provider';
import { api, ApiError } from '@/lib/api';
import { EGYPTIAN_PHONE, normalizePhone } from '@/lib/phone';
import { OtpVerificationForm } from './otp-verification-form';

export function ForgotPasswordForm() {
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const request = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const normalized = normalizePhone(phone);
    if (!EGYPTIAN_PHONE.test(normalized)) {
      setError('اكتب رقم موبايل مصري صحيح.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.post<OtpChallenge>('/auth/password/reset/request', {
        phone: normalized,
      });
      setPhone(normalized);
      setChallenge(next);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'تعذر إرسال الكود، حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') ?? '');
    if (newPassword.length < 6 || newPassword.length > 128) {
      setError('كلمة السر لازم تكون من ٦ إلى ١٢٨ خانة.');
      return;
    }
    if (newPassword !== form.get('confirmPassword')) {
      setError('كلمتا السر مش متطابقتين.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/password/reset/confirm', { token, newPassword });
      setToken(null);
      setConfirmed(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'تعذر تغيير كلمة السر، حاول مرة أخرى.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (confirmed)
    return (
      <div className="space-y-4 text-center">
        <h2 className="font-display text-lg font-black text-emerald-600 dark:text-emerald-400">
          تم تغيير كلمة السر
        </h2>
        <p className="text-sm">تقدر تسجّل دخولك دلوقتي بكلمة السر الجديدة.</p>
        <Link href="/login" className="auth-submit">
          تسجيل الدخول
        </Link>
      </div>
    );

  if (challenge && !token)
    return (
      <OtpVerificationForm
        challenge={challenge}
        phone={phone}
        onChallenge={setChallenge}
        onBack={() => {
          setChallenge(null);
          setError(null);
        }}
        onVerify={async (code) => {
          const result = await api.post<{ token: string }>('/auth/password/reset/verify', {
            challengeId: challenge.challengeId,
            code,
          });
          setToken(result.token);
        }}
      />
    );

  return (
    <div className="space-y-4">
      {token ? (
        <form onSubmit={confirm} noValidate className="space-y-3" aria-busy={busy}>
          <p
            role="status"
            className="rounded-xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-700 dark:text-emerald-400"
          >
            تم تأكيد رقمك. اختار كلمة السر الجديدة.
          </p>
          <Field
            label="كلمة السر الجديدة"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={128}
            required
            autoFocus
            disabled={busy}
          />
          <Field
            label="تأكيد كلمة السر"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={128}
            required
            disabled={busy}
          />
          {error && (
            <p role="alert" className="auth-field__error">
              {error}
            </p>
          )}
          <Button type="submit" variant="accent" fullWidth isLoading={busy}>
            غيّر كلمة السر
          </Button>
          <button
            type="button"
            className="auth-secondary-button w-full"
            disabled={busy}
            onClick={() => {
              setToken(null);
              setChallenge(null);
              setError(null);
            }}
          >
            ابدأ من جديد
          </button>
        </form>
      ) : (
        <form onSubmit={request} noValidate className="space-y-3" aria-busy={busy}>
          <Field
            label="رقم الموبايل المسجل"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            dir="ltr"
            placeholder="01012345678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            disabled={busy}
          />
          <p className="text-sm text-midnight-500 dark:text-ivory-300">
            لو الرقم مسجل عندنا، هنبعتلك كود التحقق على واتساب.
          </p>
          {error && (
            <p role="alert" className="auth-field__error">
              {error}
            </p>
          )}
          <Button type="submit" variant="accent" fullWidth isLoading={busy}>
            ابعت كود واتساب
          </Button>
        </form>
      )}
      <p className="text-center text-sm">
        افتكرتها؟{' '}
        <Link href="/login" className="font-bold text-gold-600 dark:text-gold-400 hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
