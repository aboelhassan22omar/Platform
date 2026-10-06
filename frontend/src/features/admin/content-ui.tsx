'use client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PublishStatus } from '@/types/api';
import { STATUS_LABELS } from './admin-content.types';

export function StatusBadge({ status }: { status: PublishStatus }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-[10px] font-black',
        status === 'PUBLISHED'
          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
          : status === 'ARCHIVED'
            ? 'bg-red-500/10 text-red-600 dark:text-red-300'
            : 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function ActionButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-bold transition-colors',
        danger
          ? 'border-red-500/20 text-red-600 hover:bg-red-500/10 dark:text-red-300'
          : 'border-gold-500/20 text-midnight-600 hover:border-gold-500/45 hover:bg-gold-500/10 hover:text-gold-700 dark:text-ivory-300 dark:hover:text-gold-300',
      )}
    >
      {children}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

export function EmptyState({
  title,
  action,
  compact,
}: {
  title: string;
  action: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-gold-500/30 text-center',
        compact ? 'p-5' : 'bg-white p-10 dark:bg-midnight-950/60',
      )}
    >
      <p className="font-display text-sm font-black text-midnight-800 dark:text-ivory-100">
        {title}
      </p>
      <p className="mt-1 text-xs text-midnight-500 dark:text-ivory-300/60">{action}</p>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-50 p-6 text-center dark:bg-red-950/35">
      <p className="font-bold text-red-700 dark:text-red-300">
        {error instanceof Error ? error.message : 'تعذر تحميل المحتوى.'}
      </p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        حاول مرة أخرى
      </Button>
    </div>
  );
}
