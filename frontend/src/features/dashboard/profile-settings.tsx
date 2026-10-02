'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/components/providers/auth-provider';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDurationLabel } from '@/lib/utils';
import { EASE_ENTRANCE } from '@/lib/motion';
import type { LeaderboardResponse, ProgressSummary } from '@/types/api';
import { AchievementsLibrary } from './achievements-library';

const GRADE_LABELS: Record<string, string> = {
  SEC_1: 'الصف الأول الثانوي',
  SEC_2: 'الصف الثاني الثانوي',
  SEC_3: 'الصف الثالث الثانوي',
  BACC_1: 'الصف الأول بكالوريا',
  BACC_2: 'الصف الثاني بكالوريا',
};

const EGYPTIAN_PHONE = /^(010|011|012|015)\d{8}$/;

export function ProfileSettings() {
  const { user, refresh, logout } = useAuth();
  const { data: studySummary, isLoading: studySummaryLoading } = useQuery({
    queryKey: ['study-summary'],
    queryFn: () => api.get<ProgressSummary>('/me/progress/summary'),
    enabled: Boolean(user),
  });
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['leaderboard', user?.gradeLevel],
    queryFn: () => api.get<LeaderboardResponse>('/leaderboard'),
    enabled: Boolean(user),
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) return null;

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get('fullName') ?? '').trim();
    const parentPhone = String(form.get('parentPhone') ?? '').trim();

    if (fullName.length < 3) {
      setProfileError('اكتب اسمك الكامل');
      return;
    }
    if (!EGYPTIAN_PHONE.test(parentPhone)) {
      setProfileError('رقم ولي الأمر لازم يكون رقم مصري صحيح');
      return;
    }

    setSavingProfile(true);
    try {
      await api.patch('/auth/me', { fullName, parentPhone });
      await refresh();
      setProfileMessage('تم حفظ بياناتك');
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'حصل خطأ، حاول تاني');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (newPassword.length < 6) {
      setPasswordError('كلمة السر الجديدة ٦ خانات على الأقل (أرقام أو حروف)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمتا السر مش متطابقتين');
      return;
    }

    setSavingPassword(true);
    try {
      await api.patch('/auth/me/password', { currentPassword, newPassword });
      await logout();
    } catch (error) {
      setPasswordError(error instanceof ApiError ? error.message : 'حصل خطأ، حاول تاني');
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-black text-midnight-900 dark:text-ivory-50">بياناتي</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editable details */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_ENTRANCE }}
          className="rounded-2xl border border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900 p-6 shadow-card"
          aria-labelledby="personal-heading"
        >
          <h2
            id="personal-heading"
            className="font-display text-base font-extrabold text-midnight-900 dark:text-ivory-50"
          >
            البيانات الشخصية
          </h2>

          <form onSubmit={saveProfile} noValidate className="mt-5 space-y-4">
            <Field
              label="الاسم الكامل"
              name="fullName"
              defaultValue={user.fullName}
              autoComplete="name"
              required
            />
            <Field
              label="رقم ولي الأمر"
              name="parentPhone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              defaultValue={user.parentPhone}
              required
            />

            {profileError && (
              <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300">
                {profileError}
              </p>
            )}
            {profileMessage && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
              >
                {profileMessage}
              </motion.p>
            )}

            <Button type="submit" variant="accent" isLoading={savingProfile}>
              احفظ التعديلات
            </Button>
          </form>
        </motion.section>

        {/* Read-only account facts */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.45, ease: EASE_ENTRANCE }}
          className="rounded-2xl border border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900 p-6 shadow-card"
          aria-labelledby="account-heading"
        >
          <h2
            id="account-heading"
            className="font-display text-base font-extrabold text-midnight-900 dark:text-ivory-50"
          >
            بيانات الحساب
          </h2>

          <dl className="mt-5 space-y-4 text-sm">
            <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 px-4 py-3">
              <dt className="text-xs font-semibold text-midnight-500 dark:text-ivory-300/70">وقت المذاكرة</dt>
              <dd className="mt-1 font-display text-xl font-black text-gold-700 dark:text-gold-300" aria-live="polite">
                {studySummaryLoading ? 'جاري الحساب…' : formatDurationLabel(studySummary?.totalWatchedSeconds ?? 0)}
              </dd>
              <p className="mt-1 text-xs leading-5 text-midnight-500 dark:text-ivory-300/60">محسوب حسب أبعد نقطة وصلت لها في كل فيديو، من غير تكرار.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4 py-3">
              <div>
                <dt className="text-xs font-semibold text-midnight-500 dark:text-ivory-300/70">إجمالي نقاطك</dt>
                <dd className="mt-1 font-display text-xl font-black text-gold-700 dark:text-gold-300" aria-live="polite">{leaderboardLoading ? '…' : (leaderboard?.currentStudent?.totalPoints ?? 0).toLocaleString('ar-EG')}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-midnight-500 dark:text-ivory-300/70">ترتيبك في الصف</dt>
                <dd className="mt-1 font-display text-xl font-black text-midnight-900 dark:text-ivory-50">{leaderboardLoading ? '…' : leaderboard?.currentStudent ? `#${leaderboard.currentStudent.rank.toLocaleString('ar-EG')}` : '—'}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-semibold text-midnight-400 dark:text-ivory-300/60">اسم المستخدم</dt>
              <dd className="mt-0.5 font-bold text-midnight-800 dark:text-ivory-100" dir="ltr">
                {user.username}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-midnight-400 dark:text-ivory-300/60">رقم موبايلك</dt>
              <dd className="mt-0.5 font-bold text-midnight-800 dark:text-ivory-100" dir="ltr">
                {user.phone}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-midnight-400 dark:text-ivory-300/60">النظام التعليمي</dt>
              <dd className="mt-0.5 font-bold text-midnight-800 dark:text-ivory-100">
                {user.educationSystem === 'BACC' ? 'البكالوريا المصرية' : 'الثانوية العامة'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-midnight-400 dark:text-ivory-300/60">الصف الدراسي</dt>
              <dd className="mt-0.5 font-bold text-midnight-800 dark:text-ivory-100">
                {user.gradeLevel ? GRADE_LABELS[user.gradeLevel] : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-midnight-400 dark:text-ivory-300/60">تاريخ التسجيل</dt>
              <dd className="mt-0.5 font-bold text-midnight-800 dark:text-ivory-100">
                {formatDate(user.createdAt)}
              </dd>
            </div>
          </dl>

          <p className="mt-5 rounded-lg bg-ivory-100 dark:bg-midnight-950 px-3 py-2.5 text-xs leading-relaxed text-midnight-500 dark:text-ivory-300/70">
            لتغيير الصف الدراسي أو رقم موبايلك، تواصل مع الدعم. التغيير بيتسجّل
            لحماية اشتراكك.
          </p>
        </motion.section>
      </div>

      <AchievementsLibrary />

      {/* Password change */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.45, ease: EASE_ENTRANCE }}
        className="rounded-2xl border border-ivory-300 dark:border-midnight-700 bg-white dark:bg-midnight-900 p-6 shadow-card"
        aria-labelledby="password-heading"
      >
        <h2
          id="password-heading"
          className="font-display text-base font-extrabold text-midnight-900 dark:text-ivory-50"
        >
          تغيير كلمة السر
        </h2>
        <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/70">
          بعد تغيير كلمة السر هيتم تسجيل خروجك من كل الأجهزة.
        </p>

        <form onSubmit={changePassword} noValidate className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field
            label="كلمة السر الحالية"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
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

          {passwordError && (
            <p
              role="alert"
              className="sm:col-span-3 rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
            >
              {passwordError}
            </p>
          )}

          <div className="sm:col-span-3">
            <Button type="submit" variant="primary" isLoading={savingPassword}>
              غيّر كلمة السر
            </Button>
          </div>
        </form>
      </motion.section>

      {/* Sign out */}
      <div className="flex justify-start">
        <Button variant="ghost" onClick={() => void logout()}>
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
