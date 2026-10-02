'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { formatNumber, toArabicDigits } from '@/lib/utils';

interface CounterProps {
  value: number;
  /** Rendered before/after the number, e.g. a currency suffix. */
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  className?: string;
  /** Eastern-Arabic digits. Off for figures that sit in tables. */
  arabicDigits?: boolean;
}

/**
 * Counts up to `value` when scrolled into view.
 *
 * Driven by requestAnimationFrame rather than a spring so the final frame
 * lands exactly on the target — an animated statistic that settles on 1,247
 * when the real number is 1,248 is worse than no animation.
 *
 * Under prefers-reduced-motion the final value renders immediately.
 */
export function AnimatedCounter({
  value,
  suffix,
  prefix,
  durationMs = 1400,
  className,
  arabicDigits = true,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // easeOutExpo: fast at first, settling gently onto the final number.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, durationMs, prefersReduced]);

  const text = arabicDigits ? formatNumber(display) : toArabicDigits(display);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
