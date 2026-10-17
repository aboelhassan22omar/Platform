'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type Hls from 'hls.js';
import Link from 'next/link';
import { api, apiBeacon, ApiError } from '@/lib/api';
import { cn, formatDurationLabel, toArabicDigits } from '@/lib/utils';
import type {
  PlaybackHeartbeat,
  PlaybackQueue,
  PlaybackResponse,
  PlaybackTicket,
} from '@/types/api';
import { WaitingRoom } from './waiting-room';
import { Watermark } from '@/features/protection/watermark';
import { useProtection } from '@/features/protection/use-protection';

/** How often playback position is written to the server. */
const PROGRESS_SYNC_SECONDS = 15;
/** Playing to within this much of the end reports the video as finished. */
const END_REPORT_SECONDS = 0.75;
const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2] as const;
const PLAYBACK_RATE_STORAGE_KEY = 'video-playback-rate';

/** Lets the page around the player read the position and jump to a moment. */
export interface PlayerController {
  currentTime: () => number;
  seek: (seconds: number) => void;
}

interface VideoPlayerProps {
  lessonId: string;
  title: string;
  posterUrl?: string | null;
  controllerRef?: React.MutableRefObject<PlayerController | null>;
}

/** Force hls.js onto a real rendition and return the rendition actually used. */
function switchHlsQuality(hls: Hls, requestedHeight: number): number | null {
  if (hls.levels.length === 0) return null;

  const exactIndex = hls.levels.findIndex((level) => level.height === requestedHeight);
  const levelIndex =
    exactIndex >= 0
      ? exactIndex
      : hls.levels.reduce(
          (closestIndex, level, index, allLevels) =>
            Math.abs((level.height ?? 0) - requestedHeight) <
            Math.abs((allLevels[closestIndex]?.height ?? 0) - requestedHeight)
              ? index
              : closestIndex,
          0,
        );

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
 * When the platform is at its viewer limit, step 1 answers QUEUED instead of
 * a ticket: the player shows the waiting room and retries on the server's
 * schedule. Once admitted, a heartbeat keeps the seat and closing the player
 * releases it, so the next student in line gets in without waiting for a
 * timeout.
 *
 * Nothing here grants access. If the student is not entitled, step 1 fails
 * with 403 and no media URL is ever produced.
 */
/** Player clock in Western digits: the Arabic-Indic zero is a dot and reads as noise. */
const formatClock = (totalSeconds: number) => {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
};

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

export function VideoPlayer({ lessonId, title, posterUrl, controllerRef }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      currentTime: () => videoRef.current?.currentTime ?? 0,
      seek: (seconds) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = seconds;
        void video.play().catch(() => undefined);
      },
    };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef]);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<PlaybackTicket | null>(null);
  const [queue, setQueue] = useState<PlaybackQueue | null>(null);
  /** The seat lapsed during a long pause; pressing play asks for a new one. */
  const [seatLapsed, setSeatLapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** In-page fullscreen for browsers that support neither API. */
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const { watermark } = useProtection();
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
  /** Set once the end of the video has been reported, until the student rewinds. */
  const endReportedRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);
  const pendingQualityHeightRef = useRef<number | null>(null);
  const usesNativeHlsRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);
  const readmissionsRef = useRef(0);
  const localProgressKey = `lesson-playback-position:${lessonId}`;

  // --------------------------------------------------------------------------
  // Progress sync
  // --------------------------------------------------------------------------

  const syncProgress = useCallback(
    (force = false, keepalive = false, atEnd = false) => {
      const video = videoRef.current;
      if (!video || !video.duration || Number.isNaN(video.duration)) return;

      // At the end, report the whole video and the final fraction of a second
      // too: flooring both left every lesson one second short of the end.
      const position = atEnd ? Math.ceil(video.duration) : Math.floor(video.currentTime);
      const watchedSeconds = Math.min(
        120,
        atEnd ? Math.ceil(watchedSinceSyncRef.current) : Math.floor(watchedSinceSyncRef.current),
      );
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
          watchedSinceSyncRef.current = Math.min(120, watchedSinceSyncRef.current + watchedSeconds);
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

  const requestTicket = useCallback(async () => {
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    try {
      const issued = await api.post<PlaybackResponse>(`/videos/${lessonId}/playback`);
      if (unmountedRef.current) return;
      if (issued.status === 'QUEUED') {
        setTicket(null);
        setQueue(issued.queue);
        retryTimerRef.current = window.setTimeout(
          () => void requestTicket(),
          Math.max(3, issued.queue.retryAfterSeconds) * 1000,
        );
        return;
      }
      setQueue(null);
      setSeatLapsed(false);
      setIsReady(false);
      setTicket(issued);
    } catch (err) {
      if (!unmountedRef.current) {
        setError((err as { message?: string }).message ?? 'مش قادرين نشغّل الفيديو دلوقتي');
        setErrorCode(err instanceof ApiError ? (err.code ?? null) : null);
      }
    }
  }, [lessonId]);

  /**
   * The server refused a segment because this student's seat is gone (it
   * lapsed and someone was waiting). Go back through admission, which either
   * re-seats them at once or puts them in line; playback resumes from the
   * locally saved position either way.
   */
  const rejoin = useCallback(() => {
    saveLocalProgress();
    readmissionsRef.current += 1;
    if (readmissionsRef.current > 20) {
      setError('الاتصال بالسيرفر مش مستقر، حدّث الصفحة');
      return;
    }
    setTicket(null);
    void requestTicket();
  }, [requestTicket, saveLocalProgress]);

  useEffect(() => {
    unmountedRef.current = false;
    void requestTicket();
    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, [requestTicket]);

  // Keep the seat while the player is open; free it the moment it closes.
  useEffect(() => {
    if (!ticket?.heartbeatSeconds) return;

    const beat = async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const result = await api.post<PlaybackHeartbeat>(`/videos/${lessonId}/heartbeat`, {
          positionSeconds: Math.floor(video.currentTime || 0),
          durationSeconds: Math.floor(Number.isFinite(video.duration) ? video.duration : 0),
          playing: !video.paused,
        });
        if (!result.admitted && video.paused) {
          // Paused past the grace period: the seat went to someone waiting.
          saveLocalProgress();
          setSeatLapsed(true);
          setTicket(null);
        }
      } catch {
        // A missed heartbeat is covered by the lease; segments renew it too.
      }
    };

    const timer = window.setInterval(() => void beat(), ticket.heartbeatSeconds * 1000);
    const release = () => apiBeacon(`/videos/${lessonId}/release`);
    window.addEventListener('pagehide', release);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', release);
    };
  }, [lessonId, saveLocalProgress, ticket]);

  useEffect(() => {
    // Release on leaving the lesson, not on every ticket change.
    return () => apiBeacon(`/videos/${lessonId}/release`);
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
        setLevels(data.levels.map((level, index) => ({ index, height: level.height ?? 0 })));

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
        setSelectedQualityHeight(hls.autoLevelEnabled ? null : switchedHeight);
      });

      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) {
          // 503: the seat lapsed. 403: the ticket expired or the views ran
          // out. Either way a fresh ticket resumes playback or says why not.
          if (data.response?.code === 503 || data.response?.code === 403) {
            rejoin();
            return;
          }
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
  }, [rejoin, ticket]);

  // Native HLS (Safari/iOS) reports a refused segment only as a media error.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ticket?.heartbeatSeconds) return;
    const onError = () => {
      if (usesNativeHlsRef.current) rejoin();
    };
    video.addEventListener('error', onError);
    return () => video.removeEventListener('error', onError);
  }, [rejoin, ticket]);

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
      // HLS often stops a fraction of a second short and never fires "ended",
      // which left students dragging the bar to the end to finish a lesson.
      const remaining = video.duration - video.currentTime;
      if (remaining > END_REPORT_SECONDS) {
        endReportedRef.current = false;
      } else if (!endReportedRef.current && !video.paused && video.duration > 0) {
        endReportedRef.current = true;
        syncProgress(true, false, true);
        return;
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
      // The pause the browser fires right before "ended" is not reported on its
      // own: "ended" reports the end with every watched second in one request.
      if (video.ended) return;
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
      endReportedRef.current = true;
      syncProgress(true, false, true);
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
    const doc = document as WebkitDocument;
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    // iPhone Safari only fullscreens the <video> itself, with its own events.
    const video = videoRef.current;
    const onNativeBegin = () => setIsFullscreen(true);
    const onNativeEnd = () => setIsFullscreen(false);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    video?.addEventListener('webkitbeginfullscreen', onNativeBegin);
    video?.addEventListener('webkitendfullscreen', onNativeEnd);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      video?.removeEventListener('webkitbeginfullscreen', onNativeBegin);
      video?.removeEventListener('webkitendfullscreen', onNativeEnd);
    };
  }, [ticket]);

  // The in-page fallback must not leave the page scrolling underneath.
  useEffect(() => {
    if (!isPseudoFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isPseudoFullscreen]);

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

  /**
   * Fullscreen that works on phones: the standard API (Android, desktop),
   * then the WebKit element API (older Safari), then the iPhone native video
   * fullscreen (the only one iOS Safari allows), then an in-page fallback.
   */
  const toggleFullscreen = async () => {
    const doc = document as WebkitDocument;
    const container = containerRef.current as WebkitElement | null;
    const video = videoRef.current as WebkitVideo | null;
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }
    if (doc.fullscreenElement) {
      await doc.exitFullscreen().catch(() => undefined);
      return;
    }
    if (doc.webkitFullscreenElement) {
      doc.webkitExitFullscreen?.();
      return;
    }
    if (container && document.fullscreenEnabled && container.requestFullscreen) {
      try {
        await container.requestFullscreen();
        // Phones: watch lessons sideways, like any video app.
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        };
        await orientation?.lock?.('landscape').catch(() => undefined);
        return;
      } catch {
        // Fall through to the WebKit paths.
      }
    }
    // iPhone Safari exposes no usable element fullscreen; only trust the flag.
    if (container?.webkitRequestFullscreen && doc.webkitFullscreenEnabled) {
      container.webkitRequestFullscreen();
      return;
    }
    // The iPhone's native video fullscreen hides every overlay, the watermark
    // included; with the watermark on, use the in-page fullscreen instead.
    if (video?.webkitEnterFullscreen && !watermark) {
      video.webkitEnterFullscreen();
      return;
    }
    setIsPseudoFullscreen(true);
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
      case 'Escape':
        if (isPseudoFullscreen) setIsPseudoFullscreen(false);
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

  if (queue && !ticket) return <WaitingRoom queue={queue} />;

  if (seatLapsed && !ticket) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-midnight-950 p-8 text-center">
        <p className="font-display text-base font-bold text-ivory-50">
          الفيديو كان واقف فترة طويلة، فإدّينا مكانك لطالب كان مستني
        </p>
        <p className="text-sm text-ivory-200/70">هتكمل من نفس المكان اللي وقفت عنده.</p>
        <button
          type="button"
          onClick={() => void requestTicket()}
          className="mt-1 rounded-lg bg-gold-400 px-5 py-2.5 text-sm font-black text-midnight-950 transition-colors hover:bg-gold-300"
        >
          كمّل المشاهدة
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-midnight-950 p-8 text-center">
        <span
          aria-hidden
          className="grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-red-300"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
            <path d="M12 7.5v5M12 16h.01" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="max-w-md font-display text-base font-bold leading-7 text-ivory-50">{error}</p>
        {errorCode === 'VIEW_LIMIT_REACHED' ? (
          <Link
            href="/contact"
            className="mt-1 rounded-lg bg-gold-400 px-5 py-2.5 text-sm font-black text-midnight-950 transition-colors hover:bg-gold-300"
          >
            كلّم الدعم
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 rounded-lg bg-ivory-50/10 px-4 py-2 text-sm font-bold text-ivory-100 transition-colors hover:bg-ivory-50/20"
          >
            حدّث الصفحة
          </button>
        )}
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
      className={cn(
        'group relative w-full overflow-visible bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
        isPseudoFullscreen
          ? 'fixed inset-0 z-[300] h-[100dvh] w-screen'
          : 'aspect-video rounded-2xl [&:fullscreen]:aspect-auto [&:fullscreen]:rounded-none',
      )}
    >
      <video
        ref={videoRef}
        poster={posterUrl ?? ticket?.posterUrl ?? undefined}
        playsInline
        // Disables the "save video" affordance. This is a courtesy speed bump,
        // not a protection — see the note in videos.service.ts.
        controlsList="nodownload"
        disablePictureInPicture={false}
        className={cn(
          'h-full w-full bg-black object-contain',
          !isPseudoFullscreen && !isFullscreen && 'rounded-2xl',
        )}
        onClick={togglePlay}
      />

      <Watermark />

      {/* --- Views left, shown while paused --- */}
      {isReady && !isPlaying && ticket?.views?.limited && ticket.views.remainingViews !== null && (
        <p
          className="pointer-events-none absolute start-3 top-3 z-10 rounded-full bg-midnight-950/80 px-3 py-1.5 text-xs font-bold text-ivory-50 shadow-lg backdrop-blur"
          title={`باقي حوالي ${formatDurationLabel(ticket.views.remainingSeconds)} مشاهدة`}
        >
          {ticket.views.remainingViews >= 1
            ? `باقي لك ${toArabicDigits(String(ticket.views.remainingViews).replace('.', '٫'))} من ${toArabicDigits(ticket.views.maxViews + ticket.views.bonusViews)} مشاهدات`
            : `باقي لك ${formatDurationLabel(ticket.views.remainingSeconds)} مشاهدة بس`}
        </p>
      )}

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
            // On a phone the video is short: keep the button above the control
            // bar instead of on top of the progress line.
            className={cn(
              'absolute inset-x-0 top-0 grid place-items-center overflow-hidden rounded-t-2xl bg-midnight-950/35',
              showControls
                ? 'bottom-[6.75rem] sm:bottom-0 sm:rounded-b-2xl'
                : 'bottom-0 rounded-b-2xl',
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-500 text-midnight-950 shadow-2xl transition-transform duration-200 hover:scale-105 sm:h-20 sm:w-20">
              <svg
                className="h-5 w-5 sm:h-[30px] sm:w-[30px]"
                viewBox="0 0 30 30"
                fill="currentColor"
              >
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
            className="absolute inset-x-0 bottom-0 z-10 rounded-b-2xl bg-gradient-to-t from-midnight-950/95 via-midnight-950/70 to-transparent px-2.5 pb-2 pt-6 sm:p-4 sm:pt-12"
          >
            {/* Phones: the clock sits above the bar so the button row fits. */}
            <div
              dir="ltr"
              className="nums-tabular flex justify-between px-1 text-[11px] font-semibold text-ivory-100 sm:hidden"
            >
              <span>{formatClock(currentTime)}</span>
              <span>{formatClock(duration)}</span>
            </div>
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

            <div dir="ltr" className="mt-0.5 flex items-center gap-1 sm:mt-1 sm:gap-2.5">
              <ControlButton onClick={togglePlay} label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}>
                {isPlaying ? (
                  <path d="M6.5 4.5h3.5v13H6.5zM12 4.5h3.5v13H12z" fill="currentColor" />
                ) : (
                  <path d="M6 4l11 7-11 7z" fill="currentColor" />
                )}
              </ControlButton>

              <span className="nums-tabular hidden whitespace-nowrap text-xs font-semibold text-ivory-100 sm:inline">
                {formatClock(currentTime)} / {formatClock(duration)}
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

              <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
                {/* Quality gets a dedicated control instead of sharing a
                    confusing speed/quality menu. */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowQuality((value) => !value)}
                    aria-label="اختيار جودة الفيديو"
                    aria-expanded={showQuality}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-ivory-100 transition-colors hover:bg-ivory-50/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 sm:min-h-11 sm:gap-1.5 sm:px-3"
                  >
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path
                        d="M3 5.5h14M3 10h14M3 14.5h14"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <circle cx="7" cy="5.5" r="1.5" fill="currentColor" />
                      <circle cx="13" cy="10" r="1.5" fill="currentColor" />
                      <circle cx="9" cy="14.5" r="1.5" fill="currentColor" />
                    </svg>
                    <span className="hidden sm:inline">الجودة: </span>
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
                        className="absolute bottom-full right-0 z-50 mb-2 w-40 rounded-xl border border-gold-500/35 bg-midnight-950/98 p-2 shadow-2xl backdrop-blur-xl"
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
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-bold text-ivory-100 transition-colors hover:bg-ivory-50/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
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
                        className="absolute bottom-full right-0 z-50 mb-2 w-36 rounded-xl border border-gold-500/35 bg-midnight-950/98 p-2 shadow-2xl backdrop-blur-xl"
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
                  label={isFullscreen || isPseudoFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                >
                  {isFullscreen || isPseudoFullscreen ? (
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
