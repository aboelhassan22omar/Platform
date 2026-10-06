'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UploadTicket {
  assetId: string;
  uploadUrl: string;
  key: string;
  expiresIn: number;
  method: 'PUT';
  headers: Record<string, string>;
}

interface ProcessingStatus {
  assetId?: string;
  status: string;
  progress: number;
  durationSeconds?: number | null;
  renditions?: string[];
  error?: string | null;
  jobStatus?: string | null;
  attempts?: number;
}

type Phase = 'idle' | 'uploading' | 'processing' | 'ready' | 'failed';

const STATUS_COPY: Record<string, string> = {
  AWAITING_UPLOAD: 'في انتظار الرفع',
  UPLOADED: 'تم الرفع',
  QUEUED: 'في قائمة المعالجة',
  PROCESSING: 'جاري التحويل لجودات متعددة',
  READY: 'جاهز للمشاهدة',
  FAILED: 'فشلت المعالجة',
};

export function VideoUploader({ lessonId }: { lessonId: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      xhrRef.current?.abort();
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const pollStatus = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);

    pollRef.current = window.setInterval(async () => {
      try {
        const next = await api.get<ProcessingStatus>(
          `/admin/content/lessons/${lessonId}/video/status`,
        );
        setStatus(next);

        if (next.status === 'READY') {
          setPhase('ready');
          if (pollRef.current) window.clearInterval(pollRef.current);
        } else if (next.status === 'FAILED') {
          setPhase('failed');
          setError(next.error ?? 'فشلت المعالجة أثناء تشفير الفيديو.');
          if (pollRef.current) window.clearInterval(pollRef.current);
        } else {
          setPhase('processing');
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return;
        }
      }
    }, 2500);
  }, [lessonId]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ProcessingStatus>(`/admin/content/lessons/${lessonId}/video/status`)
      .then((existing) => {
        if (cancelled) return;
        if (existing.status === 'READY') {
          setStatus(existing);
          setPhase('ready');
        } else if (existing.status === 'FAILED') {
          setStatus(existing);
          setPhase('failed');
          setError(existing.error ?? 'فشلت المعالجة.');
        } else if (
          existing.status === 'PROCESSING' ||
          existing.status === 'QUEUED' ||
          existing.status === 'UPLOADED'
        ) {
          setStatus(existing);
          setPhase('processing');
          pollStatus();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [lessonId, pollStatus]);

  const upload = async (selected: File) => {
    setError(null);
    setFile(selected);
    setPhase('uploading');
    setUploadPercent(0);

    try {
      const ticket = await api.post<UploadTicket>(
        `/admin/content/lessons/${lessonId}/video/upload-ticket`,
        {
          fileName: selected.name,
          contentType: selected.type || 'video/mp4',
          sizeBytes: selected.size,
        },
      );

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadPercent(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`فشل الرفع إلى التخزين (كود ${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
        xhr.onabort = () => reject(new Error('تم إلغاء الرفع'));

        xhr.open(ticket.method, ticket.uploadUrl, true);
        for (const [header, val] of Object.entries(ticket.headers ?? {})) {
          xhr.setRequestHeader(header, val);
        }
        xhr.setRequestHeader('Content-Type', selected.type || 'video/mp4');
        xhr.send(selected);
      });

      await api.post(`/admin/content/lessons/${lessonId}/video/complete`);

      setPhase('processing');
      pollStatus();
    } catch (err) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'حصل خطأ غير متوقع أثناء الرفع');
    }
  };

  const reset = () => {
    xhrRef.current?.abort();
    if (pollRef.current) window.clearInterval(pollRef.current);
    setPhase('idle');
    setFile(null);
    setUploadPercent(0);
    setError(null);
  };

  if (phase === 'idle') {
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) void upload(dropped);
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
          isDragging
            ? 'border-gold-500 bg-gold-50/70 dark:bg-gold-500/10'
            : 'border-gold-500/30 bg-ivory-50/70 dark:bg-midnight-950/60',
        )}
      >
        <span
          aria-hidden
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white dark:bg-midnight-900 text-gold-600 dark:text-gold-400 shadow-card"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M12 16V4M7.5 8.5L12 4l4.5 4.5"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <p className="mt-4 font-display text-base font-bold text-midnight-950 dark:text-ivory-50">
          اسحب ملف الفيديو هنا
        </p>
        <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/70">
          MP4 أو MOV أو MKV أو WEBM — حتى ٥ جيجا
        </p>

        <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-midnight-900 dark:bg-gold-500 dark:text-midnight-950 px-6 text-sm font-bold text-ivory-50 transition-colors hover:bg-midnight-800 dark:hover:bg-gold-400 shadow-md">
          اختار ملف
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void upload(selected);
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold-500/25 bg-white dark:bg-midnight-950/80 p-5 shadow-card transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-midnight-950 dark:text-ivory-50">
            {file?.name}
          </p>
          {file && (
            <p className="text-xs text-midnight-500 dark:text-ivory-300/60">
              {(file.size / 1024 / 1024).toFixed(1)} ميجا
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-midnight-600 dark:text-ivory-300/70 transition-colors hover:bg-gold-500/10"
        >
          {phase === 'ready' || phase === 'failed' ? 'رفع ملف تاني' : 'إلغاء'}
        </button>
      </div>

      {/* Upload bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-midnight-700 dark:text-ivory-200">
            {phase === 'uploading' ? 'جاري الرفع' : 'تم الرفع'}
          </span>
          <span className="nums-tabular font-bold text-midnight-900 dark:text-ivory-100">
            {uploadPercent}%
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ivory-200 dark:bg-midnight-800">
          <motion.div
            animate={{ width: `${uploadPercent}%` }}
            transition={{ duration: 0.3 }}
            className={cn(
              'h-full rounded-full',
              uploadPercent === 100 ? 'bg-emerald-500' : 'bg-gold-500',
            )}
          />
        </div>
      </div>

      {/* Processing */}
      {(phase === 'processing' || phase === 'ready' || phase === 'failed') && status && (
        <div className="mt-5 border-t border-gold-500/20 pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-semibold text-midnight-700 dark:text-ivory-200">
              {phase === 'processing' && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
              )}
              {STATUS_COPY[status.status] ?? status.status}
            </span>
            {phase === 'processing' && (
              <span className="nums-tabular font-bold text-midnight-900 dark:text-ivory-100">
                {status.progress}%
              </span>
            )}
          </div>

          {phase === 'processing' && (
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ivory-200 dark:bg-midnight-800">
              <motion.div
                animate={{ width: `${status.progress}%` }}
                transition={{ duration: 0.4 }}
                className="h-full rounded-full bg-sky-500"
              />
            </div>
          )}

          {phase === 'ready' && (
            <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 p-3">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                ✓ الفيديو جاهز للمشاهدة
              </p>
              {status.renditions && status.renditions.length > 0 && (
                <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                  الجودات المتاحة: {status.renditions.join('، ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-500/20 p-3">
          <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              setError(null);
              setPhase('processing');
              void api
                .post(`/admin/content/lessons/${lessonId}/video/retry`)
                .then(() => pollStatus())
                .catch(() => setPhase('failed'));
            }}
          >
            أعد المحاولة
          </Button>
        </div>
      )}
    </div>
  );
}
