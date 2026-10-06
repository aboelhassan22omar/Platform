'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn, toArabicDigits } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { LiveRecording } from '@/types/api';

const duration = (seconds: number | null) => {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return toArabicDigits(h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`);
};

const size = (bytes: number | null) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return toArabicDigits(
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} جيجا` : `${Math.max(1, Math.round(mb))} ميجا`,
  );
};

const STATUS: Record<LiveRecording['status'], { label: string; className: string }> = {
  RECORDING: { label: 'بيسجّل دلوقتي', className: 'text-red-600 dark:text-red-400' },
  PROCESSING: { label: 'بيتجهز…', className: 'text-gold-700 dark:text-gold-300' },
  READY: { label: 'جاهز', className: 'text-emerald-700 dark:text-emerald-400' },
  FAILED: { label: 'فشل', className: 'text-red-600 dark:text-red-400' },
};

/** The recorded segments of one live class. Teacher-only. */
export function LiveRecordings({
  title,
  recordings,
  onChanged,
}: {
  title: string;
  recordings: LiveRecording[];
  onChanged: () => void;
}) {
  const [playing, setPlaying] = useState<{ url: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState<LiveRecording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useMutation({
    mutationFn: ({ id, download }: { id: string; download: boolean }) =>
      api.get<{ url: string }>(`/admin/live/recordings/${id}/url${download ? '?download=1' : ''}`),
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'مقدرناش نفتح التسجيل'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/live/recordings/${id}`),
    onSuccess: () => {
      setDeleting(null);
      onChanged();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'مقدرناش نمسح التسجيل'),
  });

  const multi = recordings.length > 1;

  return (
    <div className="mt-4 border-t border-gold-500/15 pt-3">
      <p className="text-xs font-black text-midnight-700 dark:text-ivory-200">
        التسجيل
        {multi ? ` (${toArabicDigits(String(recordings.length))} أجزاء — المستر خرج ورجع)` : ''}
      </p>
      <ul className="mt-2 space-y-2">
        {recordings.map((recording, index) => {
          const label = multi ? `الجزء ${toArabicDigits(String(index + 1))}` : 'تسجيل اللايف';
          return (
            <li
              key={recording.id}
              className="flex flex-col gap-2 rounded-xl border border-gold-500/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 text-sm">
                <span className="font-bold text-midnight-900 dark:text-ivory-100">{label}</span>
                <span className={cn('ms-2 text-xs font-bold', STATUS[recording.status].className)}>
                  {STATUS[recording.status].label}
                </span>
                {recording.status === 'READY' && (
                  <span className="nums-tabular ms-2 text-xs text-midnight-500 dark:text-ivory-300/70">
                    {[duration(recording.durationSeconds), size(recording.sizeBytes)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
                {recording.status === 'FAILED' && recording.error && (
                  <p
                    className="mt-1 break-words text-xs text-midnight-500 dark:text-ivory-300/70"
                    dir="auto"
                  >
                    {recording.error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {recording.status === 'READY' && (
                  <>
                    <Button
                      size="sm"
                      variant="accent"
                      isLoading={
                        open.isPending &&
                        open.variables?.id === recording.id &&
                        !open.variables.download
                      }
                      onClick={() => {
                        setError(null);
                        open.mutate(
                          { id: recording.id, download: false },
                          {
                            onSuccess: ({ url }) =>
                              setPlaying({ url, label: `${title} — ${label}` }),
                          },
                        );
                      }}
                    >
                      شوف
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        open.mutate(
                          { id: recording.id, download: true },
                          { onSuccess: ({ url }) => window.location.assign(url) },
                        );
                      }}
                    >
                      نزّل
                    </Button>
                  </>
                )}
                {(recording.status === 'READY' || recording.status === 'FAILED') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 dark:text-red-400"
                    onClick={() => setDeleting(recording)}
                  >
                    امسح
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <AnimatePresence>
        {playing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={playing.label}
            onClick={() => setPlaying(null)}
          >
            <div className="w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between gap-3 text-white">
                <p className="truncate text-sm font-bold">{playing.label}</p>
                <button
                  type="button"
                  onClick={() => setPlaying(null)}
                  className="rounded-lg px-3 py-1.5 text-sm font-bold hover:bg-white/10"
                  autoFocus
                >
                  قفل
                </button>
              </div>
              <video
                src={playing.url}
                controls
                autoPlay
                playsInline
                className="aspect-video w-full rounded-xl bg-black"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="تمسح التسجيل؟"
        body="الملف هيتمسح نهائيًا من المخزن ومش هينفع يرجع."
        confirmLabel="أيوه، امسحه"
        cancelLabel="لا"
        destructive
        isPending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
