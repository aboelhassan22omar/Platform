'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api';
import { authSwitchHref, safeRedirectTarget } from './auth-helpers';

interface LoginErrors {
  identifier?: string;
  password?: string;
}

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [lockRemaining, setLockRemaining] = useState(0);

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setLockRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockRemaining > 0]);

  const lockTime = `${String(Math.floor(lockRemaining / 60)).padStart(2, '0')}:${String(lockRemaining % 60).padStart(2, '0')}`;

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || lockRemaining > 0) return;

    const nextErrors: LoginErrors = {};
    if (!identifier.trim()) nextErrors.identifier = 'اكتب اسم المستخدم أو رقم الموبايل.';
    if (!password) nextErrors.password = 'اكتب كلمة السر.';

    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length) {
      focusFirstError();
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(identifier.trim(), password);
      const fallback = user.isStaff ? '/admin' : '/dashboard';
      router.replace(safeRedirectTarget(searchParams.get('next'), fallback));
    } catch (caught) {
      if (caught instanceof ApiError && caught.retryAfterSeconds) {
        setLockRemaining(Math.max(1, Math.ceil(caught.retryAfterSeconds)));
      }
      setServerError(
        caught instanceof ApiError
          ? caught.message
          : 'تعذر الاتصال بالمنصة. تأكد من الإنترنت وحاول مرة أخرى.',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="auth-form"
      aria-busy={isSubmitting}
    >
      {serverError && (
        <div className="auth-alert" role="alert" tabIndex={-1}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7v6m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>
            {lockRemaining > 0
              ? `تم إيقاف محاولات الدخول مؤقتًا لحماية الحساب. حاول بعد ${lockTime}`
              : serverError}
          </span>
        </div>
      )}

      <div className="auth-field">
        <label htmlFor="login-identifier">اسم المستخدم أو رقم الموبايل</label>
        <div className="auth-input-wrap">
          <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            id="login-identifier"
            type="text"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setErrors((current) => ({ ...current, identifier: undefined }));
              setServerError(null);
            }}
            placeholder="مثال: ahmed أو 01012345678"
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? 'login-identifier-error' : undefined}
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        {errors.identifier && (
          <p id="login-identifier-error" className="auth-field__error">
            {errors.identifier}
          </p>
        )}
      </div>

      <div className="auth-field">
        <div className="auth-field__label-row">
          <label htmlFor="login-password">كلمة السر</label>
          <Link href="/forgot-password">نسيت كلمة السر؟</Link>
        </div>
        <div className="auth-input-wrap auth-input-wrap--password">
          <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect
              x="4"
              y="10"
              width="16"
              height="11"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
              setServerError(null);
            }}
            placeholder="اكتب كلمة السر"
            dir="ltr"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            disabled={isSubmitting}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
            aria-pressed={showPassword}
            disabled={isSubmitting}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10 10 0 0 1 12 4c6.3 0 9.5 8 9.5 8a16 16 0 0 1-2.1 3.2M6.2 6.2C3.7 8.1 2.5 12 2.5 12S5.7 20 12 20a9.8 9.8 0 0 0 4.1-.9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M2.5 12S5.7 4 12 4s9.5 8 9.5 8-3.2 8-9.5 8-9.5-8-9.5-8Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p id="login-password-error" className="auth-field__error">
            {errors.password}
          </p>
        )}
      </div>

      <button type="submit" className="auth-submit" disabled={isSubmitting || lockRemaining > 0}>
        {lockRemaining > 0 ? (
          <span>حاول بعد {lockTime}</span>
        ) : isSubmitting ? (
          <span className="auth-submit__loading">
            <span className="auth-spinner" aria-hidden />
            جاري تسجيل الدخول…
          </span>
        ) : (
          <>
            <span>دخول</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </button>

      <p className="auth-switch">
        أول مرة معانا؟{' '}
        <Link href={authSwitchHref('/register', searchParams.get('next'))}>اعمل حساب جديد</Link>
      </p>
    </form>
  );
}
