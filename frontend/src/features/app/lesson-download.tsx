'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { useProtection } from '@/features/protection/use-protection';
import { api } from '@/lib/api';
import { useNativeApp } from '@/lib/native-app';
import { cn, toArabicDigits } from '@/lib/utils';
import {
  type DownloadPhase,
  downloadLesson,
  libraryUrl,
  offlineAvailable,
  readIndex,
  removeOffline,
} from './offline-library';

const formatSize = (bytes: number) =>
  bytes >= 1_000_000_000
    ? `${toArabicDigits((bytes / 1_000_000_000).toFixed(1))} جيجا`
    : `${toArabicDigits(Math.max(1, Math.round(bytes / 1_000_000)))} ميجا`;

/**
 * "Save this lesson on my phone", in the store apps only. The video goes to
 * the phone's private storage and plays from «مكتبتي» with no connection.
 */
export function LessonDownload({
  lesson,
}: {
  lesson: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    course: { title: string; gradeName: string };
  };
}) {
  const native = useNativeApp();
  const { user } = useAuth();
  const { watermarkText } = useProtection();
  const settings = useQuery({
    queryKey: ['offline-settings'],
    queryFn: () => api.get<{ enabled: boolean; days: number }>('/settings/offline'),
    enabled: native,
    staleTime: 60_000,
  });
  const [saved, setSaved] = useState<{ sizeBytes: number } | null>(null);
  const [progress, setProgress] = useState<{ phase: DownloadPhase; fraction: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const index = await readIndex();
    const item = index.items.find((entry) => entry.lessonId === lesson.id);
    setSaved(item && (!user || index.userId === user.id) ? { sizeBytes: item.sizeBytes } : null);
  }, [lesson.id, user]);

  useEffect(() => {
    if (native && offlineAvailable()) void refresh();
  }, [native, refresh]);

  if (!native || !offlineAvailable() || !user || !settings.data?.enabled) return null;

  const start = async () => {
    setError(null);
    try {
      await downloadLesson(
        {
          id: lesson.id,
          title: lesson.title,
          courseTitle: lesson.course.title,
          gradeName: lesson.course.gradeName,
          posterUrl: lesson.thumbnailUrl,
        },
        { userId: user.id, watermark: watermarkText },
        (phase, fraction) => setProgress({ phase, fraction }),
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'التنزيل وقف، جرّب تاني');
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    await removeOffline(lesson.id);
    await refresh();
  };

  const percent = progress ? Math.round(progress.fraction * 100) : 0;

  return (
    <section
      aria-label="التنزيل على الموبايل"
      className="mt-4 rounded-2xl border border-ivory-300 bg-white p-4 shadow-card"
    >
      {saved ? (
        <>
          <p className="flex items-center gap-2 text-sm font-black text-emerald-700">
            <span aria-hidden>✓</span> الحصة متنزّلة على موبايلك ({formatSize(saved.sizeBytes)})
          </p>
          <p className="mt-1 text-xs leading-6 text-midnight-500">
            تتفرج عليها من «مكتبتي» حتى لو مفيش نت. بتشتغل {toArabicDigits(settings.data.days)} يوم
            من غير نت، وكل ما تفتح نت المدة بتتجدد.
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href={libraryUrl()}
              className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-black text-[var(--accent-contrast)]"
            >
              افتح مكتبتي
            </a>
            <button
              type="button"
              onClick={() => void remove()}
              className="min-h-11 rounded-xl border border-ivory-300 px-4 text-sm font-bold text-midnight-600 hover:border-red-300 hover:text-red-700"
            >
              امسحها
            </button>
          </div>
        </>
      ) : progress ? (
        <div role="status" aria-live="polite">
          <p className="text-sm font-black text-midnight-800">
            {progress.phase === 'preparing'
              ? 'بنجهّز الحصة للتنزيل…'
              : progress.phase === 'saving'
                ? 'بنحفظها على موبايلك…'
                : `بننزّل الحصة… ${toArabicDigits(percent)}٪`}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ivory-200">
            <div
              className={cn(
                'h-full rounded-full bg-[var(--accent)] transition-[width] duration-300',
                progress.phase === 'preparing' && 'w-1/4 animate-pulse',
              )}
              style={progress.phase === 'preparing' ? undefined : { width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-midnight-500">خلّي التطبيق مفتوح لحد ما التنزيل يخلص.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void start()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--accent)] px-4 text-sm font-black text-[var(--accent)] hover:bg-[var(--accent)]/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            نزّل الحصة وشوفها من غير نت
          </button>
          <p className="mt-2 text-xs leading-6 text-midnight-500">
            الحصة بتتحفظ على موبايلك في «مكتبتي». المشاهدة من غير نت بتتحسب من عدد مرات المشاهدة.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
