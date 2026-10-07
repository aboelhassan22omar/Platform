import { test, expect } from '@playwright/test';
import { presenceIntervalSeconds } from '../../../frontend/src/components/providers/presence-interval';

test('missing and unsafe build values cannot create a continuous heartbeat flood', () => {
  for (const value of [undefined, '', ' ', '0', '-1', '1', '9', 'NaN', 'Infinity']) {
    expect(presenceIntervalSeconds(value)).toBe(45);
  }
  expect(presenceIntervalSeconds('45')).toBe(45);
  expect(presenceIntervalSeconds('60')).toBe(60);
});
