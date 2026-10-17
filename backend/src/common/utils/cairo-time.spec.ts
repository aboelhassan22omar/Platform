import { cairoDayKey, cairoParts, startOfCairoDay } from './cairo-time';

describe('Cairo time', () => {
  it('reads the Cairo calendar day, not the UTC one', () => {
    // 23:30 UTC on 16 Oct is already 17 Oct in Cairo (UTC+3 in summer time).
    expect(cairoDayKey(new Date('2026-10-16T23:30:00Z'))).toBe('2026-10-17');
    expect(cairoParts(new Date('2026-10-16T23:30:00Z'))).toMatchObject({ hour: 2, weekday: 6 });
  });

  it('finds midnight in summer time (UTC+3) and in winter time (UTC+2)', () => {
    expect(startOfCairoDay(new Date('2026-08-10T12:00:00Z')).toISOString()).toBe(
      '2026-08-09T21:00:00.000Z',
    );
    expect(startOfCairoDay(new Date('2026-12-10T12:00:00Z')).toISOString()).toBe(
      '2026-12-09T22:00:00.000Z',
    );
  });

  it('steps whole days', () => {
    const from = startOfCairoDay(new Date('2026-12-10T12:00:00Z'), -6);
    expect(from.toISOString()).toBe('2026-12-03T22:00:00.000Z');
  });
});
