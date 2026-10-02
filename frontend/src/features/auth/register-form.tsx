'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api';
import type { EducationSystem, GradeLevel } from '@/types/api';
import {
  authSwitchHref,
  EGYPTIAN_PHONE,
  normalizePhone,
  safeRedirectTarget,
  USERNAME_PATTERN,
} from './auth-helpers';

const SYSTEMS: Array<{
  key: EducationSystem;
  label: string;
  hint: string;
  grades: Array<{ value: GradeLevel; label: string; labelLines: [string, string] }>;
}> = [
  {
    key: 'GENERAL',
    label: 'الثانوية العامة',
    hint: 'النظام العام',
    grades: [
      { value: 'SEC_1', label: 'الصف الأول الثانوي', labelLines: ['الصف الأول', 'الثانوي'] },
      { value: 'SEC_2', label: 'الصف الثاني الثانوي', labelLines: ['الصف الثاني', 'الثانوي'] },
      { value: 'SEC_3', label: 'الصف الثالث الثانوي', labelLines: ['الصف الثالث', 'الثانوي'] },
    ],
  },
  {
    key: 'BACC',
    label: 'البكالوريا المصرية',
    hint: 'النظام الجديد',
    grades: [
      { value: 'BACC_1', label: 'الصف الأول بكالوريا', labelLines: ['الصف الأول', 'بكالوريا'] },
      { value: 'BACC_2', label: 'الصف الثاني بكالوريا', labelLines: ['الصف الثاني', 'بكالوريا'] },
    ],
  },
];

type RegisterField =
  | 'fullName'
  | 'username'
  | 'phone'
  | 'parentPhone'
  | 'password'
  | 'confirmPassword'
  | 'educationSystem'
  | 'gradeLevel';

type RegisterErrors = Partial<Record<RegisterField, string>>;

function FormError({ id, children }: { id: string; children?: string }) {
  return children ? <p id={id} className="auth-field__error">{children}</p> : null;
}

function firstErrorOnly(errors: RegisterErrors): RegisterErrors {
  const first = Object.entries(errors).find(([, message]) => Boolean(message));
  return first ? { [first[0]]: first[1] } : {};
}

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [educationSystem, setEducationSystem] = useState<EducationSystem | null>(null);
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const selectedSystem = SYSTEMS.find((system) => system.key === educationSystem);
  const passwordHasLength = password.length >= 6;

  const clearError = (field: RegisterField) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
  };

  const validate = (scope: 'account' | 'all' = 'all'): RegisterErrors => {
    const nextErrors: RegisterErrors = {};
    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    const cleanUsername = username.trim();
    const cleanPhone = normalizePhone(phone);
    const cleanParentPhone = normalizePhone(parentPhone);

    if (cleanName.length < 3) nextErrors.fullName = 'اكتب الاسم الكامل (٣ حروف على الأقل).';
    else if (cleanName.length > 80) nextErrors.fullName = 'الاسم يجب ألا يزيد عن ٨٠ حرفًا.';

    if (cleanUsername.length < 4) nextErrors.username = 'اسم المستخدم يجب أن يكون ٤ خانات على الأقل.';
    else if (cleanUsername.length > 32) nextErrors.username = 'اسم المستخدم يجب ألا يزيد عن ٣٢ خانة.';
    else if (!USERNAME_PATTERN.test(cleanUsername)) {
      nextErrors.username = 'استخدم حروفًا إنجليزية وأرقامًا، ويمكنك إضافة . أو _ أو -';
    }

    if (!educationSystem) nextErrors.educationSystem = 'اختار نظامك التعليمي.';
    if (!gradeLevel) nextErrors.gradeLevel = 'اختار صفك الدراسي.';

    if (scope === 'account') return nextErrors;

    if (!EGYPTIAN_PHONE.test(cleanPhone)) {
      nextErrors.phone = 'اكتب رقم موبايل مصري صحيح، مثل 01012345678.';
    }
    if (!EGYPTIAN_PHONE.test(cleanParentPhone)) {
      nextErrors.parentPhone = 'اكتب رقم موبايل مصري صحيح لولي الأمر.';
    } else if (cleanPhone === cleanParentPhone) {
      nextErrors.parentPhone = 'رقم ولي الأمر يجب أن يختلف عن رقم الطالب.';
    }

    if (!passwordHasLength) nextErrors.password = 'كلمة السر يجب أن تكون ٦ خانات على الأقل.';
    if (!confirmPassword) nextErrors.confirmPassword = 'أعد كتابة كلمة السر.';
    else if (password !== confirmPassword) nextErrors.confirmPassword = 'كلمتا السر غير متطابقتين.';

    return nextErrors;
  };

  const focusFirstError = () => {
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const handleNextStep = () => {
    const nextErrors = validate('account');
    setErrors(firstErrorOnly(nextErrors));
    setServerError(null);
    if (Object.keys(nextErrors).length) {
      focusFirstError();
      return;
    }

    setStep(2);
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('#reg-phone')?.focus();
    });
  };

  const handlePreviousStep = () => {
    setServerError(null);
    setStep(1);
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('#reg-fullname')?.focus();
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = validate();
    setErrors(firstErrorOnly(nextErrors));
    setServerError(null);
    if (Object.keys(nextErrors).length) {
      if (
        nextErrors.educationSystem ||
        nextErrors.gradeLevel ||
        nextErrors.fullName ||
        nextErrors.username
      ) {
        setStep(1);
      }
      focusFirstError();
      return;
    }

    if (!educationSystem || !gradeLevel) return;

    setIsSubmitting(true);
    try {
      await register({
        fullName: fullName.trim().replace(/\s+/g, ' '),
        username: username.trim().toLowerCase(),
        password,
        phone: normalizePhone(phone),
        parentPhone: normalizePhone(parentPhone),
        educationSystem,
        gradeLevel,
      });

      router.replace(safeRedirectTarget(searchParams.get('next'), '/dashboard'));
    } catch (caught) {
      setServerError(
        caught instanceof ApiError
          ? caught.message
          : 'تعذر الاتصال بالمنصة. تأكد من الإنترنت وحاول مرة أخرى.',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="auth-form auth-form--register" aria-busy={isSubmitting}>
      {serverError && (
        <div className="auth-alert auth-field-grid__full" role="alert" tabIndex={-1}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7v6m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      <div className="auth-register-progress" role="list" aria-label="خطوات إنشاء الحساب">
        <div
          role="listitem"
          className={`auth-register-progress__step ${step === 1 ? 'is-current' : 'is-complete'}`}
          aria-current={step === 1 ? 'step' : undefined}
        >
          <span aria-hidden>{step === 2 ? '✓' : '١'}</span>
          <strong>الدراسة والحساب</strong>
        </div>
        <span className={step === 2 ? 'is-complete' : undefined} aria-hidden />
        <div
          role="listitem"
          className={`auth-register-progress__step ${step === 2 ? 'is-current' : ''}`}
          aria-current={step === 2 ? 'step' : undefined}
        >
          <span aria-hidden>٢</span>
          <strong>التواصل والأمان</strong>
        </div>
      </div>

      <section className="auth-register-step" aria-label="بيانات الدراسة والحساب" hidden={step !== 1}>

      <fieldset className="auth-pathway auth-field-grid__full">
        <legend>اختار نظامك وصفك الدراسي</legend>
        <p>علشان نظهر لك المحتوى المناسب لمنهجك.</p>

        <div className="auth-pathway__systems">
          {SYSTEMS.map((system) => {
            const active = educationSystem === system.key;
            return (
              <button
                key={system.key}
                type="button"
                aria-label={system.label}
                aria-pressed={active}
                aria-invalid={Boolean(errors.educationSystem)}
                className={active ? 'is-selected' : undefined}
                onClick={() => {
                  setEducationSystem(system.key);
                  setGradeLevel(null);
                  clearError('educationSystem');
                  clearError('gradeLevel');
                }}
                disabled={isSubmitting}
              >
                <span className="auth-choice__mark" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <strong>{system.label}</strong>
                  <small>{system.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
        <FormError id="register-system-error">{errors.educationSystem}</FormError>

        <div
          className={`auth-pathway__grades ${
            selectedSystem?.grades.length === 3
              ? 'auth-pathway__grades--three'
              : 'auth-pathway__grades--two'
          }`}
          aria-live="polite"
        >
          {selectedSystem ? (
            selectedSystem.grades.map((grade) => {
              const active = gradeLevel === grade.value;
              return (
                <button
                  key={grade.value}
                  type="button"
                  aria-label={grade.label}
                  aria-pressed={active}
                  aria-invalid={Boolean(errors.gradeLevel)}
                  className={active ? 'is-selected' : undefined}
                  onClick={() => {
                    setGradeLevel(grade.value);
                    clearError('gradeLevel');
                  }}
                  disabled={isSubmitting}
                >
                  <span className="auth-choice__radio" aria-hidden>
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m4 8.2 2.5 2.5L12 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="auth-grade-label" aria-hidden>
                    <span>{grade.labelLines[0]}</span>
                    <span>{grade.labelLines[1]}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <span className="auth-pathway__placeholder">اختار النظام التعليمي الأول</span>
          )}
        </div>
        <FormError id="register-grade-error">{errors.gradeLevel}</FormError>
      </fieldset>

      <div className="auth-field-grid">
        <div className="auth-field auth-field-grid__full">
          <label htmlFor="reg-fullname">الاسم الكامل</label>
          <div className="auth-input-wrap">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              id="reg-fullname"
              type="text"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(event) => { setFullName(event.target.value); clearError('fullName'); }}
              placeholder="اسم الطالب كما سيظهر في المنصة"
              maxLength={80}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'register-name-error' : undefined}
              disabled={isSubmitting}
              required
            />
          </div>
          <FormError id="register-name-error">{errors.fullName}</FormError>
        </div>

        <div className="auth-field auth-field-grid__full">
          <div className="auth-field__label-row">
            <label htmlFor="reg-username">اسم المستخدم</label>
            <span>هتستخدمه في تسجيل الدخول</span>
          </div>
          <div className="auth-input-wrap">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 9.5v3a2 2 0 1 1-4 0v-1a2 2 0 1 1 4 0V12a4 4 0 1 1-1.2-2.85" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              id="reg-username"
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
              value={username}
              onChange={(event) => { setUsername(event.target.value); clearError('username'); }}
              placeholder="ahmed.mohamed"
              maxLength={32}
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? 'register-username-error' : undefined}
              disabled={isSubmitting}
              required
            />
          </div>
          <FormError id="register-username-error">{errors.username}</FormError>
        </div>

      </div>

        <button type="button" className="auth-submit" onClick={handleNextStep}>
          <span>التالي: بيانات التواصل</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      <section className="auth-register-step" aria-label="بيانات التواصل والأمان" hidden={step !== 2}>
        <div className="auth-field-grid">

        <div className="auth-field">
          <label htmlFor="reg-phone">رقم موبايلك</label>
          <div className="auth-input-wrap">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="6" y="2" width="12" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10 5h4m-3 14h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              id="reg-phone"
              type="tel"
              name="phone"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(event) => { setPhone(event.target.value); clearError('phone'); }}
              onBlur={() => phone && setPhone(normalizePhone(phone))}
              placeholder="01012345678"
              maxLength={16}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'register-phone-error' : undefined}
              disabled={isSubmitting}
              required
            />
          </div>
          <FormError id="register-phone-error">{errors.phone}</FormError>
        </div>

        <div className="auth-field">
          <label htmlFor="reg-parent-phone">رقم ولي الأمر</label>
          <div className="auth-input-wrap">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M16 20v-1.5a4.5 4.5 0 0 0-9 0V20M11.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 8a3 3 0 0 1 0 6m2 6v-1.5a4.5 4.5 0 0 0-2-3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              id="reg-parent-phone"
              type="tel"
              name="parentPhone"
              inputMode="numeric"
              dir="ltr"
              value={parentPhone}
              onChange={(event) => { setParentPhone(event.target.value); clearError('parentPhone'); }}
              onBlur={() => parentPhone && setParentPhone(normalizePhone(parentPhone))}
              placeholder="01112345678"
              maxLength={16}
              aria-invalid={Boolean(errors.parentPhone)}
              aria-describedby={errors.parentPhone ? 'register-parent-phone-error' : undefined}
              disabled={isSubmitting}
              required
            />
          </div>
          <FormError id="register-parent-phone-error">{errors.parentPhone}</FormError>
        </div>

        <div className="auth-field">
          <label htmlFor="reg-password">كلمة السر</label>
          <div className="auth-input-wrap auth-input-wrap--password">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="10" width="16" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              dir="ltr"
              value={password}
              onChange={(event) => { setPassword(event.target.value); clearError('password'); }}
              placeholder="كلمة سر قوية"
              minLength={6}
              maxLength={128}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="register-password-rules register-password-error"
              disabled={isSubmitting}
              required
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
                  <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10 10 0 0 1 12 4c6.3 0 9.5 8 9.5 8a16 16 0 0 1-2.1 3.2M6.2 6.2C3.7 8.1 2.5 12 2.5 12S5.7 20 12 20a9.8 9.8 0 0 0 4.1-.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M2.5 12S5.7 4 12 4s9.5 8 9.5 8-3.2 8-9.5 8-9.5-8-9.5-8Z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </div>
          <div id="register-password-rules" className="auth-password-rules">
            <span className={passwordHasLength ? 'is-met' : undefined}><i aria-hidden />٦ خانات على الأقل — أرقام أو حروف</span>
          </div>
          <FormError id="register-password-error">{errors.password}</FormError>
        </div>

        <div className="auth-field">
          <label htmlFor="reg-confirm-password">تأكيد كلمة السر</label>
          <div className="auth-input-wrap auth-input-wrap--password">
            <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              id="reg-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              dir="ltr"
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); clearError('confirmPassword'); }}
              placeholder="اكتب كلمة السر مرة تانية"
              minLength={6}
              maxLength={128}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
              disabled={isSubmitting}
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة السر' : 'إظهار تأكيد كلمة السر'}
              aria-pressed={showConfirmPassword}
              disabled={isSubmitting}
            >
              {showConfirmPassword ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10 10 0 0 1 12 4c6.3 0 9.5 8 9.5 8a16 16 0 0 1-2.1 3.2M6.2 6.2C3.7 8.1 2.5 12 2.5 12S5.7 20 12 20a9.8 9.8 0 0 0 4.1-.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M2.5 12S5.7 4 12 4s9.5 8 9.5 8-3.2 8-9.5 8-9.5-8-9.5-8Z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </div>
          <FormError id="register-confirm-error">{errors.confirmPassword}</FormError>
        </div>
      </div>

        <div className="auth-register-actions">
          <button type="button" className="auth-secondary-button" onClick={handlePreviousStep} disabled={isSubmitting}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>رجوع</span>
          </button>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="auth-submit__loading">
                <span className="auth-spinner" aria-hidden />
                جاري إنشاء حسابك…
              </span>
            ) : (
              <>
                <span>اعمل حسابي</span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </>
            )}
          </button>
        </div>

        <p className="auth-legal">
          بإنشاء الحساب أنت توافق على <Link href="/terms">الشروط والأحكام</Link> و<Link href="/privacy">سياسة الخصوصية</Link>.
        </p>
      </section>

      <p className="auth-switch auth-field-grid__full">
        عندك حساب بالفعل؟{' '}
        <Link href={authSwitchHref('/login', searchParams.get('next'))}>سجّل دخولك</Link>
      </p>
    </form>
  );
}
