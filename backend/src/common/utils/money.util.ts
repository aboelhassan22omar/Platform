/**
 * Money handling. Every amount in this system is an integer number of
 * piastres (قرش) — 1 EGP = 100 piastres. Floating point never touches a price.
 */

export const PIASTRES_PER_POUND = 100;

/** `12550` -> `125.5` (display only; never feed the result back into maths). */
export const minorToMajor = (minor: number): number => minor / PIASTRES_PER_POUND;

/**
 * `125.5` -> `12550`. Rounds half-up, matching how prices are quoted.
 *
 * `major * 100` alone is not enough: 1.005 * 100 is 100.49999999999999 in
 * binary floating point, which would round DOWN to 100 and quietly undercharge.
 * Snapping to 4 decimal places first removes the representation error, then the
 * rounding is the half-up one the contract promises.
 */
export const majorToMinor = (major: number): number =>
  Math.round(Number((major * PIASTRES_PER_POUND).toFixed(4)));

/** Formats for Arabic UI: `١٢٥٫٥٠ ج.م` is handled client-side; this is the API form. */
export const formatEgp = (minor: number): string =>
  `${(minor / PIASTRES_PER_POUND).toFixed(2)} ج.م`;

export type DiscountKind = 'PERCENT' | 'FIXED';

/**
 * Applies a coupon to a subtotal and returns the discount in piastres.
 * Clamped to [0, subtotal] so a coupon can never produce a negative total or
 * pay the student.
 */
export const computeDiscountMinor = (
  subtotalMinor: number,
  kind: DiscountKind,
  value: number,
): number => {
  if (subtotalMinor <= 0 || value <= 0) return 0;

  const raw =
    kind === 'PERCENT'
      ? Math.round((subtotalMinor * Math.min(value, 100)) / 100)
      : Math.round(value);

  return Math.max(0, Math.min(raw, subtotalMinor));
};

/** Sums order lines without ever leaving integer arithmetic. */
export const sumMinor = (amounts: number[]): number =>
  amounts.reduce((total, amount) => total + amount, 0);
