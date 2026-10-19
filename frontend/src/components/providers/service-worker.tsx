'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/features/app/install-and-push';
import { isNativeApp } from '@/lib/native-app';

/**
 * Registers the installable site's service worker once per page load. Not in
 * the store apps: they have native push and their own offline page.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!isNativeApp()) registerServiceWorker();
  }, []);
  return null;
}
