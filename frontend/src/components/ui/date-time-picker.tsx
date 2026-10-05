'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn, toArabicDigits } from '@/lib/utils';

/**
 * Themed replacement for <input type="datetime-local">.
 *
 * The native picker is drawn by the browser and cannot be styled, so it ignores
 * the archive palette, dark mode and per-grade accents. This one reads the same
 * semantic tokens as the rest of the UI (--accent, --surface-raised, …).
 *
 * The value format is deliberately identical to datetime-local
 * ("YYYY-MM-DDTHH:mm", browser-local time), so callers keep their existing
 * `new Date(value).toISOString()` conversion unchanged.
 */

interface Parts {
  y: number;
  m: number; // 0-based month
  d: number;
  h: number; // 0–23
  min: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

const parse = (value: string | undefined | null): Parts | null => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  return { y, m: m - 1, d, h, min };
};

const serialize = (p: Parts) => `${p.y}-${pad(p.m + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;

/** ISO (UTC) → datetime-local style value in the browser's zone. */
export const isoToLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return serialize({ y: date.getFullYear(), m: date.getMonth(), d: date.getDate(), h: date.getHours(), min: date.getMinutes() });
};

const sameDay = (a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }) =>
  a.y === b.y && a.m === b.m && a.d === b.d;

const dayKey = (y: number, m: number, d: number) => y * 10_000 + m * 100 + d;

/** Egypt's week starts on Saturday. */
const WEEKDAYS = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];
const MINUTE_PRESETS = [0, 15, 30, 45];

const monthTitle = (y: number, m: number) =>
  new Date(y, m, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

const formatDisplay = (p: Parts) =>
  new Date(p.y, p.m, p.d, p.h, p.min).toLocaleString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const defaultTime = () => {
  // Next half hour from now — a sensible starting point for scheduling.
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.min(Math.ceil((total + 1) / 30) * 30, 23 * 60 + 30);
  return { h: Math.floor(rounded / 60), min: rounded % 60 };
};

interface DateTimePickerProps {
  id?: string;
  /** For uncontrolled use inside a <form>: rendered as a hidden input. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Visual style of the trigger — matches the surrounding inputs. */
  className?: string;
  /** Grey out days before today. */
  disablePast?: boolean;
  disabled?: boolean;
}

export function DateTimePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = 'اختار اليوم والساعة',
  className = 'editor-input',
  disablePast = false,
  disabled = false,
}: DateTimePickerProps) {
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const dialogId = `${autoId}-dialog`;

  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = isControlled ? value : inner;
  const parts = parse(current);

  const commit = useCallback(
    (next: Parts | null) => {
      const serialized = next ? serialize(next) : '';
      if (!isControlled) setInner(serialized);
      onChange?.(serialized);
    },
    [isControlled, onChange],
  );

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [themeKey, setThemeKey] = useState<string | null>(null);

  const today = useMemo(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    // Recomputed whenever the panel opens so a long-lived page stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [view, setView] = useState(() => (parts ? { y: parts.y, m: parts.m } : { y: today.y, m: today.m }));
  const [focusDay, setFocusDay] = useState<{ y: number; m: number; d: number }>(parts ?? today);

  const openPanel = () => {
    if (disabled) return;
    const start = parts ?? today;
    setView({ y: start.y, m: start.m });
    setFocusDay({ y: start.y, m: start.m, d: start.d });
    // The panel is portalled to <body>; carry the per-grade accent with it.
    setThemeKey(triggerRef.current?.closest('[data-theme]')?.getAttribute('data-theme') ?? null);
    setOpen(true);
  };

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // --- Positioning: below the trigger, flipped above when there is no room.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const margin = 12;
    const { offsetWidth: w, offsetHeight: h } = panel;
    let top = rect.bottom + gap;
    if (top + h > window.innerHeight - margin) {
      // Flip above when it fits there; otherwise pin to the bottom edge so the
      // footer buttons are never cut off on short screens.
      top = rect.top - gap - h > margin ? rect.top - gap - h : window.innerHeight - h - margin;
    }
    // RTL: align the panel's right edge with the trigger's right edge.
    const left = Math.min(Math.max(rect.right - w, margin), window.innerWidth - w - margin);
    setPosition({ top: Math.max(top, margin), left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // --- Dismissal: outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  // Move keyboard focus into the day grid once the panel is placed.
  useEffect(() => {
    if (open && position) {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]')?.focus({ preventScroll: true });
    }
    // Only on first placement, not on every reposition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position === null]);

  // --- Calendar cells: always 6 weeks so the panel height never jumps.
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const offset = (first.getDay() + 1) % 7; // Saturday = column 0
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(view.y, view.m, 1 - offset + i);
      return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate(), inMonth: date.getMonth() === view.m };
    });
  }, [view]);

  const todayKey = dayKey(today.y, today.m, today.d);
  const isPast = (c: { y: number; m: number; d: number }) => disablePast && dayKey(c.y, c.m, c.d) < todayKey;

  const shiftMonth = (delta: number) => {
    const date = new Date(view.y, view.m + delta, 1);
    setView({ y: date.getFullYear(), m: date.getMonth() });
    setFocusDay((f) => {
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return { y: date.getFullYear(), m: date.getMonth(), d: Math.min(f.d, last) };
    });
  };

  const pickDay = (c: { y: number; m: number; d: number }) => {
    if (isPast(c)) return;
    const time = parts ? { h: parts.h, min: parts.min } : defaultTime();
    commit({ y: c.y, m: c.m, d: c.d, ...time });
    setFocusDay(c);
    if (c.m !== view.m || c.y !== view.y) setView({ y: c.y, m: c.m });
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    // RTL: the visual "next day" is to the left.
    const moves: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 };
    if (event.key in moves) {
      event.preventDefault();
      const date = new Date(focusDay.y, focusDay.m, focusDay.d + moves[event.key]);
      const next = { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
      setFocusDay(next);
      if (next.m !== view.m || next.y !== view.y) setView({ y: next.y, m: next.m });
      requestAnimationFrame(() =>
        gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]')?.focus({ preventScroll: true }),
      );
    }
  };

  // --- Time editing. Changing the time before a day is picked assumes today.
  const base = (): Parts => parts ?? { ...today, ...defaultTime() };
  const hour12 = parts ? parts.h % 12 || 12 : null;
  const isPm = parts ? parts.h >= 12 : false;

  const stepHour = (delta: number) => {
    const p = base();
    commit({ ...p, h: (p.h + delta + 24) % 24 });
  };
  const stepMinute = (delta: number) => {
    const p = base();
    const total = (p.h * 60 + Math.round(p.min / 5) * 5 + delta + 1440) % 1440;
    commit({ ...p, h: Math.floor(total / 60), min: total % 60 });
  };
  const setMinute = (min: number) => commit({ ...base(), min });
  const setMeridiem = (pm: boolean) => {
    const p = base();
    if (pm === p.h >= 12) return;
    commit({ ...p, h: pm ? p.h + 12 : p.h - 12 });
  };

  const goToday = () => {
    const time = parts ? { h: parts.h, min: parts.min } : defaultTime();
    commit({ ...today, ...time });
    setView({ y: today.y, m: today.m });
    setFocusDay(today);
  };

  const iconButton =
    'grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]';

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label="اختيار اليوم والساعة"
          data-theme={themeKey ?? undefined}
          dir="rtl"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top: position?.top ?? -9999,
            left: position?.left ?? -9999,
            visibility: position ? 'visible' : 'hidden',
          }}
          className="z-[200] w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] font-arabic text-[color:var(--text-primary)] shadow-[var(--shadow-lifted)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="الشهر اللي فات" className={iconButton}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p aria-live="polite" className="font-display text-base font-black">
              {monthTitle(view.y, view.m)}
            </p>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="الشهر الجاي" className={iconButton}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Calendar */}
          <div className="px-3 pb-3 pt-2">
            <div className="grid grid-cols-7 pb-1" aria-hidden>
              {WEEKDAYS.map((day) => (
                <span key={day} className="py-1.5 text-center text-[10.5px] font-bold text-[color:var(--text-muted)]">
                  {day}
                </span>
              ))}
            </div>
            <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
              {cells.map((c) => {
                const selected = parts ? sameDay(parts, c) : false;
                const isToday = dayKey(c.y, c.m, c.d) === todayKey;
                const past = isPast(c);
                const focused = sameDay(focusDay, c);
                return (
                  <button
                    key={`${c.y}-${c.m}-${c.d}`}
                    type="button"
                    role="gridcell"
                    tabIndex={focused ? 0 : -1}
                    data-focus={focused}
                    disabled={past}
                    aria-selected={selected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={new Date(c.y, c.m, c.d).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    onClick={() => pickDay(c)}
                    className={cn(
                      'relative grid aspect-square place-items-center rounded-xl text-sm font-bold tabular-nums transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]',
                      selected
                        ? 'bg-[var(--accent)] text-[color:var(--accent-contrast)] shadow-[0_6px_16px_-8px_var(--accent)]'
                        : 'hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]',
                      !selected && !c.inMonth && 'text-[color:var(--text-muted)] opacity-45',
                      !selected && isToday && 'text-[color:var(--accent)] ring-1 ring-inset ring-[color:var(--accent)]',
                      past && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                    )}
                  >
                    {toArabicDigits(String(c.d))}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div className="border-t border-[color:var(--border-subtle)] bg-[var(--surface-sunken)]/40 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black text-[color:var(--text-secondary)]">الساعة</span>
              <div dir="ltr" className="flex items-center gap-1.5">
                <TimeStepper
                  label="الساعة"
                  value={hour12 === null ? '--' : toArabicDigits(String(hour12))}
                  onUp={() => stepHour(1)}
                  onDown={() => stepHour(-1)}
                />
                <span className="pb-0.5 text-lg font-black text-[color:var(--text-muted)]">:</span>
                <TimeStepper
                  label="الدقيقة"
                  value={parts ? toArabicDigits(pad(parts.min)) : '--'}
                  onUp={() => stepMinute(5)}
                  onDown={() => stepMinute(-5)}
                />
                <div role="radiogroup" aria-label="صباحًا أو مساءً" className="ms-1.5 grid overflow-hidden rounded-lg border border-[color:var(--border-subtle)]">
                  {[
                    { pm: false, label: 'ص', title: 'صباحًا' },
                    { pm: true, label: 'م', title: 'مساءً' },
                  ].map((option) => {
                    const active = parts !== null && isPm === option.pm;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={option.title}
                        onClick={() => setMeridiem(option.pm)}
                        className={cn(
                          'h-[1.4rem] w-9 text-xs font-black transition-colors',
                          active
                            ? 'bg-[var(--accent)] text-[color:var(--accent-contrast)]'
                            : 'text-[color:var(--text-secondary)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]',
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[color:var(--text-muted)]">الدقايق</span>
              <div dir="ltr" className="flex gap-1">
                {MINUTE_PRESETS.map((min) => {
                  const active = parts?.min === min;
                  return (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setMinute(min)}
                      aria-pressed={active}
                      className={cn(
                        'h-7 min-w-10 rounded-lg border px-2 text-xs font-bold tabular-nums transition-colors',
                        active
                          ? 'border-[color:var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[color:var(--accent)]'
                          : 'border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--accent)]',
                      )}
                    >
                      {toArabicDigits(pad(min))}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-subtle)] px-3 py-2.5">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={goToday}
                className="h-9 rounded-lg px-3 text-xs font-black text-[color:var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
              >
                النهارده
              </button>
              <button
                type="button"
                onClick={() => {
                  commit(null);
                  close();
                }}
                className="h-9 rounded-lg px-3 text-xs font-bold text-[color:var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              >
                مسح
              </button>
            </div>
            <button
              type="button"
              onClick={() => close()}
              className="h-9 rounded-lg bg-[var(--accent)] px-5 text-xs font-black text-[color:var(--accent-contrast)] transition-opacity hover:opacity-90"
            >
              تم
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => (open ? close(false) : openPanel())}
        className={cn(
          className,
          'flex items-center gap-2.5 text-start disabled:cursor-not-allowed disabled:opacity-50',
          parts && 'pe-10',
          open && 'border-[color:var(--accent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]',
        )}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0 text-[color:var(--accent)]">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="13.5" cy="13" r="1.25" fill="currentColor" />
        </svg>
        <span className={cn('min-w-0 flex-1 truncate', !parts && 'text-[color:var(--text-muted)] opacity-80')}>
          {parts ? formatDisplay(parts) : placeholder}
        </span>
      </button>
      {parts && !disabled && (
        <button
          type="button"
          onClick={() => commit(null)}
          aria-label="مسح التاريخ"
          className="absolute inset-y-0 end-1.5 my-auto grid h-8 w-8 place-items-center rounded-lg text-[color:var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  );
}

function TimeStepper({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  const arrow =
    'grid h-[1.15rem] w-full place-items-center text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--accent)]';
  return (
    <div
      role="spinbutton"
      aria-label={label}
      aria-valuetext={value}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onUp();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          onDown();
        }
      }}
      className="flex w-12 flex-col items-center overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      <button type="button" tabIndex={-1} onClick={onUp} aria-label={`زوّد ${label}`} className={arrow}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 6.5L5 3.5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="font-display text-base font-black leading-6 tabular-nums">{value}</span>
      <button type="button" tabIndex={-1} onClick={onDown} aria-label={`قلّل ${label}`} className={arrow}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M2 3.5L5 6.5l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
