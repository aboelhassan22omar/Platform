import {
  computeDiscountMinor,
  formatEgp,
  majorToMinor,
  minorToMajor,
  sumMinor,
} from './money.util';

describe('money', () => {
  describe('unit conversion', () => {
    it('converts piastres to pounds for display', () => {
      expect(minorToMajor(12550)).toBe(125.5);
    });

    it('converts pounds to piastres for storage', () => {
      expect(majorToMinor(125.5)).toBe(12550);
    });

    it('rounds half-up rather than truncating, so a quoted price is honoured', () => {
      expect(majorToMinor(0.005)).toBe(1);
      expect(majorToMinor(10.994)).toBe(1099);
      expect(majorToMinor(10.995)).toBe(1100);
    });

    it('survives values that float arithmetic handles badly', () => {
      // 0.1 + 0.2 === 0.30000000000000004 in binary floating point. Storing
      // integers is what stops that reaching a student's invoice.
      expect(majorToMinor(0.1) + majorToMinor(0.2)).toBe(30);
      expect(majorToMinor(29.97)).toBe(2997);
      expect(majorToMinor(1.005)).toBe(101);
    });
  });

  describe('formatEgp', () => {
    it('renders with the Egyptian pound suffix', () => {
      expect(formatEgp(12550)).toBe('125.50 ج.م');
    });

    it('renders zero rather than an empty string', () => {
      expect(formatEgp(0)).toBe('0.00 ج.م');
    });
  });

  describe('computeDiscountMinor', () => {
    it('applies a percentage discount', () => {
      expect(computeDiscountMinor(10000, 'PERCENT', 25)).toBe(2500);
    });

    it('applies a fixed discount', () => {
      expect(computeDiscountMinor(10000, 'FIXED', 3000)).toBe(3000);
    });

    it('caps a fixed discount at the subtotal, so an order can never go negative', () => {
      expect(computeDiscountMinor(5000, 'FIXED', 9999999)).toBe(5000);
    });

    it('caps a percentage at 100, so a 500% coupon cannot pay the student', () => {
      expect(computeDiscountMinor(10000, 'PERCENT', 500)).toBe(10000);
    });

    it('returns zero for a non-positive subtotal', () => {
      expect(computeDiscountMinor(0, 'PERCENT', 50)).toBe(0);
      expect(computeDiscountMinor(-100, 'FIXED', 50)).toBe(0);
    });

    it('returns zero for a non-positive discount value', () => {
      expect(computeDiscountMinor(10000, 'PERCENT', 0)).toBe(0);
      expect(computeDiscountMinor(10000, 'FIXED', -50)).toBe(0);
    });

    it('rounds a percentage to whole piastres', () => {
      // 33% of 999 piastres is 329.67 — money cannot hold a fraction of a piastre.
      expect(computeDiscountMinor(999, 'PERCENT', 33)).toBe(330);
      expect(Number.isInteger(computeDiscountMinor(999, 'PERCENT', 33))).toBe(true);
    });

    it('a 100% coupon makes the order free but never negative', () => {
      const subtotal = 45000;
      const discount = computeDiscountMinor(subtotal, 'PERCENT', 100);
      expect(discount).toBe(subtotal);
      expect(subtotal - discount).toBe(0);
    });
  });

  describe('sumMinor', () => {
    it('sums order lines in integer arithmetic', () => {
      expect(sumMinor([3500, 3500, 4500])).toBe(11500);
    });

    it('sums an empty basket to zero', () => {
      expect(sumMinor([])).toBe(0);
    });

    it('stays exact across many lines, where floats would drift', () => {
      const lines = Array.from({ length: 1000 }, () => 10);
      expect(sumMinor(lines)).toBe(10000);
    });
  });
});
