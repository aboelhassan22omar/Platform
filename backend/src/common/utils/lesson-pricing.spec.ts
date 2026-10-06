import { lessonPriceFor } from './lesson-pricing';

describe('student lesson prices', () => {
  it.each([
    ['ONLINE', null, 10000],
    ['CENTER', null, 10000],
    ['ONLINE', 5000, 10000],
    ['CENTER', 5000, 5000],
    ['ONLINE', 0, 10000],
    ['CENTER', 0, 0],
  ] as const)(
    'prices %s with center override %s at %s',
    (studentType, centerPriceMinor, expected) => {
      expect(
        lessonPriceFor({ priceMinor: 10000, centerPriceMinor, isFreePreview: false }, studentType),
      ).toBe(expected);
    },
  );
  it('a global free lesson is free for both groups', () => {
    for (const type of ['ONLINE', 'CENTER'] as const)
      expect(
        lessonPriceFor({ priceMinor: 10000, centerPriceMinor: 5000, isFreePreview: true }, type),
      ).toBe(0);
  });
});
