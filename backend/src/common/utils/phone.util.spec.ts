import {
  formatEgyptianPhone,
  isValidEgyptianPhone,
  maskPhone,
  normalizeEgyptianPhone,
  toAsciiDigits,
} from './phone.util';

describe('Egyptian phone handling', () => {
  describe('toAsciiDigits', () => {
    it('converts Eastern-Arabic digits students type on an Arabic keypad', () => {
      expect(toAsciiDigits('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678');
    });

    it('converts Persian digits', () => {
      expect(toAsciiDigits('۰۱۰۱۲۳۴۵۶۷۸')).toBe('01012345678');
    });

    it('leaves ASCII untouched', () => {
      expect(toAsciiDigits('01012345678')).toBe('01012345678');
    });
  });

  describe('normalizeEgyptianPhone', () => {
    it.each([
      ['01012345678', '01012345678'],
      ['+201012345678', '01012345678'],
      ['00201012345678', '01012345678'],
      ['201012345678', '01012345678'],
      ['1012345678', '01012345678'],
      ['٠١٠١٢٣٤٥٦٧٨', '01012345678'],
      ['010 1234 5678', '01012345678'],
      ['010-1234-5678', '01012345678'],
      ['(010) 1234 5678', '01012345678'],
      ['  01012345678  ', '01012345678'],
    ])('normalises %s to %s', (input, expected) => {
      expect(normalizeEgyptianPhone(input)).toBe(expected);
    });

    it.each([
      ['0101234567', 'too short'],
      ['010123456789', 'too long'],
      ['01712345678', 'operator prefix 017 does not exist'],
      ['01312345678', 'operator prefix 013 does not exist'],
      ['02012345678', 'landline prefix'],
      ['', 'empty'],
      ['not a phone', 'non-numeric'],
      ['+441012345678', 'wrong country'],
    ])('rejects %s (%s)', (input) => {
      expect(normalizeEgyptianPhone(input)).toBeNull();
    });

    it.each(['010', '011', '012', '015'])('accepts the %s operator prefix', (prefix) => {
      expect(normalizeEgyptianPhone(`${prefix}12345678`)).toBe(`${prefix}12345678`);
    });
  });

  describe('isValidEgyptianPhone', () => {
    it('accepts a valid number', () => {
      expect(isValidEgyptianPhone('+20 101 234 5678')).toBe(true);
    });

    it('rejects an invalid one', () => {
      expect(isValidEgyptianPhone('01712345678')).toBe(false);
    });
  });

  describe('formatEgyptianPhone', () => {
    it('groups the digits for display', () => {
      expect(formatEgyptianPhone('01012345678')).toBe('0101 234 5678');
    });

    it('returns the input unchanged when it cannot be parsed', () => {
      expect(formatEgyptianPhone('garbage')).toBe('garbage');
    });
  });

  describe('maskPhone', () => {
    it('hides the middle digits for logs and support views', () => {
      expect(maskPhone('01012345678')).toBe('0101***5678');
    });

    it('never leaks digits from an unparseable value', () => {
      expect(maskPhone('01712345678')).toBe('***');
    });
  });
});
