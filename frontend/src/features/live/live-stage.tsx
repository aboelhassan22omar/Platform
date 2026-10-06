'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Track } from 'livekit-client';
import {
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useAudioPlayback,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { api, ApiError } from '@/lib/api';
import { cn, toArabicDigits } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { LiveChatMessage, LiveEvent, LiveReactionEvent, LiveSessionDetail } from '@/types/api';

export const REACTIONS = ['👍', '❤️', '😂', '😮', '👏', '🔥'] as const;

const decoder = new TextDecoder();

interface FloatingReaction {
  key: string;
  emoji: string;
  name: string;
  left: number;
}

function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!startedAt || now === null) return '';
  const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return toArabicDigits(h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
}

// ---------------------------------------------------------------------------
// Icons (control bar)
// ---------------------------------------------------------------------------

const ICONS = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
  micOff:
    'M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.2 5.6M19 11a7 7 0 0 1-.6 2.8M12 18v3',
  cam: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h10A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 16.5v-9ZM16 10.5l5-3v9l-5-3',
  camOff:
    'M3 3l18 18M16 10.5l5-3v9l-5-3M14.5 18h-10A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6H6m3.5 0h5A1.5 1.5 0 0 1 16 7.5v5',
  screen: 'M3 5h18v11H3zM8 20h8M12 16v4M9.5 10.5 12 8l2.5 2.5M12 8v5',
  chat: 'M4 19l1.5-3.9A7.5 7.5 0 1 1 8.5 18L4 19Z',
  chatOff:
    'M3 3l18 18M4 19l1.5-3.9a7.5 7.5 0 0 1 1.2-8.8M10 4.6A7.5 7.5 0 0 1 19.4 14M15.5 17.7A7.5 7.5 0 0 1 8.5 18L4 19',
  leave: 'M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14M10 8l-4 4 4 4M6 12h9',
  users:
    'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.15a3 3 0 0 1 0 5.7',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  send: 'M20 12 4 4l3 8-3 8 16-8ZM7 12h6',
  volume: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
} as const;

function Glyph({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5', className)}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function ControlButton({
  label,
  icon,
  active = false,
  danger = false,
  off = false,
  onClick,
  disabled,
  expanded,
}: {
  label: string;
  icon: string;
  active?: boolean;
  danger?: boolean;
  off?: boolean;
  onClick: () => void;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active || undefined}
      aria-expanded={expanded}
      className={cn(
        'flex min-w-[4.25rem] flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-colors disabled:opacity-50',
        danger
          ? 'bg-red-600 text-white hover:bg-red-500'
          : off
            ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
            : active
              ? 'bg-white/15 text-white'
              : 'text-white/80 hover:bg-white/10 hover:text-white',
      )}
    >
      <Glyph d={icon} />
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

export function LiveStage({
  session,
  onEnded,
}: {
  session: LiveSessionDetail;
  onEnded: () => void;
}) {
  const router = useRouter();
  const room = useRoomContext();
  const connection = useConnectionState();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const { canPlayAudio, startAudio } = useAudioPlayback(room);
  const isHost = session.isHost;
  const elapsed = useElapsed(session.startedAt);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  ).filter(isTrackReference);
  const screen = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const camera = tracks.find((t) => t.source === Track.Source.Camera);
  const main = screen ?? camera;
  const pip = screen ? camera : undefined;

  const viewers = participants.filter((p) => {
    try {
      return !JSON.parse(p.metadata || '{}').host;
    } catch {
      return true;
    }
  }).length;

  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatEnabled, setChatEnabled] = useState(session.chatEnabled);
  const [recordingActive, setRecordingActive] = useState(session.recording);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<'chat' | 'reactions'>('chat');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [feed, setFeed] = useState<LiveReactionEvent[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [reactOpen, setReactOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const listRef = useRef<HTMLDivElement>(null);

  // History for latecomers; the teacher also loads who has reacted so far.
  useEffect(() => {
    api
      .get<LiveChatMessage[]>(`/live/${session.id}/chat`)
      .then((rows) => {
        rows.forEach((row) => seen.current.add(row.id));
        setMessages(rows);
      })
      .catch(() => {});
    if (isHost) {
      api
        .get<{ totals: Array<{ emoji: string; count: number }>; recent: LiveReactionEvent[] }>(
          `/admin/live/${session.id}/reactions`,
        )
        .then((data) => {
          data.recent.forEach((row) => seen.current.add(row.id));
          setFeed(data.recent);
          setTotals(Object.fromEntries(data.totals.map((t) => [t.emoji, t.count])));
        })
        .catch(() => {});
    }
  }, [session.id, isHost]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, tab, panelOpen]);

  const addMessage = useCallback((message: LiveChatMessage) => {
    if (seen.current.has(message.id)) return;
    seen.current.add(message.id);
    setMessages((current) => [...current.slice(-299), message]);
  }, []);

  const addReaction = useCallback((reaction: LiveReactionEvent) => {
    if (seen.current.has(reaction.id)) return;
    seen.current.add(reaction.id);
    const key = reaction.id;
    setFloating((current) => [
      ...current.slice(-24),
      { key, emoji: reaction.emoji, name: reaction.name, left: 8 + Math.random() * 30 },
    ]);
    window.setTimeout(() => setFloating((current) => current.filter((f) => f.key !== key)), 3200);
    setFeed((current) => [reaction, ...current].slice(0, 300));
    setTotals((current) => ({ ...current, [reaction.emoji]: (current[reaction.emoji] ?? 0) + 1 }));
  }, []);

  useDataChannel('live', (msg) => {
    let event: LiveEvent;
    try {
      event = JSON.parse(decoder.decode(msg.payload)) as LiveEvent;
    } catch {
      return;
    }
    if (event.type === 'chat') addMessage(event.message);
    else if (event.type === 'chat-state') setChatEnabled(event.enabled);
    else if (event.type === 'reaction') addReaction(event.reaction);
    else if (event.type === 'recording') setRecordingActive(event.active);
    else if (event.type === 'ended') onEnded();
  });

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setChatError(null);
    try {
      const message = await api.post<LiveChatMessage>(`/live/${session.id}/chat`, { body });
      addMessage(message);
      setDraft('');
    } catch (caught) {
      setChatError(caught instanceof ApiError ? caught.message : 'الرسالة موصلتش، حاول تاني');
    } finally {
      setSending(false);
    }
  };

  const sendReaction = async (emoji: string) => {
    setReactOpen(false);
    try {
      const { id } = await api.post<{ id: string }>(`/live/${session.id}/reactions`, { emoji });
      // Normally the broadcast lands first; this covers a missed packet.
      window.setTimeout(() => {
        if (!seen.current.has(id)) {
          addReaction({
            id,
            emoji,
            userId: localParticipant.identity,
            name: localParticipant.name ?? '',
            createdAt: new Date().toISOString(),
          });
        }
      }, 1500);
    } catch {
      // Rate-limited or the class just ended: nothing useful to tell the student.
    }
  };

  const toggleChat = async () => {
    const next = !chatEnabled;
    setChatEnabled(next);
    try {
      await api.patch(`/admin/live/${session.id}/chat`, { enabled: next });
    } catch {
      setChatEnabled(!next);
    }
  };

  const toggleMedia = async (kind: 'mic' | 'camera' | 'screen') => {
    setMediaError(null);
    try {
      if (kind === 'mic') await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      if (kind === 'camera') await localParticipant.setCameraEnabled(!isCameraEnabled);
      if (kind === 'screen')
        await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: true });
    } catch (caught) {
      const name = (caught as Error)?.name;
      setMediaError(
        name === 'NotAllowedError'
          ? 'المتصفح رافض الإذن. اسمح بالكاميرا والمايك من علامة القفل جنب العنوان.'
          : 'مقدرناش نشغّل الجهاز ده، اتأكد إنه متوصل ومش مستخدم في برنامج تاني.',
      );
    }
  };

  const endLive = async () => {
    setEnding(true);
    setMediaError(null);
    try {
      await api.post(`/admin/live/${session.id}/end`);
    } catch (caught) {
      setMediaError(caught instanceof ApiError ? caught.message : 'مقدرناش ننهي اللايف، حاول تاني');
      setEnding(false);
      setConfirmEnd(false);
      return;
    }
    await room.disconnect();
    onEnded();
  };

  const leave = async () => {
    await room.disconnect();
    router.push(isHost ? '/admin/live' : '/dashboard');
  };

  const sortedTotals = useMemo(
    () => REACTIONS.map((emoji) => ({ emoji, count: totals[emoji] ?? 0 })),
    [totals],
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-[#0b0f14] text-white" dir="rtl">
      <RoomAudioRenderer />

      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-black">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
            مباشر
          </span>
          <h1 className="truncate font-display text-sm font-bold sm:text-base">{session.title}</h1>
          {elapsed && (
            <span
              dir="ltr"
              className="nums-tabular hidden shrink-0 text-xs text-white/60 sm:inline"
            >
              {elapsed}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-white/70">
          {isHost && (
            <Link
              href={`/admin/live/${session.id}/participants`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center rounded-xl bg-white/10 px-3 font-bold hover:bg-white/20"
            >
              الحاضرين ({toArabicDigits(String(viewers))} طالب)
            </Link>
          )}
          {isHost && session.recordingEnabled && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-black',
                recordingActive
                  ? 'border-red-500/50 text-red-300'
                  : 'border-white/15 text-white/60',
              )}
              role="status"
            >
              <span
                aria-hidden
                className={cn(
                  'h-2 w-2 rounded-full',
                  recordingActive ? 'animate-pulse bg-red-500' : 'bg-white/40',
                )}
              />
              {recordingActive ? 'بيسجّل' : 'التسجيل هيبدأ مع الكاميرا أو المايك'}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5" title="عدد الطلبة المتصلين">
            <Glyph d={ICONS.users} className="h-4 w-4" />
            <span className="nums-tabular">{toArabicDigits(String(viewers))}</span>
            <span className="sr-only">طالب متصل</span>
          </span>
        </div>
      </header>

      {connection === ConnectionState.Reconnecting && (
        <p
          className="bg-amber-500/20 px-4 py-1.5 text-center text-xs font-bold text-amber-200"
          role="status"
        >
          الاتصال بيتقطع، بنحاول نرجّعه…
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stage */}
        <div className="relative min-h-0 flex-1 p-2 sm:p-3">
          <div className="relative h-full min-h-[14rem] overflow-hidden rounded-2xl bg-black">
            {main ? (
              <VideoTrack
                trackRef={main}
                className={cn(
                  'h-full w-full object-contain',
                  isHost && main.source === Track.Source.Camera && '-scale-x-100',
                )}
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10 font-display text-2xl font-black">
                    {isHost ? 'أنت' : 'م'}
                  </span>
                  <p className="mt-4 text-sm text-white/70">
                    {isHost
                      ? 'الكاميرا مقفولة. شغّلها أو اعرض الشاشة من الأزرار تحت.'
                      : 'المستر لسه مشغّلش الكاميرا… الصوت شغال عادي.'}
                  </p>
                </div>
              </div>
            )}

            {pip && (
              <div className="absolute bottom-3 left-3 aspect-video w-32 overflow-hidden rounded-xl border border-white/20 bg-black shadow-xl sm:w-44">
                <VideoTrack
                  trackRef={pip}
                  className={cn('h-full w-full object-cover', isHost && '-scale-x-100')}
                />
              </div>
            )}

            {/* Floating reactions: names are shown to the teacher only. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <AnimatePresence>
                {floating.map((item) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 0, scale: 0.6 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -260, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 3, ease: 'easeOut' }}
                    className="absolute bottom-6 flex items-center gap-1.5"
                    style={{ right: `${item.left}%` }}
                  >
                    <span className="text-3xl drop-shadow">{item.emoji}</span>
                    {isHost && item.name && (
                      <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold">
                        {item.name}
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {!isHost && !canPlayAudio && (
              <button
                type="button"
                onClick={() => void startAudio()}
                className="absolute inset-x-0 top-4 mx-auto flex w-fit items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-sm font-black text-midnight-950 shadow-lg"
              >
                <Glyph d={ICONS.volume} />
                اضغط عشان تسمع الصوت
              </button>
            )}

            {mediaError && (
              <p
                className="absolute inset-x-3 top-3 rounded-xl bg-red-600/90 px-3 py-2 text-center text-xs font-bold"
                role="alert"
              >
                {mediaError}
              </p>
            )}
          </div>
        </div>

        {/* Side panel */}
        {panelOpen && (
          <aside
            className="flex h-[42%] min-h-0 flex-col border-t border-white/10 bg-[#0f141b] lg:h-auto lg:w-[22rem] lg:border-s lg:border-t-0"
            aria-label="الشات والتفاعل"
          >
            {isHost && (
              <div className="flex border-b border-white/10 text-sm font-bold" role="tablist">
                {(['chat', 'reactions'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'flex-1 border-b-2 px-3 py-2.5 transition-colors',
                      tab === key
                        ? 'border-gold-400 text-white'
                        : 'border-transparent text-white/60 hover:text-white',
                    )}
                  >
                    {key === 'chat' ? 'الشات' : 'الرياكشنز'}
                  </button>
                ))}
              </div>
            )}

            {tab === 'reactions' && isHost ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="grid grid-cols-6 gap-1 border-b border-white/10 p-3">
                  {sortedTotals.map(({ emoji, count }) => (
                    <div key={emoji} className="rounded-lg bg-white/5 py-1.5 text-center">
                      <span className="block text-lg">{emoji}</span>
                      <span className="nums-tabular text-[11px] font-bold text-white/70">
                        {toArabicDigits(String(count))}
                      </span>
                    </div>
                  ))}
                </div>
                <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto px-3">
                  {feed.length === 0 && (
                    <li className="py-6 text-center text-xs text-white/50">لسه محدش عمل رياكت</li>
                  )}
                  {feed.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="text-xl">{item.emoji}</span>
                      <span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
                      <span className="nums-tabular text-[11px] text-white/50">
                        {new Date(item.createdAt).toLocaleTimeString('ar-EG', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {!isHost && (
                  <p className="border-b border-white/10 px-4 py-2.5 text-sm font-bold">الشات</p>
                )}
                <div
                  ref={listRef}
                  className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
                  aria-live="polite"
                >
                  {messages.length === 0 && (
                    <p className="py-6 text-center text-xs text-white/50">
                      مفيش رسايل لسه. ابدأ إنت!
                    </p>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'rounded-xl px-3 py-2 text-sm leading-relaxed',
                        message.user.isHost
                          ? 'border border-gold-500/40 bg-gold-500/10'
                          : 'bg-white/5',
                      )}
                    >
                      <p
                        className={cn(
                          'text-[11px] font-black',
                          message.user.isHost ? 'text-gold-300' : 'text-white/60',
                        )}
                      >
                        {message.user.name}
                        {message.user.isHost && ' · المستر'}
                      </p>
                      <p className="mt-0.5 break-words text-white/90">{message.body}</p>
                    </div>
                  ))}
                </div>

                {!chatEnabled && (
                  <p className="border-t border-white/10 px-4 py-2 text-center text-xs font-bold text-amber-300">
                    {isHost
                      ? 'الشات مقفول للطلبة، إنت بس اللي تقدر تكتب'
                      : 'المستر قفل الشات دلوقتي'}
                  </p>
                )}
                {chatError && (
                  <p className="px-4 pt-2 text-xs font-bold text-red-300" role="alert">
                    {chatError}
                  </p>
                )}

                <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/10 p-3">
                  <label htmlFor="live-chat-input" className="sr-only">
                    اكتب رسالة
                  </label>
                  <input
                    id="live-chat-input"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={500}
                    disabled={!chatEnabled && !isHost}
                    placeholder={!chatEnabled && !isHost ? 'الشات مقفول' : 'اكتب رسالتك…'}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-base text-white placeholder:text-white/40 focus:border-gold-400 focus:outline-none disabled:opacity-50 sm:text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim() || (!chatEnabled && !isHost)}
                    aria-label="إرسال"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-500 text-midnight-950 disabled:opacity-40"
                  >
                    <Glyph d={ICONS.send} className="-scale-x-100" />
                  </button>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className="relative flex items-center justify-center gap-1 border-t border-white/10 bg-[#0b0f14] px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:gap-2">
        {isHost ? (
          <>
            <ControlButton
              label={isMicrophoneEnabled ? 'المايك' : 'المايك مقفول'}
              icon={isMicrophoneEnabled ? ICONS.mic : ICONS.micOff}
              off={!isMicrophoneEnabled}
              onClick={() => void toggleMedia('mic')}
            />
            <ControlButton
              label={isCameraEnabled ? 'الكاميرا' : 'الكاميرا مقفولة'}
              icon={isCameraEnabled ? ICONS.cam : ICONS.camOff}
              off={!isCameraEnabled}
              onClick={() => void toggleMedia('camera')}
            />
            <ControlButton
              label="اعرض الشاشة"
              icon={ICONS.screen}
              active={isScreenShareEnabled}
              onClick={() => void toggleMedia('screen')}
            />
            <ControlButton
              label={chatEnabled ? 'اقفل الشات' : 'افتح الشات'}
              icon={chatEnabled ? ICONS.chat : ICONS.chatOff}
              off={!chatEnabled}
              onClick={() => void toggleChat()}
            />
            <ControlButton
              label={panelOpen ? 'إخفاء اللوحة' : 'اللوحة'}
              icon={ICONS.users}
              active={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
              expanded={panelOpen}
            />
            <ControlButton
              label="إنهاء اللايف"
              icon={ICONS.leave}
              danger
              onClick={() => setConfirmEnd(true)}
            />
          </>
        ) : (
          <>
            <div className="relative">
              <ControlButton
                label="رياكت"
                icon={ICONS.smile}
                active={reactOpen}
                expanded={reactOpen}
                onClick={() => setReactOpen((v) => !v)}
              />
              <AnimatePresence>
                {reactOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-2xl border border-white/15 bg-[#151b24] p-1.5 shadow-2xl"
                    role="menu"
                    aria-label="اختار رياكت"
                  >
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        role="menuitem"
                        onClick={() => void sendReaction(emoji)}
                        className="grid h-11 w-11 place-items-center rounded-xl text-2xl transition-transform hover:scale-110 hover:bg-white/10"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <ControlButton
              label={panelOpen ? 'إخفاء الشات' : 'الشات'}
              icon={ICONS.chat}
              active={panelOpen}
              expanded={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
            />
            <ControlButton label="خروج" icon={ICONS.leave} danger onClick={() => void leave()} />
          </>
        )}
      </footer>

      <ConfirmDialog
        open={confirmEnd}
        title="تنهي اللايف؟"
        body="كل الطلبة هيخرجوا من الغرفة واللايف هيتقفل نهائيًا."
        confirmLabel="أيوه، أنهي اللايف"
        cancelLabel="لا، كمّل"
        destructive
        isPending={ending}
        onConfirm={() => void endLive()}
        onCancel={() => setConfirmEnd(false)}
      />
    </div>
  );
}
