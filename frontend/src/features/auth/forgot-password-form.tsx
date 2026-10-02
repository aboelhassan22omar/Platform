'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api';
import { EGYPTIAN_PHONE, normalizePhone } from './auth-helpers';

interface ResetResponse {
  message: string;
  devToken?: string;
  devNotice?: string;
}

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmToken, setConfirmToken] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const request = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const phone = normalizePhone(String(new FormData(event.currentTarget).get('phone') ?? ''));
    if (!EGYPTIAN_PHONE.test(phone)) {
      setError('اكتب رقم موبايل مصري صحيح');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<ResetResponse>('/auth/password/reset/request', {
        phone,
      });
      setResult(response);
      if (response.devToken) setConfirmToken(response.devToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حصل خطأ، حاول تاني');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfirmError(null);

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (newPassword.length < 6) {
      setConfirmError('كلمة السر لازم تكون ٦ خانات على الأقل (أرقام أو حروف)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setConfirmError('كلمتا السر مش متطابقتين');
      return;
    }

    setIsConfirming(true);
    try {
      await api.post('/auth/password/reset/confirm', {
        token: confirmToken,
        newPassword,
      });
      setConfirmed(true);
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'الكود غير صالح');
      setIsConfirming(false);
    }
  };

  if (confirmed) {
    return (
      <div className="text-center">
        <span
          aria-hidden
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor">
            <path
              d="M6 13.5l5 5 9-10"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2 className="mt-4 font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
          تم تغيير كلمة السر
        </h2>
        <p className="mt-1.5 text-sm text-midnight-600 dark:text-ivory-300/75">
          تقدر تسجّل دخولك دلوقتي بكلمة السر الجديدة.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 px-6 text-sm font-extrabold text-midnight-950 shadow-md hover:brightness-110 transition-all"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={request} noValidate className="space-y-5">
        <Field
          label="رقم الموبايل المسجل"
          name="phone"
          type="tel"
          inputMode="numeric"
          dir="ltr"
          placeholder="01012345678"
          required
        />

        {error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          className="bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-midnight-950 font-extrabold shadow-[0_10px_25px_-5px_rgba(200,149,42,0.45)] border-none"
        >
          ابعتلي خطوات الاستعادة
        </Button>
      </form>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 border-t border-ivory-300 dark:border-midnight-700 pt-5"
        >
          <p className="rounded-xl bg-sky-50 dark:bg-sky-950/40 px-4 py-3 text-sm leading-relaxed text-sky-800 dark:text-sky-300">
            {result.message}
          </p>

          {result.devToken && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4">
              <p className="text-xs font-black text-amber-900 dark:text-amber-300">
                ⚠️ وضع التطوير
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-400">
                {result.devNotice}
              </p>
              <code className="mt-2 block overflow-x-auto rounded-lg bg-white dark:bg-midnight-950 px-3 py-2 font-mono text-[11px] text-midnight-700 dark:text-gold-300">
                {result.devToken}
              </code>
            </div>
          )}

          <form onSubmit={confirm} noValidate className="space-y-4">
            <Field
              label="كود إعادة التعيين"
              name="token"
              value={confirmToken}
              onChange={(event) => setConfirmToken(event.target.value)}
              dir="ltr"
              required
            />
            <Field
              label="كلمة السر الجديدة"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={6}
              hint="٦ خانات على الأقل (أرقام أو حروف)"
              required
            />
            <Field
              label="تأكيد كلمة السر"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />

            {confirmError && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {confirmError}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={isConfirming}
              className="bg-gradient-to-r from-gold-500 via-amber-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-midnight-950 font-extrabold shadow-[0_10px_25px_-5px_rgba(200,149,42,0.45)] border-none"
            >
              غيّر كلمة السر
            </Button>
          </form>
        </motion.div>
      )}

      <p className="text-center text-sm text-midnight-600 dark:text-ivory-300/75">
        افتكرتها؟{' '}
        <Link href="/login" className="font-bold text-gold-600 dark:text-gold-400 hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
