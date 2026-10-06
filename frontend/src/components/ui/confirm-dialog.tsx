'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './button';
import { modalPanel, overlayBackdrop } from '@/lib/motion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation for destructive administrative actions.
 *
 * Focus moves to the dialog on open and returns to the trigger on close,
 * Escape cancels, and the page behind is locked — the things that make a modal
 * usable with a keyboard rather than just visible.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'إلغاء',
  destructive,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Defer so the panel exists before focus is moved into it.
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onCancel();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      restoreFocusRef.current?.focus();
    };
  }, [open, isPending, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <motion.div
            variants={overlayBackdrop}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={() => !isPending && onCancel()}
            className="absolute inset-0 bg-midnight-950/55 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            variants={modalPanel}
            initial="hidden"
            animate="visible"
            exit="hidden"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
            className="relative w-full max-w-md rounded-2xl border border-ivory-300 bg-white p-6 shadow-2xl"
          >
            <h2 id="confirm-title" className="font-display text-lg font-black text-midnight-900">
              {title}
            </h2>
            <p id="confirm-body" className="mt-2 text-sm leading-relaxed text-midnight-600">
              {body}
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
              <Button
                variant={destructive ? 'danger' : 'accent'}
                onClick={onConfirm}
                isLoading={isPending}
                fullWidth
              >
                {confirmLabel}
              </Button>
              <Button
                variant="ghost"
                onClick={onCancel}
                disabled={isPending}
                fullWidth
                data-autofocus
              >
                {cancelLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
