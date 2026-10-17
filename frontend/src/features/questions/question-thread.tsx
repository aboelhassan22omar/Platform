'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn, formatDuration, formatNumber, formatRelative } from '@/lib/utils';
import type { LessonQuestionThread } from '@/types/api';

/**
 * The lesson page stays light even when the site is in dark mode, so its
 * fields cannot use input-base (which turns light-on-dark under html.dark).
 */
export const LIGHT_FIELD =
  'block w-full resize-y rounded-xl border border-ivory-300 bg-white px-3 py-2.5 text-sm text-midnight-900 placeholder:text-midnight-400 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]';

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : 'حصل خطأ، حاول تاني';

/**
 * One question with its answers. Used under the lesson (always light, like
 * that page) and in the staff inbox (follows the dashboard theme: `adaptive`).
 */
export function QuestionThread({
  thread,
  viewerIsStaff,
  adaptive = false,
  highlighted = false,
  onSeek,
  onChanged,
  header,
}: {
  thread: LessonQuestionThread;
  viewerIsStaff: boolean;
  adaptive?: boolean;
  highlighted?: boolean;
  onSeek?: (seconds: number) => void;
  onChanged: () => void;
  header?: React.ReactNode;
}) {
  const d = (classes: string) => (adaptive ? classes : '');
  const [replying, setReplying] = useState(viewerIsStaff && thread.status === 'OPEN');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.body);
  const [error, setError] = useState<string | null>(null);
  const answered = thread.status === 'ANSWERED';
  const hasStaffAnswer = thread.replies.some((reply) => reply.fromStaff);

  const reply = useMutation({
    mutationFn: () => api.post(`/lesson-questions/${thread.id}/replies`, { body: text }),
    onMutate: () => setError(null),
    onSuccess: () => {
      setText('');
      setReplying(false);
      onChanged();
    },
    onError: (caught) => setError(errorText(caught)),
  });
  const vote = useMutation({
    mutationFn: () => api.post(`/lesson-questions/${thread.id}/vote`),
    onSuccess: onChanged,
    onError: (caught) => setError(errorText(caught)),
  });
  const save = useMutation({
    mutationFn: () => api.patch(`/lesson-questions/${thread.id}`, { body: draft }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
    onError: (caught) => setError(errorText(caught)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/lesson-questions/${thread.id}`),
    onSuccess: onChanged,
    onError: (caught) => setError(errorText(caught)),
  });
  const removeReply = useMutation({
    mutationFn: (id: string) => api.delete(`/lesson-questions/replies/${id}`),
    onSuccess: onChanged,
    onError: (caught) => setError(errorText(caught)),
  });
  const moderate = useMutation({
    mutationFn: (patch: { pinned?: boolean; hidden?: boolean }) =>
      api.patch(`/admin/lesson-questions/${thread.id}`, patch),
    onSuccess: onChanged,
    onError: (caught) => setError(errorText(caught)),
  });

  const muted = cn('text-midnight-500', d('dark:text-ivory-300/65'));
  const smallButton = cn(
    'min-h-9 rounded-lg px-2.5 text-xs font-bold transition-colors hover:bg-midnight-500/10',
    muted,
  );

  return (
    <article
      id={`question-${thread.id}`}
      className={cn(
        'scroll-mt-28 rounded-2xl border bg-white p-4 transition-shadow sm:p-5',
        d('dark:bg-midnight-950/75'),
        highlighted
          ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]'
          : 'border-ivory-300',
        adaptive && !highlighted && 'dark:border-white/10',
        thread.hidden && 'opacity-60',
      )}
    >
      {header}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={cn('font-black text-midnight-800', d('dark:text-ivory-100'))}>
          {thread.author}
        </span>
        <span className={muted}>{formatRelative(thread.createdAt)}</span>
        {thread.videoSeconds !== null && (
          <button
            type="button"
            onClick={() => onSeek?.(thread.videoSeconds!)}
            disabled={!onSeek}
            className={cn(
              'rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-bold text-[var(--accent)] disabled:cursor-default',
              d('dark:bg-gold-500/15 dark:text-gold-300'),
            )}
            title={onSeek ? 'روح للحظة دي في الفيديو' : undefined}
          >
            ▶ عند {formatDuration(thread.videoSeconds)}
          </button>
        )}
        {thread.pinned && (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
            📌 مثبّت
          </span>
        )}
        {thread.hidden && (
          <span className="rounded-md bg-midnight-500/10 px-2 py-0.5 font-bold">
            مخفي عن الطلاب
          </span>
        )}
        <span
          className={cn(
            'ms-auto rounded-md px-2 py-0.5 font-bold',
            answered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800',
            adaptive &&
              (answered
                ? 'dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'dark:bg-amber-950/30 dark:text-amber-300'),
          )}
        >
          {answered ? 'اتجاوب ✓' : 'مستني رد'}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={2000}
            className={adaptive ? 'input-base resize-y' : LIGHT_FIELD}
            aria-label="عدّل سؤالك"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={draft.trim().length < 3 || save.isPending}
              className="min-h-9 rounded-lg bg-[var(--accent)] px-3 text-xs font-black text-white disabled:opacity-50"
            >
              حفظ
            </button>
            <button type="button" onClick={() => setEditing(false)} className={smallButton}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <p
          className={cn(
            'mt-2 whitespace-pre-line leading-7 text-midnight-900',
            d('dark:text-ivory-50'),
          )}
        >
          {thread.body}
        </p>
      )}

      {thread.replies.length > 0 && (
        <ul
          className={cn(
            'mt-3 space-y-2 border-s-2 border-ivory-300 ps-3',
            d('dark:border-white/10'),
          )}
        >
          {thread.replies.map((item) => (
            <li
              key={item.id}
              className={cn(
                'rounded-xl p-3 text-sm',
                item.fromStaff
                  ? cn('bg-[var(--accent-soft)]', d('dark:bg-gold-500/15'))
                  : cn('bg-ivory-100', d('dark:bg-white/5')),
              )}
            >
              <p className="flex flex-wrap items-center gap-2 text-xs">
                <span className={cn('font-black text-midnight-800', d('dark:text-ivory-100'))}>
                  {item.author}
                </span>
                {item.fromStaff && (
                  <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-black text-white">
                    رد المستر
                  </span>
                )}
                <span className={muted}>
                  {formatRelative(item.createdAt)}
                  {item.edited ? ' (اتعدّل)' : ''}
                </span>
                {(item.mine || viewerIsStaff) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('تمسح الرد ده؟')) removeReply.mutate(item.id);
                    }}
                    className={cn('ms-auto', smallButton)}
                  >
                    مسح
                  </button>
                )}
              </p>
              <p
                className={cn(
                  'mt-1 whitespace-pre-line leading-7 text-midnight-900',
                  d('dark:text-ivory-50'),
                )}
              >
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1">
        {!thread.mine && !viewerIsStaff && (
          <button
            type="button"
            onClick={() => vote.mutate()}
            disabled={vote.isPending}
            aria-pressed={thread.votedByMe}
            className={cn(
              'min-h-9 rounded-lg border px-3 text-xs font-bold transition-colors',
              thread.votedByMe
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-ivory-300 text-midnight-600 hover:border-[var(--accent)]',
            )}
          >
            🙋 عندي نفس السؤال{thread.votes ? ` (${formatNumber(thread.votes)})` : ''}
          </button>
        )}
        {(thread.mine || viewerIsStaff) && thread.votes > 0 && (
          <span className={cn('px-2 text-xs font-bold', muted)}>
            🙋 {formatNumber(thread.votes)} عندهم نفس السؤال
          </span>
        )}
        {(viewerIsStaff || thread.mine) && !replying && (
          <button type="button" onClick={() => setReplying(true)} className={smallButton}>
            {viewerIsStaff ? (hasStaffAnswer ? 'ضيف رد' : 'رد') : 'اكتب متابعة'}
          </button>
        )}
        {thread.mine && !hasStaffAnswer && !editing && (
          <button type="button" onClick={() => setEditing(true)} className={smallButton}>
            تعديل
          </button>
        )}
        {thread.mine && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('تمسح سؤالك؟')) remove.mutate();
            }}
            className={smallButton}
          >
            مسح
          </button>
        )}
        {viewerIsStaff && (
          <>
            <button
              type="button"
              onClick={() => moderate.mutate({ pinned: !thread.pinned })}
              className={smallButton}
            >
              {thread.pinned ? 'إلغاء التثبيت' : 'تثبيت فوق'}
            </button>
            <button
              type="button"
              onClick={() => moderate.mutate({ hidden: !thread.hidden })}
              className={smallButton}
            >
              {thread.hidden ? 'إظهار للطلاب' : 'إخفاء'}
            </button>
          </>
        )}
      </div>

      {replying && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) reply.mutate();
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={3000}
            placeholder={viewerIsStaff ? 'اكتب الرد…' : 'لسه عندك سؤال؟ اكتبه هنا…'}
            className={adaptive ? 'input-base resize-y' : LIGHT_FIELD}
            aria-label="الرد"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!text.trim() || reply.isPending}
              className="min-h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {reply.isPending ? 'بنبعت…' : 'ابعت'}
            </button>
            <button type="button" onClick={() => setReplying(false)} className={smallButton}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}
