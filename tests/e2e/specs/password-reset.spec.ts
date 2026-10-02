import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL } from '../playwright.config';

/**
 * Password reset.
 *
 * The privacy property matters as much as the mechanics here: the request
 * endpoint must answer identically whether or not the phone is registered, or
 * it becomes a way to discover which numbers have accounts.
 */

const API = '/api';

async function newSession(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: API_BASE_URL });
}

interface ResetRequestResponse {
  message: string;
  devToken?: string;
  devNotice?: string;
}

async function registerStudent(ctx: APIRequestContext) {
  const n = Math.floor(Math.random() * 90000) + 10000;
  const student = {
    fullName: 'طالب استعادة',
    username: `reset${n}`,
    password: 'Test12345',
    phone: `0101${Math.floor(Math.random() * 9000000) + 1000000}`,
    parentPhone: '01112345678',
    educationSystem: 'GENERAL' as const,
    gradeLevel: 'SEC_1' as const,
  };

  const response = await ctx.post(`${API}/auth/register`, { data: student });
  expect(response.status(), await response.text()).toBe(201);
  return student;
}

test.describe('password reset', () => {
  test('does not reveal whether a phone number is registered', async () => {
    const setup = await newSession();
    const student = await registerStudent(setup);
    await setup.dispose();

    const ctx = await newSession();

    const known = (await (
      await ctx.post(`${API}/auth/password/reset/request`, { data: { phone: student.phone } })
    ).json()) as ResetRequestResponse;

    const unknown = (await (
      await ctx.post(`${API}/auth/password/reset/request`, { data: { phone: '01099999999' } })
    ).json()) as ResetRequestResponse;

    // Same wording either way — the endpoint is not an account oracle.
    expect(unknown.message).toBe(known.message);
    // And crucially, no token is minted for a number that has no account.
    expect(unknown.devToken).toBeUndefined();

    await ctx.dispose();
  });

  test('states plainly that no SMS was sent in development', async () => {
    const setup = await newSession();
    const student = await registerStudent(setup);
    await setup.dispose();

    const ctx = await newSession();
    const result = (await (
      await ctx.post(`${API}/auth/password/reset/request`, { data: { phone: student.phone } })
    ).json()) as ResetRequestResponse;

    if (result.devToken) {
      // If a token is exposed, the response must say no message was delivered,
      // so the UI never implies an SMS the student should go looking for.
      expect(result.devNotice).toBeTruthy();
      expect(result.devNotice).toContain('SMS');
    }

    await ctx.dispose();
  });

  test('completes the reset, invalidating the old password and old sessions', async () => {
    const original = await newSession();
    const student = await registerStudent(original);

    const ctx = await newSession();
    const requested = (await (
      await ctx.post(`${API}/auth/password/reset/request`, { data: { phone: student.phone } })
    ).json()) as ResetRequestResponse;

    test.skip(!requested.devToken, 'Reset token is not exposed outside development');
    const token = requested.devToken!;

    const newPassword = 'BrandNew12345';
    const confirm = await ctx.post(`${API}/auth/password/reset/confirm`, {
      data: { token, newPassword },
    });
    expect(confirm.status()).toBe(200);

    // The new password works...
    const fresh = await newSession();
    expect(
      (await fresh.post(`${API}/auth/login`, {
        data: { identifier: student.username, password: newPassword },
      })).status(),
    ).toBe(200);

    // ...the old one does not...
    const stale = await newSession();
    expect(
      (await stale.post(`${API}/auth/login`, {
        data: { identifier: student.username, password: student.password },
      })).status(),
    ).toBe(401);

    // ...and any session opened before the reset is dead.
    expect((await original.get(`${API}/auth/me`)).status()).toBe(401);

    // The token cannot be replayed.
    expect(
      (await ctx.post(`${API}/auth/password/reset/confirm`, {
        data: { token, newPassword: 'YetAnother12345' },
      })).status(),
    ).toBe(400);

    await Promise.all([original.dispose(), ctx.dispose(), fresh.dispose(), stale.dispose()]);
  });

  test('rejects a forged token and a weak new password', async () => {
    const ctx = await newSession();

    expect(
      (await ctx.post(`${API}/auth/password/reset/confirm`, {
        data: { token: 'not-a-real-token', newPassword: 'Valid12345' },
      })).status(),
    ).toBe(400);

    expect(
      (await ctx.post(`${API}/auth/password/reset/confirm`, {
        data: { token: 'not-a-real-token', newPassword: 'short' },
      })).status(),
    ).toBe(400);

    await ctx.dispose();
  });
});

test.describe('password reset page', () => {
  test('is reachable from the login page', async ({ page }) => {
    await page.goto('/login');

    // Regression: this link previously pointed at a route that did not exist.
    const link = page.getByRole('link', { name: 'نسيت كلمة السر؟' });
    await expect(link).toBeVisible();

    await link.click();
    await page.waitForURL('**/forgot-password');
    await expect(
      page.getByRole('heading', { name: 'نسيت كلمة السر؟', level: 1 }),
    ).toBeVisible();
    await expect(page.getByLabel('رقم الموبايل المسجل')).toBeVisible();
  });
});
