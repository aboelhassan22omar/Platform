'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LiveKitRoom } from '@livekit/components-react';
import { api, ApiError } from '@/lib/api';
import { Button, ButtonLink } from '@/components/ui/button';
import type { LiveSessionDetail } from '@/types/api';
import { CountdownDisplay, formatLiveDate, useCountdown } from './countdown';
import { LiveStage } from './live-stage';

interface Ticket {
  url: string;
  token: string;
  isHost: boolean;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-[#fcfaf4] px-4 py-10 dark:bg-[#030712]">
      <div className="w-full max-w-xl rounded-3xl border border-gold-500/30 bg-white p-6 text-center shadow-card dark:bg-midnight-950/80 sm:p-8">
        {children}
      </div>
    </div>
  );
}

function WaitingRoom({
  session,
  onStarted,
}: {
  session: LiveSessionDetail;
  onStarted: () => void;
}) {
  const countdown = useCountdown(session.scheduledAt);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await api.post(`/admin/live/${session.id}/start`);
      onStarted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'مقدرناش نبدأ اللايف، حاول تاني');
      setStarting(false);
    }
  };

  return (
    <Panel>
      <span className="inline-block rounded-md bg-gold-500/15 px-2.5 py-1 text-xs font-black text-gold-700 dark:text-gold-300">
        {session.grade.shortNameAr}
      </span>
      <h1 className="mt-3 font-display text-2xl font-black text-midnight-950 dark:text-ivory-50 sm:text-3xl">
        {session.title}
      </h1>
      <p className="mt-2 text-sm text-midnight-600 dark:text-ivory-300/75">
        {formatLiveDate(session.scheduledAt)}
      </p>
      {session.description && (
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-midnight-700 dark:text-ivory-200/80">
          {session.description}
        </p>
      )}

      <div className="mt-6">
        {countdown?.done ? (
          <p className="rounded-2xl border border-gold-500/25 px-4 py-5 font-display text-lg font-black text-midnight-900 dark:text-ivory-100">
            {session.isHost ? 'ميعاد اللايف جه' : 'المستر هيبدأ خلال لحظات…'}
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs font-bold text-midnight-500 dark:text-ivory-300/70">
              باقي على اللايف
            </p>
            <CountdownDisplay parts={countdown} size="lg" />
          </>
        )}
      </div>

      {session.isHost ? (
        <div className="mt-6 space-y-3">
          {!session.streamingReady && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300">
              البث لسه مش متفعّل: لازم مفاتيح LiveKit تتحط في إعدادات السيرفر الأول.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm font-bold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <Button
            variant="danger"
            size="lg"
            fullWidth
            isLoading={starting}
            disabled={!session.streamingReady}
            onClick={() => void start()}
          >
            ابدأ اللايف دلوقتي
          </Button>
          {session.recordingEnabled && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2.5 text-sm font-bold text-red-700 dark:text-red-300">
              اللايف ده هيتسجّل، والتسجيل هيظهر لك في لوحة التحكم بعد ما يخلص.
            </p>
          )}
          <p className="text-xs text-midnight-500 dark:text-ivory-300/70">
            المتصفح هيطلب إذن الكاميرا والمايك. كل طلبة {session.grade.shortNameAr} هيوصلهم إشعار.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-midnight-600 dark:text-ivory-300/75">
          خليك على الصفحة دي، هتدخل اللايف لوحدها أول ما المستر يبدأ.
        </p>
      )}
    </Panel>
  );
}

function Ended({ session }: { session: LiveSessionDetail }) {
  return (
    <Panel>
      <h1 className="font-display text-2xl font-black text-midnight-950 dark:text-ivory-50">
        {session.status === 'CANCELLED' ? 'اللايف ده اتلغى' : 'اللايف خلص'}
      </h1>
      <p className="mt-2 text-sm text-midnight-600 dark:text-ivory-300/75">{session.title}</p>
      {session.isHost && session.endReason === 'HOST_LEFT' && (
        <p className="mt-3 text-sm text-midnight-600 dark:text-ivory-300/75">
          اتقفل لوحده لأنك خرجت من اللايف ومرجعتش.
        </p>
      )}
      {session.isHost && session.recordingEnabled && session.status === 'ENDED' && (
        <p className="mt-3 text-sm font-bold text-midnight-800 dark:text-ivory-100">
          التسجيل بيتجهز، وهتلاقيه في صفحة اللايفات في لوحة التحكم خلال دقايق.
        </p>
      )}
      <ButtonLink
        href={session.isHost ? '/admin/live' : '/dashboard'}
        variant="accent"
        className="mt-6"
      >
        {session.isHost ? 'رجوع للايفات' : 'رجوع لحسابي'}
      </ButtonLink>
    </Panel>
  );
}

function Connect({ session, onEnded }: { session: LiveSessionDetail; onEnded: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .post<Ticket>(`/live/${session.id}/token`)
      .then((result) => !cancelled && setTicket(result))
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 410) onEnded();
        else
          setError(
            caught instanceof ApiError ? caught.message : 'مقدرناش ندخلك اللايف، حدّث الصفحة',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, onEnded]);

  if (error) {
    return (
      <Panel>
        <p className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
          {error}
        </p>
        <Button variant="accent" className="mt-5" onClick={() => window.location.reload()}>
          حاول تاني
        </Button>
      </Panel>
    );
  }

  if (!ticket) {
    return (
      <Panel>
        <span
          className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-gold-500 border-t-transparent"
          aria-hidden
        />
        <p className="mt-4 text-sm font-bold text-midnight-700 dark:text-ivory-200">
          بندخّلك اللايف…
        </p>
      </Panel>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={ticket.url}
      token={ticket.token}
      connect
      audio={ticket.isHost}
      video={ticket.isHost}
      options={{ adaptiveStream: true, dynacast: true }}
      onDisconnected={() => {
        api
          .get<LiveSessionDetail>(`/live/${session.id}`)
          .then((current) => {
            if (current.status === 'ENDED' || current.status === 'CANCELLED') onEnded();
          })
          .catch((caught) => {
            if (caught instanceof ApiError && caught.status === 403) setError(caught.message);
          });
      }}
    >
      <LiveStage session={session} onEnded={onEnded} />
    </LiveKitRoom>
  );
}

export function LiveRoom({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [endedLocally, setEndedLocally] = useState(false);

  const {
    data: session,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['live', id],
    queryFn: () => api.get<LiveSessionDetail>(`/live/${id}`),
    // Waiting students poll so they drop into the room when the teacher starts.
    refetchInterval: (query) => (query.state.data?.status === 'SCHEDULED' ? 8_000 : false),
  });

  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ['live', id] }),
    [queryClient, id],
  );
  const markEnded = useCallback(() => {
    setEndedLocally(true);
    void queryClient.invalidateQueries({ queryKey: ['live-upcoming'] });
    void queryClient.invalidateQueries({ queryKey: ['live', id] });
  }, [queryClient, id]);

  if (isLoading) {
    return (
      <Panel>
        <div className="skeleton mx-auto h-8 w-2/3" />
        <div className="skeleton mx-auto mt-4 h-20 w-full" />
      </Panel>
    );
  }

  if (error || !session) {
    return (
      <Panel>
        <p className="font-display text-lg font-black text-midnight-950 dark:text-ivory-50">
          {error instanceof ApiError ? error.message : 'مقدرناش نفتح اللايف'}
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-bold text-gold-700 underline dark:text-gold-400"
        >
          رجوع لحسابي
        </Link>
      </Panel>
    );
  }

  if (endedLocally || session.status === 'ENDED' || session.status === 'CANCELLED') {
    return (
      <Ended
        session={{ ...session, status: session.status === 'CANCELLED' ? 'CANCELLED' : 'ENDED' }}
      />
    );
  }
  if (session.status === 'SCHEDULED') return <WaitingRoom session={session} onStarted={refresh} />;
  return <Connect session={session} onEnded={markEnded} />;
}
