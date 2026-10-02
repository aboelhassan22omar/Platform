import type { Transition, Variants } from 'motion/react';

/**
 * The platform's motion vocabulary.
 *
 * Extensive animation is an explicit requirement here, so the risk is not
 * "too little movement" — it is incoherence and jank. Everything below obeys
 * three rules:
 *
 *   1. Only `transform` and `opacity` are animated. Those are the two
 *      properties the compositor can handle without laying out the page
 *      again, which is what keeps scrolling smooth on a mid-range Android.
 *   2. One easing vocabulary, shared with the CSS custom properties in
 *      globals.css, so CSS transitions and JS animations agree.
 *   3. Every distance is small. Premium motion is short, fast and
 *      confident; long slow travel reads as sluggish.
 *
 * Reduced motion is handled globally by MotionProvider (see
 * components/providers/motion-provider.tsx), which sets Motion's
 * `reducedMotion: 'user'`. That makes Motion drop transform animations and
 * keep opacity — so nothing moves, but state changes stay perceivable.
 * Individual components must not re-implement that check.
 */

// ---------------------------------------------------------------------------
// Easing + duration
// ---------------------------------------------------------------------------

/** Decelerating. Things arriving on screen. */
export const EASE_ENTRANCE = [0.16, 1, 0.3, 1] as const;
/** Accelerating. Things leaving. */
export const EASE_EXIT = [0.7, 0, 0.84, 0] as const;
/** Symmetric. State changes that stay put. */
export const EASE_SMOOTH = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  instant: 0.12,
  fast: 0.22,
  base: 0.38,
  slow: 0.62,
  cinematic: 1.1,
} as const;

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

// ---------------------------------------------------------------------------
// Entrances
// ---------------------------------------------------------------------------

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_ENTRANCE } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_ENTRANCE },
  },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_ENTRANCE },
  },
};

/**
 * RTL note: "start" is the right-hand side. Positive x moves an element
 * further right, i.e. further from its resting place in an RTL layout, so
 * this slides in from the reading-start edge.
 */
export const slideFromStart: Variants = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.base, ease: EASE_ENTRANCE },
  },
};

export const slideFromEnd: Variants = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.base, ease: EASE_ENTRANCE },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.base, ease: EASE_ENTRANCE },
  },
};

/** Cinematic hero entrance: a touch more travel and a slower curve. */
export const heroReveal: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.cinematic, ease: EASE_ENTRANCE },
  },
};

// ---------------------------------------------------------------------------
// Staggering
// ---------------------------------------------------------------------------

/**
 * Parent container that releases its children in sequence.
 * `delayChildren` gives the parent's own entrance time to land first.
 */
export const staggerContainer = (stagger = 0.08, delay = 0): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

/** Reverses the order — used when a list collapses. */
export const staggerContainerReverse = (stagger = 0.05): Variants => ({
  hidden: { opacity: 0, transition: { staggerChildren: stagger, staggerDirection: -1 } },
  visible: { opacity: 1, transition: { staggerChildren: stagger } },
});

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

/**
 * Card hover. `whileHover` only lifts on devices that actually hover —
 * Motion leaves it alone on touch, so a tap does not leave a card stuck in
 * its hovered state.
 */
export const cardHover = {
  whileHover: { y: -6, transition: springSnappy },
  whileTap: { scale: 0.985, transition: { duration: DURATION.instant } },
};

export const buttonPress = {
  whileHover: { scale: 1.02, transition: springSnappy },
  whileTap: { scale: 0.97, transition: { duration: DURATION.instant } },
};

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

export const overlayBackdrop: Variants = {
  hidden: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_EXIT } },
  visible: { opacity: 1, transition: { duration: DURATION.fast, ease: EASE_SMOOTH } },
};

export const modalPanel: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 12,
    transition: { duration: DURATION.fast, ease: EASE_EXIT },
  },
  visible: { opacity: 1, scale: 1, y: 0, transition: springSoft },
};

/** Mobile sheet: rises from the bottom edge, which is where the thumb is. */
export const sheetPanel: Variants = {
  hidden: { y: '100%', transition: { duration: DURATION.base, ease: EASE_EXIT } },
  visible: { y: 0, transition: { duration: DURATION.base, ease: EASE_ENTRANCE } },
};

/** RTL drawer: slides in from the right edge. */
export const drawerPanel: Variants = {
  hidden: { x: '100%', transition: { duration: DURATION.base, ease: EASE_EXIT } },
  visible: { x: 0, transition: { duration: DURATION.base, ease: EASE_ENTRANCE } },
};

// ---------------------------------------------------------------------------
// Route transitions
// ---------------------------------------------------------------------------

/** Deliberately restrained — a page change should not cost the user time. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.fast, ease: EASE_ENTRANCE },
  },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.instant, ease: EASE_EXIT } },
};

// ---------------------------------------------------------------------------
// Scroll reveal defaults
// ---------------------------------------------------------------------------

/**
 * Shared `whileInView` configuration.
 *
 * `once: true` matters: re-animating on every scroll-by is the single most
 * common way an animated page becomes irritating to actually use.
 * The negative bottom margin starts the animation slightly before the element
 * reaches the viewport, so it has finished by the time it is properly visible.
 */
export const revealOnScroll = {
  initial: 'hidden' as const,
  whileInView: 'visible' as const,
  viewport: { once: true, margin: '0px 0px -12% 0px' },
};
