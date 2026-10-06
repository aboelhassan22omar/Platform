import { test, expect } from '@playwright/test';
import { createPlatformIdentity } from '../../../frontend/src/config/platform-identity';

// Run against an independently built subject deployment, never mutate its database.
const subject = process.env.E2E_SUBJECT;
const identity = createPlatformIdentity({
  subjectKey: subject,
  teacherName: process.env.E2E_TEACHER,
});
test.skip(
  !subject || subject === 'history',
  'Set E2E_SUBJECT and E2E_BASE_URL for a non-history deployment.',
);

test('subject identity reaches public pages and registration without historical teacher images', async ({
  page,
}) => {
  for (const path of ['/', '/about', '/contact', '/register', '/store']) {
    await page.goto(path);
    await expect(page.locator('#main')).toBeVisible();
    await expect(page).toHaveTitle(
      new RegExp(`${identity.brand.shortPlatformName}|${identity.brand.platformName}`),
    );
    const text = await page.locator('#main').innerText();
    expect(text).not.toMatch(/أسطورة التاريخ|التاريخ قصة|عمرو محروس/);
    const images = await page
      .locator('img')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('src') ?? ''));
    expect(images.join(' ')).not.toMatch(
      /horus-eye-logo|teacher-hero|teacher-pharaonic|auth-museum/,
    );
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
    }));
    expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  }
});

test('the grade catalog and product details follow the selected subject', async ({ page }) => {
  await page.goto('/store/grades/SEC_1');
  await expect(
    page.getByRole('heading', { name: `كتاب ${identity.subject.name} — أولى ثانوي`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('heading', { name: `كتاب ${identity.subject.name} — أولى ثانوي`, exact: true })
    .getByRole('link')
    .click();
  await expect(
    page.getByRole('heading', { name: `كتاب ${identity.subject.name} — أولى ثانوي`, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /أضف للعربة/ }).click();
  await expect(page.getByRole('link', { name: 'عربة التسوق (1)', exact: true })).toBeVisible();
});
