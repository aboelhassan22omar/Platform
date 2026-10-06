import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration.
 *
 * These tests run against the RUNNING Docker stack rather than spawning their
 * own server, because the things worth testing here — entitlement enforcement,
 * webhook settlement, HLS playback — only exist when the whole stack is up:
 *
 *   docker compose up -d --build
 *   npm test
 *
 * The mobile projects are not decoration: mobile is the primary target for
 * this audience, so the journey is exercised at phone width as a first-class
 * case, not as an afterthought.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:7080';

/**
 * Origin for the API-contract suite.
 *
 * Those tests exercise API SEMANTICS, so they talk to the backend directly and
 * skip nginx. The edge has its own rate limiter (2 req/s on auth routes) which
 * is correct in production but would throttle a fast automated suite coming
 * from one IP — and throttling is not what that suite is measuring.
 *
 * The browser suites deliberately go through the proxy, because the user path
 * is what they are testing.
 */
export const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:7400';

/**
 * Use the full Chromium build rather than the lighter headless shell.
 *
 * Both render identically for these assertions, and pinning to `chromium`
 * avoids depending on a second browser download that is easy to miss in a
 * fresh checkout or a restricted network.
 */
const CHROMIUM = { channel: 'chromium' as const };

export default defineConfig({
  testDir: './specs',
  // Entitlement tests mutate shared server state, so they run in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The UI is Arabic and RTL; the browser should agree.
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], ...CHROMIUM, viewport: { width: 1440, height: 900 } },
    },
    {
      // A small Android — the hardest realistic layout constraint.
      name: 'mobile-360',
      use: {
        ...devices['Pixel 5'],
        ...CHROMIUM,
        viewport: { width: 360, height: 800 },
      },
    },
    {
      // iPhone 13 geometry. NOTE: this runs the Chromium engine, not WebKit, so
      // it validates LAYOUT at iPhone dimensions rather than Safari behaviour.
      // Safari-specific checks — native HLS playback in particular — still need
      // a manual pass on a real device. See docs/operations/testing.md.
      name: 'mobile-390',
      use: {
        ...devices['Pixel 5'],
        ...CHROMIUM,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        ...CHROMIUM,
        viewport: { width: 768, height: 1024 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
});
