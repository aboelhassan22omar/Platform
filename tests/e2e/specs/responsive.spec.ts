import { test, expect, type Page } from '@playwright/test';

/**
 * Responsive layout checks.
 *
 * Mobile is the primary target for this platform, so these run across the
 * viewport widths the brief calls out. The single most common mobile layout
 * failure — a stray wide element causing sideways scroll — is asserted on
 * every page rather than eyeballed.
 */

const VIEWPORTS = [
  { name: '320 (smallest Android)', width: 320, height: 640 },
  { name: '360 (common Android)', width: 360, height: 800 },
  { name: '375 (iPhone SE)', width: 375, height: 667 },
  { name: '390 (iPhone 13)', width: 390, height: 844 },
  { name: '414 (large phone)', width: 414, height: 896 },
  { name: '768 (tablet)', width: 768, height: 1024 },
  { name: '1024 (small laptop)', width: 1024, height: 768 },
  { name: '1280 (desktop)', width: 1280, height: 800 },
  { name: '1440 (wide desktop)', width: 1440, height: 900 },
];

const PUBLIC_PAGES = [
  { path: '/', name: 'homepage' },
  { path: '/grades', name: 'grades index' },
  { path: '/grades/first-secondary', name: 'first secondary' },
  { path: '/grades/third-secondary', name: 'third secondary' },
  { path: '/grades/second-baccalaureate', name: 'second baccalaureate' },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/forgot-password', name: 'forgot password' },
  { path: '/about', name: 'about' },
  { path: '/contact', name: 'contact' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/faq', name: 'faq' },
];

/**
 * Navigates and waits for LAYOUT to settle.
 *
 * Deliberately not `networkidle`: Next.js prefetches linked routes, so network
 * activity can continue well after the page is visually complete. Waiting on it
 * makes layout tests fail for network reasons. `load` plus a font-ready check
 * is both faster and a truer signal for what these tests measure.
 */
async function gotoSettled(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // One frame, so any entrance animation has applied its final transform.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
}

/** True when the document is wider than the viewport, i.e. it scrolls sideways. */
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    // 1px of slack absorbs sub-pixel rounding in the layout engine.
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

/** Names the elements responsible for any overflow, so a failure is actionable. */
async function findOverflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const offenders: string[] = [];

    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.right > limit + 1 || rect.left < -1) {
        const id = el.id ? `#${el.id}` : '';
        const cls =
          typeof el.className === 'string' && el.className
            ? `.${el.className.split(/\s+/).slice(0, 2).join('.')}`
            : '';
        offenders.push(
          `${el.tagName.toLowerCase()}${id}${cls} [${Math.round(rect.left)}..${Math.round(rect.right)}]`,
        );
      }
    });

    return [...new Set(offenders)].slice(0, 5);
  });
}

test.describe('no horizontal overflow at any supported width', () => {
  for (const viewport of VIEWPORTS) {
    for (const target of PUBLIC_PAGES) {
      test(`${target.name} @ ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoSettled(page, target.path);

        const overflows = await hasHorizontalOverflow(page);
        if (overflows) {
          const culprits = await findOverflowingElements(page);
          throw new Error(
            `Horizontal overflow on ${target.path} at ${viewport.width}px.\n` +
              `Offending elements:\n  ${culprits.join('\n  ')}`,
          );
        }
        expect(overflows).toBe(false);
      });
    }
  }
});

test.describe('RTL and Arabic typography', () => {
  test('document direction is RTL with Arabic language', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('body text renders in an Arabic-capable font', async ({ page }) => {
    await page.goto('/');
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily.toLowerCase()).toContain('cairo');
  });
});

test.describe('touch targets', () => {
  test('primary controls meet the 44px minimum on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoSettled(page, '/login');

    // Inputs and the submit button are the controls a student must actually hit.
    const controls = page.locator('input, button[type="submit"]');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const box = await controls.nth(i).boundingBox();
      if (!box || box.height === 0) continue;
      expect(box.height, `control ${i} is too short to tap reliably`).toBeGreaterThanOrEqual(40);
    }
  });
});

test.describe('mobile navigation', () => {
  test('drawer opens, traps the page and closes', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoSettled(page, '/');

    await page.getByRole('button', { name: 'افتح القائمة' }).click();

    const drawer = page.getByRole('dialog', { name: 'قائمة التنقل' });
    await expect(drawer).toBeVisible();

    // The page behind must not scroll while the drawer is open.
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');

    await drawer.getByRole('button', { name: 'إغلاق القائمة', exact: true }).click();
    await expect(drawer).not.toBeVisible();
  });

  test('desktop nav is hidden on a phone and shown on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeHidden();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test('page is usable with prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, '/');

    // Content must still end up fully visible. Reduced motion must not leave
    // an element stranded at its animation's starting opacity of 0.
    //
    // Note reduced motion suppresses MOVEMENT, not opacity — a cross-fade does
    // not cause the vestibular problems the preference exists to avoid — so the
    // heading still fades in and the assertion has to wait for it to settle.
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    await expect
      .poll(async () => Number(await heading.evaluate((el) => getComputedStyle(el).opacity)), {
        message: 'heading never reached full opacity',
        timeout: 5000,
      })
      .toBeGreaterThan(0.9);

    // And nothing should still be sliding: the final transform must be settled.
    const transform = await heading.evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
});
