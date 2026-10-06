'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from './auth-provider';

const HEARTBEAT_SECONDS = Number(process.env.NEXT_PUBLIC_PRESENCE_HEARTBEAT_SECONDS ?? 45);

/**
 * Sends an authenticated heartbeat so the admin dashboard can report who is
 * online. Renders nothing.
 *
 * Deliberately conservative:
 *   - only runs for a signed-in user
 *   - pauses while the tab is hidden, so a forgotten background tab does not
 *     inflate the "online now" number
 *   - sends one beat immediately on becoming visible, then on an interval
 *
 * The count this feeds is an approximation of activity, not proof that anyone
 * is watching — the dashboard says so next to the number.
 */
export function PresenceReporter() {
  const { user } = useAuth();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const beat = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      void api.post('/presence/heartbeat', { route: pathRef.current }).catch(() => {
        // A missed heartbeat is not worth surfacing to the student.
      });
    };

    beat();
    const timer = window.setInterval(beat, HEARTBEAT_SECONDS * 1000);
    document.addEventListener('visibilitychange', beat);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [user]);

  return null;
}
