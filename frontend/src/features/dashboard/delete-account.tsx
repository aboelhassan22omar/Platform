'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useAuth } from '@/components/providers/auth-provider';
import { api, ApiError } from '@/lib/api';
import { isNativeApp } from '@/lib/native-app';
import { clearOffline, offlineAvailable } from '@/features/app/offline-library';
import { disableNativePush } from '@/features/app/native-push';

/**
 * A student deleting their own account, from the site or the store apps
 * (both stores require it to be possible inside the app). The password is
 * asked again, and the consequences are spelled out before the button.
 */
export function DeleteAccount({ standalone = false }: { standalone?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(standalone);
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.isStaff) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    if (!password) {
      setError('اكتب كلمة السر عشان تأكد الحذف');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/me/delete', { password });
      // The phone keeps nothing of a deleted account: saved lessons, push token.
      if (isNativeApp()) {
        if (offlineAvailable()) await clearOffline().catch(() => undefined);
        await disableNativePush().catch(() => undefined);
      }
      // The session cookies are already cleared; a full load drops all cached data.
      window.location.replace('/delete-account?done=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حصل خطأ، حاول تاني بعد شوية');
      setPending(false);
    }
  };

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="rounded-2xl border border-red-500/25 bg-white p-6 shadow-card dark:bg-midnight-900"
    >
      <h2
        id="delete-account-heading"
        className="font-display text-base font-extrabold text-midnight-900 dark:text-ivory-50"
      >
        حذف الحساب
      </h2>
      <p className="mt-1 text-xs leading-6 text-midnight-500 dark:text-ivory-300/70">
        تقدر تحذف حسابك نهائيًا في أي وقت من هنا.
      </p>

      {!open ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-red-500/40 text-red-700 hover:border-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
          onClick={() => setOpen(true)}
        >
          حذف حسابي
        </Button>
      ) : (
        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <div className="rounded-xl border border-red-500/25 bg-red-50 p-4 text-sm leading-7 text-red-900 dark:bg-red-950/30 dark:text-red-100">
            <p className="font-bold">قبل ما تحذف، خلي بالك:</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5">
              <li>الحذف نهائي ومفيش طريقة نرجّع بيها الحساب.</li>
              <li>هتخسر وصولك لكل الحصص والامتحانات والاشتراكات، وأي رصيد في حسابك.</li>
              <li>اسمك ورقم موبايلك ورقم ولي أمرك وأجهزتك وإشعاراتك هيتمسحوا على طول.</li>
              <li>
                سجل المدفوعات بيفضل محفوظ من غير بياناتك الشخصية، لأن القانون بيلزمنا نحتفظ بيه.
              </li>
            </ul>
          </div>

          <Field
            label="كلمة السر"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="max-w-sm"
          />

          <label className="flex items-start gap-2 text-sm text-midnight-800 dark:text-ivory-200">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="mt-1 h-4 w-4 accent-red-600"
            />
            <span>فاهم إن حسابي هيتحذف نهائيًا.</span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" isLoading={pending} disabled={!understood}>
              احذف حسابي نهائيًا
            </Button>
            {!standalone && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                إلغاء
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
