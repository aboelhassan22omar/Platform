import { test, expect } from '@playwright/test';

// Browser tests mock transport only; database/Redis enforcement is exercised by
// backend/test/otp.integration.cjs, without sending to random real phone numbers.
const challenge = { challengeId: 'a'.repeat(43), expiresIn: 300, resendAfterSeconds: 60 };

test('recovery reveals the new password form only after the correct WhatsApp OTP', async ({ page }) => {
  let receivedPassword: unknown;
  await page.route('**/api/auth/password/reset/request', route => route.fulfill({ json: { ...challenge, message: 'لو الرقم مسجل هيوصلك كود واتساب.' } }));
  await page.route('**/api/auth/password/reset/verify', route => {
    const body = route.request().postDataJSON();
    expect(body.challengeId).toBe(challenge.challengeId);
    return body.code === '123456'
      ? route.fulfill({ json: { token: 'verified-reset-grant' } })
      : route.fulfill({ status: 400, json: { message: 'الكود غير صحيح أو انتهت صلاحيته.' } });
  });
  await page.route('**/api/auth/password/reset/confirm', route => {
    receivedPassword = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/forgot-password');
  await page.getByLabel('رقم الموبايل المسجل').fill('01012345678');
  await page.getByRole('button', { name: 'ابعت كود واتساب' }).click();
  await expect(page.getByLabel('كلمة السر الجديدة', { exact: true })).toHaveCount(0);
  await page.getByLabel('كود التحقق', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'تأكيد الكود' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('الكود غير صحيح');
  await expect(page.getByLabel('كلمة السر الجديدة', { exact: true })).toHaveCount(0);
  await page.getByLabel('كود التحقق', { exact: true }).fill('١٢٣٤٥٦');
  await expect(page.getByLabel('كود التحقق', { exact: true })).toHaveValue('123456');
  await page.getByRole('button', { name: 'تأكيد الكود' }).click();
  await expect(page.getByLabel('كلمة السر الجديدة', { exact: true })).toBeVisible();
  await page.getByLabel('كلمة السر الجديدة', { exact: true }).fill('NewSecret123');
  await page.getByLabel('تأكيد كلمة السر', { exact: true }).fill('Different123');
  await page.getByRole('button', { name: 'غيّر كلمة السر' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('مش متطابقتين');
  expect(receivedPassword).toBeUndefined();
  await page.getByLabel('تأكيد كلمة السر', { exact: true }).fill('NewSecret123');
  await page.getByRole('button', { name: 'غيّر كلمة السر' }).click();
  await expect(page.getByRole('heading', { name: 'تم تغيير كلمة السر' })).toBeVisible();
  expect(receivedPassword).toEqual({ token: 'verified-reset-grant', newPassword: 'NewSecret123' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('registration waits for OTP and allows resend after the cooldown', async ({ page }) => {
  await page.route('**/api/auth/register', route => route.fulfill({ status: 201, json: challenge }));
  let resendCount = 0;
  await page.route('**/api/auth/otp/resend', route => {
    resendCount++;
    return route.fulfill({ json: { ...challenge, challengeId: 'b'.repeat(43) } });
  });
  await page.route('**/api/auth/register/verify', route => route.fulfill({ status: 400, json: { message: 'الكود غير صحيح أو انتهت صلاحيته.' } }));
  await page.goto('/register?next=/');
  await page.getByRole('radio', { name: 'طالب أونلاين' }).check();
  await page.getByRole('button', { name: 'الثانوية العامة', exact: true }).click();
  await page.getByRole('button', { name: 'الصف الأول الثانوي', exact: true }).click();
  await page.getByLabel('الاسم الكامل', { exact: true }).fill('طالب اختبار');
  await page.getByLabel('اسم المستخدم', { exact: true }).fill('otp_test');
  await page.getByRole('button', { name: 'التالي: بيانات التواصل' }).click();
  await page.getByLabel('رقم موبايلك', { exact: true }).fill('01012345678');
  await page.getByLabel('رقم ولي الأمر', { exact: true }).fill('01112345678');
  await page.locator('[name="password"]').fill('Secret123');
  await page.locator('[name="confirmPassword"]').fill('Secret123');
  await page.getByRole('button', { name: 'اعمل حسابي' }).click();
  await expect(page.getByLabel('كود التحقق', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByRole('button', { name: /إعادة الإرسال بعد/ })).toBeDisabled();
  await page.getByLabel('كود التحقق', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'تأكيد الكود' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('الكود غير صحيح');
  await expect(page).toHaveURL(/\/register/);
  await page.clock.install();
  await page.clock.fastForward(61000);
  await page.getByRole('button', { name: 'إعادة إرسال الكود', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('تم إرسال كود جديد');
  await expect(page.getByLabel('كود التحقق', { exact: true })).toHaveValue('');
  expect(resendCount).toBe(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.unroute('**/api/auth/register/verify');
  await page.route('**/api/auth/register/verify', route => {
    expect(route.request().postDataJSON()).toEqual({ challengeId: 'b'.repeat(43), code: '654321' });
    return route.fulfill({ json: { user: { id: 'verified-student', fullName: 'طالب اختبار', username: 'otp_test', role: 'STUDENT', isStaff: false, gradeLevel: 'SEC_1', educationSystem: 'GENERAL', studentType: 'ONLINE' } } });
  });
  await page.getByLabel('كود التحقق', { exact: true }).fill('654321');
  await page.getByRole('button', { name: 'تأكيد الكود' }).click();
  await expect(page).toHaveURL('http://localhost:7080/');
});

test('OTP delivery failures leave the phone form open and show the error', async ({ page }) => {
  await page.route('**/api/auth/password/reset/request', route => route.fulfill({ status: 503, json: { message: 'تعذر إرسال كود واتساب.' } }));
  await page.goto('/forgot-password');
  await page.getByLabel('رقم الموبايل المسجل').fill('01012345678');
  await page.getByRole('button', { name: 'ابعت كود واتساب' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('تعذر إرسال');
  await expect(page.getByLabel('رقم الموبايل المسجل')).toBeVisible();
  await expect(page.getByLabel('كود التحقق')).toHaveCount(0);
});
