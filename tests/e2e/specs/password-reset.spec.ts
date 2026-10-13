import { test, expect } from '@playwright/test';

test.describe('password reset page', () => {
  test('is reachable from the login page', async ({ page }) => {
    await page.goto('/login');

    // Regression: this link previously pointed at a route that did not exist.
    const link = page.getByRole('link', { name: 'نسيت كلمة السر؟' });
    await expect(link).toBeVisible();

    await link.click();
    await page.waitForURL('**/forgot-password');
    await expect(page.getByRole('heading', { name: 'نسيت كلمة السر؟', level: 1 })).toBeVisible();
    // No self-service reset: the page sends the student to support on WhatsApp.
    const support = page.getByRole('link', { name: 'كلّم الدعم على واتساب' });
    await expect(support).toBeVisible();
    await expect(support).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);
  });
});
