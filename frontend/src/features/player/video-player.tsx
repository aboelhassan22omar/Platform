'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type Hls from 'hls.js';
import { api } from '@/lib/api';
import { cn, formatDuration } from '@/lib/utils';
import type { PlaybackTicket } from '@/types/api';

/** How often playback position is written to the server. */
const PROGRESS_SYNC_SECONDS = 15;
const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2] as const;
const PLAYBACK_RATE_STORAGE_KEY = 'video-playback-rate';

interface VideoPlayerProps {
  lessonId: string;
  title: string;
  posterUrl?: string | null;
}

/** Force hls.js onto a real rendition and return the rendition actually used. */
function switchHlsQuality(hls: Hls, requestedHeight: number): number | null {
  if (hls.levels.length === 0) return null;

  const exactIndex = hls.levels.findIndex((level) => level.height === requestedHeight);
  const levelIndex =
    exactIndex >= 0
      ? exactIndex
      : hls.levels.reduce((closestIndex, level, index, allLevels) =>
          Math.abs((level.height ?? 0) - requestedHeight) <
          Math.abs((allLevels[closestIndex]?.height ?? 0) - requestedHeight)
            ? index
            : closestIndex,
        0);

  // currentLevel is hls.js's immediate manual switch. It disables ABR and
  // flushes the incompatible forward buffer before loading this rendition.
  hls.currentLevel = levelIndex;
  return hls.levels[levelIndex]?.height ?? requestedHeight;
}

/**
 * HLS player with entitlement-gated playback and resumable progress.
 *
 * Flow:
 *   1. POST /videos/:id/playback — the server re-checks the entitlement and
 *      returns a short-lived ticket plus the resume position.
 *   2. hls.js (or native HLS on Safari/iOS) plays the ticketed manifest.
 *   3. Position is synced every 15s and on pause/unload — never per frame.
 *
 * Nothing here grants access. If the student is not entitled, step 1 fails
 * with 403 and no media URL is ever produced.
 */
export function VideoPlayer({ lessonId, title, posterUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<PlaybackTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [levels, setLevels] = useState<Array<{ index: number; height: number }>>([]);
  const [selectedQualityHeight, setSelectedQualityHeight] = useState<number | null>(null);
  const [switchingQualityHeight, setSwitchingQualityHeight] = useState<number | null>(null);
  const [showQuality, setShowQuality] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);

  const lastSyncRef = useRef(0);
  const watchedSinceSyncRef = useRef(0);
  const lastPlaybackPositionRef = useRef<number | null>(null);
  const lastLocalSaveSecondRef = useRef(-1);
  const hideTimerRef = useRef<number | null>(null);
  const pendingQualityHeightRef = useRef<number | null>(null);
  const usesNativeHlsRef = useRef(false);
  const localProgressKey = `lesson-playback-position:${lessonId}`;

  // --------------------------------------------------------------------------
  // Progress sync
  // --------------------------------------------------------------------------

  const syncProgress = useCallback(
    (force = false, keepalive = false) => {
      const video = videoRef.current;
      if (!video || !video.duration || Number.isNaN(video.duration)) return;

      const position = Math.floor(video.currentTime);
      const watchedSeconds = Math.min(120, Math.floor(watchedSinceSyncRef.current));
      if (!force && watchedSeconds < PROGRESS_SYNC_SECONDS) {
        return;
      }
      lastSyncRef.current = position;
      watchedSinceSyncRef.current = Math.max(0, watchedSinceSyncRef.current - watchedSeconds);

      void api
        .put(
          `/lessons/${lessonId}/progress`,
          {
            positionSeconds: position,
            durationSeconds: Math.floor(video.duration),
            watchedSeconds,
          },
          { keepalive },
        )
        .catch(() => {
          watchedSinceSyncRef.current = Math.min(
            120,
            watchedSinceSyncRef.current + watchedSeconds,
          );
          // A dropped sync is not worth interrupting playback for; the next
          // tick will carry the position forward.
        });
    },
    [lessonId],
  );

  const saveLocalProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration || Number.isNaN(video.duration)) return;

    try {
      localStorage.setItem(
        localProgressKey,
        JSON.stringify({
          position: video.currentTime,
          duration: video.duration,
          savedAt: Date.now(),
        }),
      );
    } catch {
      // Private browsing/storage restrictions must never interrupt playback.
    }
  }, [localProgressKey]);

  // --------------------------------------------------------------------------
  // Ticket + HLS setup
  // --------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const issued = await api.post<PlaybackTicket>(`/videos/${lessonId}/playback`);
        if (cancelled) return;
        setTicket(issued);
      } catch (err) {
        if (!cancelled) {
          setError(
            (err as { message?: string }).message ?? 'مش قادرين نشغّل الفيديو دلوقتي',
          );
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ticket) return;

    let disposed = false;

    const attach = async () => {
      // Safari and iOS play HLS natively; loading hls.js there would be both
      // unnecessary and worse (no AirPlay, no picture-in-picture).
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        usesNativeHlsRef.current = true;
        video.src = ticket.manifestUrl;
        return;
      }

      usesNativeHlsRef.current = false;

      const { default: HlsCtor } = await import('hls.js');
      if (disposed) return;

      if (!HlsCtor.isSupported()) {
        setError('المتصفح ده مش بيدعم تشغيل الفيديو، جرّب متصفح تاني');
        return;
      }

      const hls = new HlsCtor({
        // Keep the buffer modest — students on mobile data should not have
        // several minutes of video pulled down ahead of them.
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: false,
      });

      hlsRef.current = hls;
      hls.loadSource(ticket.manifestUrl);
      hls.attachMedia(video);

      hls.on(HlsCtor.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(
          data.levels.map((level, index) => ({ index, height: level.height ?? 0 })),
        );

        // A student can open the menu before hls.js has finished parsing the
        // master playlist. Honour that click as soon as the levels exist.
        const pendingHeight = pendingQualityHeightRef.current;
        if (pendingHeight != null) {
          const appliedHeight = switchHlsQuality(hls, pendingHeight);
          if (appliedHeight != null) {
            setSwitchingQualityHeight(appliedHeight);
          }
        }
      });

      hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_event, data) => {
        const switchedHeight = hls.levels[data.level]?.height ?? null;
        if (pendingQualityHeightRef.current != null) {
          if (switchedHeight === pendingQualityHeightRef.current || !hls.autoLevelEnabled) {
            pendingQualityHeightRef.current = null;
            setSelectedQualityHeight(switchedHeight);
            setSwitchingQualityHeight(null);
          }
          return;
        }
        setSelectedQualityHeight(
          hls.autoLevelEnabled ? null : switchedHeight,
        );
      });

      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
          // A ticket expiring mid-lesson is the common cause here.
          setError('انتهت صلاحية رابط المشاهدة، حدّث الصفحة عشان تكمل');
        } else {
          hls.recoverMediaError();
        }
      });
    };

    void attach();

    return () => {
      disposed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [ticket]);

  // --------------------------------------------------------------------------
  // Media events
  // --------------------------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration || 0);
      setIsReady(true);
      video.playbackRate = playbackRate;

      let localPosition: number | null = null;
      try {
        const saved = JSON.parse(localStorage.getItem(localProgressKey) ?? 'null') as {
          position?: number;
          duration?: number;
        } | null;
        const durationMatches =
          saved?.duration != null && Math.abs(saved.duration - video.duration) < 2;
        if (
          durationMatches &&
          Number.isFinite(saved?.position) &&
          (saved?.position ?? 0) > 0 &&
          (saved?.position ?? 0) < video.duration - 2
        ) {
          localPosition = saved?.position ?? null;
        }
      } catch {
        // Fall back to the server position when local storage is unavailable.
      }

      const resumeAt = localPosition ?? ticket?.resumeAtSeconds ?? 0;
      if (resumeAt > 0 && resumeAt < video.duration - 2) {
        video.currentTime = resumeAt;
        setCurrentTime(resumeAt);
        lastSyncRef.current = Math.floor(resumeAt);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const previousPosition = lastPlaybackPositionRef.current;
      const playbackDelta = previousPosition == null ? 0 : video.currentTime - previousPosition;
      if (!video.paused && playbackDelta > 0 && playbackDelta <= 2.5) {
        watchedSinceSyncRef.current += playbackDelta;
      }
      lastPlaybackPositionRef.current = video.currentTime;
      const currentSecond = Math.floor(video.currentTime);
      if (currentSecond !== lastLocalSaveSecondRef.current) {
        lastLocalSaveSecondRef.current = currentSecond;
        saveLocalProgress();
      }
      syncProgress();
    };

    const onPlay = () => {
      setIsPlaying(true);
      lastPlaybackPositionRef.current = video.currentTime;
      // Creates the progress row immediately, so free lessons appear in "حصصي".
      syncProgress(true);
    };
    const onPause = () => {
      setIsPlaying(false);
      lastPlaybackPositionRef.current = null;
      saveLocalProgress();
      syncProgress(true);
    };
    const onEnded = () => {
      setIsPlaying(false);
      lastPlaybackPositionRef.current = null;
      try {
        localStorage.removeItem(localProgressKey);
      } catch {
        // Ignore unavailable storage.
      }
      syncProgress(true);
    };
    const onVolume = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('volumechange', onVolume);

    // Last chance to record the position when the tab closes.
    const onUnload = () => {
      saveLocalProgress();
      syncProgress(true, true);
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('volumechange', onVolume);
      window.removeEventListener('pagehide', onUnload);
      saveLocalProgress();
      syncProgress(true, true);
    };
  }, [localProgressKey, playbackRate, saveLocalProgress, syncProgress, ticket]);

  useEffect(() => {
    try {
      const storedRate = Number(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY));
      if (PLAYBACK_RATES.includes(storedRate as (typeof PLAYBACK_RATES)[number])) {
        setPlaybackRate(storedRate);
        if (videoRef.current) videoRef.current.playbackRate = storedRate;
      }
    } catch {
      // A blocked localStorage should not affect playback.
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // --------------------------------------------------------------------------
  // Controls
  // --------------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, seconds), video.duration || 0);
    setCurrentTime(video.currentTime);
  };

  const skip = (delta: number) => seek((videoRef.current?.currentTime ?? 0) + delta);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current?.requestFullscreen().catch(() => undefined);
  };

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (isPlaying && !showQuality && !showSpeed) setShowControls(false);
    }, 3000);
  }, [isPlaying, showQuality, showSpeed]);

  const hideControls = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    setShowControls(false);
    setShowQuality(false);
    setShowSpeed(false);
  }, []);

  const switchNativeHlsSource = (sourceUrl: string, height: number | null) => {
    const video = videoRef.current;
    if (!video) return;

    const position = video.currentTime;
    const shouldResume = !video.paused;
    const rate = video.playbackRate;
    setSwitchingQualityHeight(height);

    video.src = sourceUrl;
    video.load();
    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = Math.min(position, Math.max(0, video.duration - 0.1));
        video.playbackRate = rate;
        setSelectedQualityHeight(height);
        setSwitchingQualityHeight(null);
        if (shouldResume) void video.play();
      },
      { once: true },
    );
  };

  const selectAutoQuality = () => {
    pendingQualityHeightRef.current = null;
    setSwitchingQualityHeight(null);
    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = -1;
    } else if (usesNativeHlsRef.current && ticket) {
      switchNativeHlsSource(ticket.manifestUrl, null);
    }
    setSelectedQualityHeight(null);
    setShowQuality(false);
  };

  const selectQuality = (height: number) => {
    pendingQualityHeightRef.current = height;
    setSwitchingQualityHeight(height);
    setShowQuality(false);

    const hls = hlsRef.current;
    if (!hls) {
      if (usesNativeHlsRef.current && ticket) {
        const renditionIndex = ticket.renditions.findIndex(
          (rendition) => Number.parseInt(rendition, 10) === height,
        );
        if (renditionIndex >= 0) {
          switchNativeHlsSource(
            `/api/videos/${encodeURIComponent(lessonId)}/hls/v${renditionIndex}/playlist.m3u8?ticket=${encodeURIComponent(ticket.ticket)}`,
            height,
          );
        }
      }
      return;
    }

    const appliedHeight = switchHlsQuality(hls, height);
    if (appliedHeight != null) {
      setSwitchingQualityHeight(appliedHeight);
    }
  };

  const selectPlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeed(false);
    try {
      localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate));
    } catch {
      // Keep the choice for this page even when storage is unavailable.
    }
  };

  // Keyboard shortcuts, scoped to the player container.
  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case ' ':
      case 'k':
        event.preventDefault();
        togglePlay();
        break;
      // RTL note: arrows follow the timeline, not the text direction —
      // ArrowRight always moves forward, as students expect from any player.
      case 'ArrowRight':
        event.preventDefault();
        skip(5);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        skip(-5);
        break;
      case 'f':
        void toggleFullscreen();
        break;
      case 'm': {
        const video = videoRef.current;
        if (video) video.muted = !video.muted;
        break;
      }
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePercent = (isMuted ? 0 : volume) * 100;
  const qualityLevels =
    levels.length > 0
      ? levels
      : (ticket?.renditions ?? []).map((rendition, index) => ({
          index,
          height: Number.parseInt(rendition, 10) || 0,
        }));

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-midnight-950 p-8 text-center">
        <span aria-hidden className="grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-red-300">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
            <path d="M12 7.5v5M12 16h.01" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="font-display text-base font-bold text-ivory-50">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 rounded-lg bg-ivory-50/10 px-4 py-2 text-sm font-bold text-ivory-100 transition-colors hover:bg-ivory-50/20"
        >
          حدّث الصفحة
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`مشغل الفيديو: ${title}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={revealControls}
      onMouseMove={revealControls}
      onMouseLeave={hideControls}
      onTouchStart={revealControls}
      className="group relative aspect-video w-full overflow-visible rounded-2xl bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
    >
      <video
        ref={videoRef}
        poster={posterUrl ?? ticket?.posterUrl ?? undefined}
        playsInline
        // Disables the "save video" affordance. This is a courtesy speed bump,
        // not a protection — see the note in videos.service.ts.
        controlsList="nodownload"
        disablePictureInPicture={false}
        className="h-full w-full rounded-2xl bg-black"
        onClick={togglePlay}
      />

      {/* --- Loading --- */}
      {!isReady && (
        <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl bg-midnight-950">
          <div className="flex flex-col items-center gap-3">
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-gold-400 border-t-transparent" />
            <p className="text-sm text-ivory-200/70">بنجهّز الفيديو...</p>
          </div>
        </div>
      )}

      {/* --- Centre play button --- */}
      <AnimatePresence>
        {isReady && !isPlaying && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={togglePlay}
            aria-label="شغّل"
            className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl bg-midnight-950/35"
          >
            <span className="grid h-20 w-20 place-items-center rounded-full bg-gold-500 text-midnight-950 shadow-2xl transition-transform duration-200 hover:scale-105">
              <svg width="30" height="30" viewBox="0 0 30 30" fill="currentColor">
                <path d="M9 5.5l16 9.5-16 9.5z" />
              </svg>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* --- Controls --- */}
      <AnimatePresence>
        {isReady && showControls && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-midnight-950/95 via-midnight-950/60 to-transparent p-3 pt-10 sm:p-4 sm:pt-12"
          >
            {/* Scrubber */}
            <div dir="ltr" className="group/bar relative">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(event) => seek(Number(event.target.value))}
                aria-label="موضع المشاهدة"
                className="video-progress-slider relative z-10 h-7 w-full cursor-pointer appearance-none focus-visible:outline-none"
                style={{
                  background: `linear-gradient(to right, #d8a328 0%, #d8a328 ${progressPercent}%, rgb(255 253 246 / 25%) ${progressPercent}%, rgb(255 253 246 / 25%) 100%) center / 100% 0.375rem no-repeat`,
                }}
              />
            </div>

            <div dir="ltr" className="mt-1 flex items-center gap-1.5 sm:gap-2.5">
              <ControlButton onClick={togglePlay} label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}>
                {isPlaying ? (
                  <path d="M6.5 4.5h3.5v13H6.5zM12 4.5h3.5v13H12z" fill="currentColor" />
                ) : (
                  <path d="M6 4l11 7-11 7z" fill="currentColor" />
                )}
              </ControlButton>

              <span className="nums-tabular whitespace-nowrap text-[11px] font-semibold text-ivory-100 sm:text-xs">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>

              <ControlButton onClick={() => skip(-10)} label="ارجع ١٠ ثواني">
                <path
                  d="M11 5V2L6 6l5 4V7a5 5 0 11-5 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </ControlButton>

              <ControlButton onClick={() => skip(10)} label="قدّم ١٠ ثواني">
                <path
                  d="M11 5V2l5 4-5 4V7a5 5 0 105 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </ControlButton>

              <div className="ml-auto flex items-center gap-1.5">
                {/* Quality gets a dedicated control instead of sharing a
                    confusing speed/quality menu. */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowQuality((value) => !value)}
                    aria-label="اختيار جودة الفيديو"
                    aria-expanded={showQuality}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-ivory-100 transition-colors hover:bg-ivory-50/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
                  >
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="7" cy="5.5" r="1.5" fill="currentColor" />
                      <circle cx="13" cy="10" r="1.5" fill="currentColor" />
                      <circle cx="9" cy="14.5" r="1.5" fill="currentColor" />
                    </svg>
                    الجودة:{' '}
                    {switchingQualityHeight != null
                      ? `جارٍ ${switchingQualityHeight}p`
                      : selectedQualityHeight == null
                        ? 'تلقائي'
                        : `${selectedQualityHeight}p`}
                  </button>

                  <AnimatePresence>
                    {showQuality && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                        className="absolute left-0 top-full z-50 mt-2 w-40 rounded-xl border border-gold-500/35 bg-midnight-950/98 p-2 shadow-2xl backdrop-blur-xl"
                      >
                        <p className="px-2 py-1 text-xs font-bold text-ivory-200/70">
                          جودة الفيديو
                        </p>
                        <div className="mt-1 space-y-1">
                          <QualityOption
                            active={selectedQualityHeight == null}
                            label="تلقائي (موصى به)"
                            onClick={selectAutoQuality}
                          />
                          {qualityLevels.map((level) => (
                            <QualityOption
                              key={level.index}
                              active={selectedQualityHeight === level.height}
                              label={`${level.height}p`}
                              onClick={() => selectQuality(level.height)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSpeed((value) => !value);
                      setShowQuality(false);
                    }}
                    aria-label="اختيار سرعة الفيديو"
                    aria-expanded={showSpeed}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-xs font-bold text-ivory-100 transition-colors hover:bg-ivory-50/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
                  >
                    {playbackRate}x
                  </button>

                  <AnimatePresence>
                    {showSpeed && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                        className="absolute left-0 top-full z-50 mt-2 w-36 rounded-xl border border-gold-500/35 bg-midnight-950/98 p-2 shadow-2xl backdrop-blur-xl"
                      >
                        <p className="px-2 py-1 text-xs font-bold text-ivory-200/70">
                          سرعة التشغيل
                        </p>
                        <div className="mt-1 space-y-1">
                          {PLAYBACK_RATES.map((rate) => (
                            <QualityOption
                              key={rate}
                              active={playbackRate === rate}
                              label={`${rate}x`}
                              onClick={() => selectPlaybackRate(rate)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Volume — icon first, then an explicit filled level bar. */}
                <div className="hidden items-center gap-1 sm:flex">
                  <ControlButton
                    onClick={() => {
                      const video = videoRef.current;
                      if (video) video.muted = !video.muted;
                    }}
                    label={isMuted ? 'شغّل الصوت' : 'اكتم الصوت'}
                  >
                    {isMuted || volume === 0 ? (
                      <path
                        d="M4 8v6h3l4 3.5v-13L7 8zM14 8l5 6M19 8l-5 6"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        fill="none"
                      />
                    ) : (
                      <path
                        d="M4 8v6h3l4 3.5v-13L7 8zM14.5 8.5a4 4 0 010 5M17 6.5a7 7 0 010 9"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        fill="none"
                      />
                    )}
                  </ControlButton>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(event) => {
                      const video = videoRef.current;
                      if (!video) return;
                      const nextVolume = Number(event.target.value);
                      video.volume = nextVolume;
                      video.muted = nextVolume === 0;
                    }}
                    aria-label="مستوى الصوت"
                    aria-valuetext={`${Math.round(volumePercent)}٪`}
                    className="video-volume-slider h-7 w-24 cursor-pointer appearance-none rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
                    style={{
                      direction: 'ltr',
                      background: `linear-gradient(to right, #d8a328 0%, #d8a328 ${volumePercent}%, rgba(255,255,255,.25) ${volumePercent}%, rgba(255,255,255,.25) 100%)`,
                      backgroundSize: '100% 0.375rem',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                  />
                </div>

                <ControlButton
                  onClick={() => void toggleFullscreen()}
                  label={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                >
                  {isFullscreen ? (
                    <path
                      d="M8 3v5H3M13 3v5h5M8 18v-5H3M13 18v-5h5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      fill="none"
                    />
                  ) : (
                    <path
                      d="M3 8V3h5M18 8V3h-5M3 13v5h5M18 13v5h-5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      fill="none"
                    />
                  )}
                </ControlButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // 40px minimum so the controls remain tappable on a phone.
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ivory-50 transition-colors hover:bg-ivory-50/15"
    >
      <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function QualityOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-md px-2 py-1.5 text-start text-[11px] font-bold transition-colors',
        active ? 'bg-gold-500 text-midnight-950' : 'text-ivory-100 hover:bg-ivory-50/10',
      )}
    >
      {label}
    </button>
  );
}
