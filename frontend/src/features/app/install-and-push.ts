'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Chrome / Edge / Android fire this when the site can be installed. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

/** Registers the service worker once and keeps the install prompt for later. */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    promptListeners.forEach((listener) => listener());
  });
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIos = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Whether and how the platform can be installed on this device. */
export function useInstall() {
  const [state, setState] = useState<{ installed: boolean; canPrompt: boolean; ios: boolean }>({
    installed: false,
    canPrompt: false,
    ios: false,
  });
  useEffect(() => {
    const update = () =>
      setState({ installed: isStandalone(), canPrompt: Boolean(deferredPrompt), ios: isIos() });
    update();
    promptListeners.add(update);
    return () => {
      promptListeners.delete(update);
    };
  }, []);
  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    promptListeners.forEach((listener) => listener());
    return choice.outcome === 'accepted';
  }, []);
  return { ...state, install };
}

const base64ToBytes = (value: string) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

/** Phone notifications on this device: current state, turn on, turn off. */
export function usePush() {
  const [state, setState] = useState<PushState>('off');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    setState(subscription ? 'on' : 'off');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      const { publicKey } = await api.get<{ publicKey: string }>('/push/public-key');
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToBytes(publicKey),
        }));
      await api.post('/push/subscriptions', subscription.toJSON());
      setState('on');
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/push/subscriptions', { body: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
