'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ButtonLink } from '@/components/ui/button';
import type { LiveSessionSummary } from '@/types/api';
import { CountdownDisplay, formatLiveDate, useCountdown } from './countdown';

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
  );
}

function PrimaryLive({ session }: { session: LiveSessionSummary }) {
  const countdown = useCountdown(session.status === 'SCHEDULED' ? session.scheduledAt : null);
  const isLive = session.status === 'LIVE';
  const dueNow = !isLive && countdown?.done;

  return (
    <section
      aria-labelledby={`live-${session.id}`}
      className={
        isLive
          ? 'relative overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-l from-red-500/10 via-transparent to-transparent p-5 sm:p-6'
          : 'relative overflow-hidden rounded-2xl border border-gold-500/30 bg-white p-5 shadow-card dark:bg-midnight-950/80 sm:p-6'
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black">
            {isLive ? (
              <>
                <LiveDot />
                <span className="text-red-600 dark:text-red-400">مباشر دلوقتي</span>
              </>
            ) : (
              <span className="rounded-md bg-gold-500/15 px-2 py-0.5 text-gold-700 dark:text-gold-300">
                لايف جاي · {session.grade.shortNameAr}
              </span>
            )}
          </p>
          <h2
            id={`live-${session.id}`}
            className="mt-2 font-display text-lg font-black text-midnight-950 dark:text-ivory-50 sm:text-xl"
          >
            {session.title}
          </h2>
          <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/75">
            {isLive ? 'المستر على الهوا دلوقتي، ادخل حالاً.' : formatLiveDate(session.scheduledAt)}
          </p>
          {session.description && !isLive && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-midnight-700 dark:text-ivory-200/80">
              {session.description}
            </p>
          )}
        </div>

        <div className="shrink-0 lg:min-w-[19rem]">
          {isLive ? (
            <ButtonLink href={`/live/${session.id}`} variant="danger" size="lg" fullWidth>
              ادخل اللايف
            </ButtonLink>
          ) : dueNow ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-midnight-800 dark:text-ivory-100">
                المستر هيبدأ خلال لحظات
              </p>
              <ButtonLink href={`/live/${session.id}`} variant="accent" size="md" fullWidth>
                استنى في غرفة اللايف
              </ButtonLink>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs font-bold text-midnight-500 dark:text-ivory-300/70">باقي على اللايف</p>
              <CountdownDisplay parts={countdown} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The student's live classes, shown at the top of every dashboard page. It
 * polls so a class the teacher starts appears without a refresh.
 */
export function LiveBanner() {
  const { data } = useQuery({
    queryKey: ['live-upcoming'],
    queryFn: () => api.get<LiveSessionSummary[]>('/live/upcoming'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (!data?.length) return null;
  const [first, ...rest] = data;

  return (
    <div className="mb-8 space-y-3">
      <PrimaryLive session={first} />
      {rest.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rest.slice(0, 4).map((session) => (
            <li key={session.id}>
              <Link
                href={`/live/${session.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gold-500/20 bg-white px-4 py-3 text-sm transition-colors hover:border-gold-500/40 dark:bg-midnight-950/80"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-midnight-900 dark:text-ivory-100">{session.title}</span>
                  <span className="block text-xs text-midnight-500 dark:text-ivory-300/70">
                    {session.status === 'LIVE' ? 'مباشر دلوقتي' : formatLiveDate(session.scheduledAt)}
                  </span>
                </span>
                {session.status === 'LIVE' && <LiveDot />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
