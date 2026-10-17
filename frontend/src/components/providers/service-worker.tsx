'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/features/app/install-and-push';

/** Registers the app's service worker once per page load. */
export function ServiceWorker() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
