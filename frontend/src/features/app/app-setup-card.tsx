'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNativeApp } from '@/lib/native-app';
import { usePush, useInstall } from './install-and-push';

const DISMISS_KEY = 'app-setup-dismissed';

/**
 * "Install the app and turn on notifications". On the dashboard it appears
 * only while something is left to do and can be dismissed; on the profile
 * page (`compact={false}`) it always shows the current state.
 */
export function AppSetupCard({ dismissible = false }: { dismissible?: boolean }) {
  const install = useInstall();
  const push = usePush();
  const native = useNativeApp();
  const [dismissed, setDismissed] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(dismissible && localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, [dismissible]);

  const pushOn = push.state === 'on';
  // An app build without push (Android before Firebase is set up) has nothing to offer here.
  if (native && push.state === 'unsupported') return null;
  const done = install.installed && (pushOn || push.state === 'unsupported');
  if (dismissible && (dismissed || done)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private browsing: it simply shows again next time.
    }
  };

  const button =
    'min-h-11 rounded-xl px-4 text-sm font-black transition-colors disabled:opacity-50';

  return (
    <section
      aria-labelledby="app-setup-heading"
      className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-l from-gold-500/10 to-transparent p-5 dark:from-gold-500/15"
    >
      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="إخفاء"
          className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-lg text-midnight-500 hover:bg-midnight-500/10 dark:text-ivory-300/70"
        >
          ×
        </button>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="rounded-2xl shadow"
        />
        <div className="min-w-0 flex-1">
          <h2
            id="app-setup-heading"
            className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50"
          >
            {native ? 'إشعارات التطبيق' : 'المنصة على موبايلك'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-midnight-600 dark:text-ivory-300/75">
            {native
              ? 'فعّل الإشعارات عشان يوصلك أول ما المستر يرد، أو حصة جديدة تنزل، أو اللايف يبدأ.'
              : 'ثبّتها زي أي تطبيق بأيقونة على الشاشة، وفعّل الإشعارات عشان يوصلك أول ما المستر يرد، أو حصة جديدة تنزل، أو اللايف يبدأ.'}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {native ? null : install.installed ? (
              <span className="inline-flex min-h-11 items-center rounded-xl bg-emerald-500/10 px-4 text-sm font-black text-emerald-700 dark:text-emerald-300">
                ✓ متثبّتة
              </span>
            ) : install.canPrompt ? (
              <button
                type="button"
                onClick={() => void install.install()}
                className={cn(button, 'bg-gold-500 text-midnight-950 hover:bg-gold-400')}
              >
                ثبّت التطبيق
              </button>
            ) : install.ios ? (
              <button
                type="button"
                onClick={() => setShowIosHelp((value) => !value)}
                className={cn(button, 'bg-gold-500 text-midnight-950 hover:bg-gold-400')}
              >
                إزاي أثبّتها على الآيفون؟
              </button>
            ) : null}

            {push.state === 'on' ? (
              <button
                type="button"
                onClick={() => void push.disable()}
                disabled={push.busy}
                className={cn(
                  button,
                  'border border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                )}
              >
                ✓ الإشعارات شغّالة (اقفلها)
              </button>
            ) : push.state === 'off' ? (
              <button
                type="button"
                onClick={() =>
                  void push
                    .enable()
                    .then((ok) => setMessage(ok ? 'تمام! هيوصلك إشعار على الجهاز ده.' : null))
                }
                disabled={push.busy}
                className={cn(
                  button,
                  'border border-gold-500/50 text-gold-800 hover:bg-gold-500/10 dark:text-gold-300',
                )}
              >
                {push.busy ? 'لحظة…' : 'فعّل الإشعارات'}
              </button>
            ) : push.state === 'denied' ? (
              <span className="inline-flex min-h-11 items-center rounded-xl bg-amber-500/10 px-4 text-xs font-bold text-amber-800 dark:text-amber-300">
                {native
                  ? 'الإشعارات مقفولة من إعدادات الموبايل. افتح الإعدادات ثم التطبيقات ثم «عمرو محروس» وشغّل الإشعارات.'
                  : 'الإشعارات مقفولة من إعدادات المتصفح. افتحها من علامة القفل جنب العنوان.'}
              </span>
            ) : install.ios && !install.installed ? (
              <span className="inline-flex min-h-11 items-center text-xs font-bold text-midnight-500 dark:text-ivory-300/65">
                على الآيفون الإشعارات بتشتغل بعد ما تثبّت التطبيق.
              </span>
            ) : null}
          </div>

          {showIosHelp && (
            <ol className="mt-3 list-decimal space-y-1 ps-5 text-sm text-midnight-700 dark:text-ivory-200">
              <li>افتح المنصة من Safari.</li>
              <li>دوس على زرار المشاركة (المربع اللي فيه سهم لفوق).</li>
              <li>اختار «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</li>
              <li>افتح التطبيق من الأيقونة الجديدة، وفعّل الإشعارات من هنا.</li>
            </ol>
          )}
          {message && (
            <p
              role="status"
              className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-400"
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
