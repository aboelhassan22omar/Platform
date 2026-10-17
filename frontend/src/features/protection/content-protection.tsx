'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useProtection } from './use-protection';

type Shield = 'away' | 'capture' | null;

/** Pages a student is meant to print or share, e.g. their own certificate. */
const UNPROTECTED_PATHS = ['/certificates'];

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Screenshot / screen-recording deterrents for students, switched on by the
 * admin. A browser cannot block the operating system's capture tools, so this
 * does what a page can: it hides the content whenever the page loses focus
 * (the Windows snipping tool, macOS screenshot UI and screen-recorder controls
 * all take focus), reacts to PrintScreen and the capture shortcuts, and turns
 * off copy, right-click, drag, save and print. The moving watermark (see
 * Watermark) covers what slips through: a leak still names the student.
 */
export function ContentProtection() {
  const { blockCapture } = useProtection();
  const pathname = usePathname();
  const active = blockCapture && !UNPROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const [shield, setShield] = useState<Shield>(null);
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    if (!active) {
      setShield(null);
      return;
    }
    const root = document.documentElement;
    root.classList.add('protect-content');

    let captureTimer: number | undefined;
    const flashCapture = () => {
      setShield('capture');
      window.clearTimeout(captureTimer);
      captureTimer = window.setTimeout(
        () => setShield((current) => (current === 'capture' ? null : current)),
        2500,
      );
    };
    const block = (event: Event) => {
      if (!isEditable(event.target)) event.preventDefault();
    };
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'printscreen') {
        event.preventDefault();
        // Overwrite what the key just put on the clipboard (Windows).
        void navigator.clipboard?.writeText('').catch(() => undefined);
        flashCapture();
        return;
      }
      // ⌘⇧3/4/5 on macOS, Win+Shift+S on Windows: the page sees the modifiers
      // a moment before the system tool takes the picture.
      if (event.type === 'keydown' && event.metaKey && event.shiftKey) {
        flashCapture();
        return;
      }
      if (event.type !== 'keydown') return;
      const mod = event.ctrlKey || event.metaKey;
      if (
        key === 'f12' ||
        (mod && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (mod && ['s', 'p', 'u'].includes(key))
      )
        event.preventDefault();
    };
    const away = () => setShield('away');
    const back = () => setShield((current) => (current === 'away' ? null : current));
    const onVisibility = () => (document.hidden ? away() : back());

    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('dragstart', block);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKey, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    window.addEventListener('beforeprint', flashCapture);
    if (!document.hasFocus()) away();

    return () => {
      root.classList.remove('protect-content');
      window.clearTimeout(captureTimer);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('dragstart', block);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKey, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
      window.removeEventListener('beforeprint', flashCapture);
    };
  }, [active]);

  // In fullscreen only the fullscreen element is painted: the shield goes inside it.
  useEffect(() => {
    if (!active) return;
    const place = () => setHost(document.fullscreenElement ?? document.body);
    place();
    document.addEventListener('fullscreenchange', place);
    return () => document.removeEventListener('fullscreenchange', place);
  }, [active]);

  if (!active || !shield || !host) return null;
  return createPortal(
    <div
      role="alert"
      onPointerDown={() => setShield(null)}
      className="fixed inset-0 z-[1000] grid place-items-center bg-midnight-950 p-6 text-center text-ivory-50"
    >
      <div className="max-w-sm">
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold-500/15 text-3xl"
          aria-hidden
        >
          🔒
        </span>
        <p className="mt-4 font-display text-xl font-black">
          {shield === 'capture' ? 'تصوير الشاشة مش مسموح' : 'المحتوى محمي'}
        </p>
        <p className="mt-2 text-sm leading-6 text-ivory-200/75">
          {shield === 'capture'
            ? 'المحتوى ده خاص بحسابك، وأي تسريب بيبان عليه اسمك ورقمك.'
            : 'ارجع للصفحة عشان تكمّل. المحتوى بيستخبى لما تسيب الصفحة.'}
        </p>
      </div>
    </div>,
    host,
  );
}
