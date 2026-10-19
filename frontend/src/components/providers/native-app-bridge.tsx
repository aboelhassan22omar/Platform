'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { isWebOnlyPath, nativePlugins, useNativeApp } from '@/lib/native-app';
import { listenForNativePush, refreshNativePush } from '@/features/app/native-push';
import { libraryUrl, offlineAvailable, syncOffline } from '@/features/app/offline-library';

/** The splash (logo and "Powered by Aurexis") stays at least this long. */
const MIN_SPLASH_MS = 1000;

/**
 * Everything the store apps need from the site, in one place. Renders
 * nothing on the web.
 */
export function NativeAppBridge() {
  const native = useNativeApp();
  return native ? <Bridge /> : null;
}

function Bridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [offline, setOffline] = useState(false);
  const synced = useRef<string | null>(null);

  // The splash comes down once the site has drawn, after at least a second.
  useEffect(() => {
    const wait = Math.max(0, MIN_SPLASH_MS - performance.now());
    const timer = window.setTimeout(() => {
      void nativePlugins()
        ?.SplashScreen?.hide({ fadeOutDuration: 300 })
        .catch(() => undefined);
    }, wait);
    return () => window.clearTimeout(timer);
  }, []);

  // Buying happens on the website: the app never shows a payment page.
  useEffect(() => {
    if (isWebOnlyPath(pathname)) router.replace(user ? '/dashboard' : '/');
  }, [pathname, router, user]);

  // Android back button: back through the pages, then leave the app.
  useEffect(() => {
    const app = nativePlugins()?.App;
    if (!app) return;
    const handle = app.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void app.minimizeApp();
    });
    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, []);

  // Tapping a notification opens its page.
  useEffect(() => {
    void listenForNativePush((url) => router.push(url));
  }, [router]);

  // Keep the push token fresh, and saved lessons in step with the account.
  useEffect(() => {
    if (isLoading || !user) return;
    void refreshNativePush().catch(() => undefined);
    if (offlineAvailable() && synced.current !== user.id && navigator.onLine) {
      synced.current = user.id;
      void syncOffline(user.id).catch(() => {
        synced.current = null;
      });
    }
  }, [user, isLoading]);

  // Status-bar text follows the site's light/dark theme.
  useEffect(() => {
    const bars = nativePlugins()?.SystemBars;
    if (!bars) return;
    const apply = () => {
      const dark = document.documentElement.classList.contains('dark');
      void bars.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => undefined);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Losing the connection mid-way: offer the downloads instead of a dead page.
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 z-[90] rounded-2xl border border-gold-500/40 bg-midnight-950/95 p-4 text-ivory-50 shadow-2xl backdrop-blur"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <p className="font-display text-base font-black">انت مش متصل بالإنترنت</p>
      <p className="mt-1 text-sm text-ivory-200/75">
        شوف الاتصال عندك، أو اتفرج على الحصص اللي نزّلتها في مكتبتك.
      </p>
      <div className="mt-3 flex gap-2">
        {offlineAvailable() && (
          <a
            href={libraryUrl()}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-gold-500 px-4 text-sm font-black text-midnight-950"
          >
            روح لمكتبتي
          </a>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-xl border border-ivory-50/25 px-4 text-sm font-bold"
        >
          حاول تاني
        </button>
      </div>
    </div>
  );
}
