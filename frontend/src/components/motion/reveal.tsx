'use client';

import { motion, type Variants } from 'motion/react';
import { fadeUp, revealOnScroll, staggerContainer } from '@/lib/motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  as?: 'div' | 'section' | 'article' | 'li' | 'header';
}

/**
 * Animates its children in once, when they scroll into view.
 *
 * `once: true` is the important part — re-running on every scroll past is what
 * makes heavily animated pages exhausting to use.
 */
export function Reveal({
  children,
  className,
  variants = fadeUp,
  delay = 0,
  as = 'div',
}: RevealProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={variants}
      transition={delay ? { delay } : undefined}
      {...revealOnScroll}
    >
      {children}
    </Component>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: 'div' | 'ul' | 'section';
}

/** Parent that releases its <Reveal> / motion children in sequence. */
export function StaggerGroup({
  children,
  className,
  stagger = 0.08,
  delay = 0,
  as = 'div',
}: StaggerProps) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={staggerContainer(stagger, delay)}
      {...revealOnScroll}
    >
      {children}
    </Component>
  );
}
