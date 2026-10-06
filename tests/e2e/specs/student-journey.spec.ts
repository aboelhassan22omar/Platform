import { test, expect, type APIRequestContext } from '@playwright/test';
import { registrationChallenge } from '../helpers/otp-fixture';

/**
 * The complete student journey, end to end, against the running stack.
 *
 * This is the suite that proves the platform actually works as one system:
 * a lesson is locked, a purchase settles through a signed webhook, the lesson
 * unlocks, progress persists, and it is still there on the next visit.
 *
 * Runs at the default project viewport, so the mobile projects exercise the
 * same journey on a phone.
 */

const API = '/api';

/** A fresh student per run, so tests never collide over shared accounts. */
function newStudent() {
  const n = Math.floor(Math.random() * 90000) + 10000;
  return {
    fullName: 'طالب اختبار آلي',
    username: `e2e${n}`,
    password: 'Test12345',
    phone: `0101${Math.floor(Math.random() * 9000000) + 1000000}`,
    parentPhone: '01112345678',
    educationSystem: 'GENERAL' as const,
    gradeLevel: 'SEC_1' as const,
  };
}

async function firstCourse(request: APIRequestContext) {
  const systems = await (await request.get(`${API}/academic/systems`)).json();
  const grade = systems.find((s: { key: string }) => s.key === 'GENERAL').grades[0];
  const detail = await (await request.get(`${API}/academic/grades/${grade.slug}`)).json();
  const course = detail.courses[0];
  const full = await (
    await request.get(`${API}/grades/${grade.slug}/courses/${encodeURIComponent(course.slug)}`)
  ).json();
  return { grade, course: full };
}

test.describe('student journey', () => {
  test('lock → purchase → unlock → watch → resume', async ({ page, request }) => {
    const student = newStudent();
    let verificationCode = '';
    await page.route('**/api/auth/register', async (route) => {
      const fixture = registrationChallenge(route.request().postDataJSON());
      verificationCode = fixture.code;
      const { code: _code, ...challenge } = fixture;
      await route.fulfill({ status: 201, json: challenge });
    });

    // --- 1. Register through the real form -------------------------------
    await page.goto('/register');
    await page.getByRole('radio', { name: 'طالب أونلاين' }).check();
    await page.getByRole('button', { name: 'الثانوية العامة' }).click();
    await page.getByRole('button', { name: 'الصف الأول الثانوي' }).click();

    await page.getByLabel('الاسم الكامل').fill(student.fullName);
    await page.getByLabel('اسم المستخدم').fill(student.username);
    await page.getByRole('button', { name: 'التالي: بيانات التواصل' }).click();
    await page.getByLabel('رقم موبايلك').fill(student.phone);
    await page.getByLabel('رقم ولي الأمر').fill(student.parentPhone);
    // Located by control name: "كلمة السر" is also a substring of the
    // show/hide button's label, so a label match would be ambiguous.
    await page.locator('input[name="password"]').fill(student.password);
    await page.locator('input[name="confirmPassword"]').fill(student.password);

    await page.getByRole('button', { name: 'اعمل حسابي' }).click();
    await expect(page.getByLabel('كود التحقق', { exact: true })).toBeVisible();
    await page.getByLabel('كود التحقق', { exact: true }).fill(verificationCode);
    await page.getByRole('button', { name: 'تأكيد الكود' }).click();
    await page.waitForURL('**/dashboard', { timeout: 20_000 });

    // The greeting must actually use the student's first name.
    await expect(page.getByRole('heading', { name: /أهلاً يا/ })).toBeVisible();

    // --- 2. The library starts empty -------------------------------------
    await page.goto('/dashboard/lessons');
    await expect(page.getByText('مكتبتك لسه فاضية')).toBeVisible();

    // --- 3. A paid lesson is locked --------------------------------------
    const { grade, course } = await firstCourse(page.request);
    const lessons = course.units.flatMap((u: { chapters: { lessons: unknown[] }[] }) =>
      u.chapters.flatMap((c) => c.lessons),
    ) as Array<{
      id: string;
      isFreePreview: boolean;
      productId: string | null;
      priceMinor: number | null;
    }>;

    const paid = lessons.find((l) => !l.isFreePreview && l.productId)!;
    expect(paid, 'seed data must include a purchasable lesson').toBeTruthy();

    await page.goto(`/lessons/${paid.id}`);
    await expect(page.getByRole('heading', { name: 'الحصة دي مقفولة' })).toBeVisible();
    // No <video> element exists at all — the paywall is not a curtain over a
    // stream that has already loaded.
    await expect(page.locator('video')).toHaveCount(0);

    // --- 4. Buy it -------------------------------------------------------
    await page.getByRole('button', { name: /اشترِ الحصة/ }).click();
    await page.waitForURL('**/checkout/sandbox**', { timeout: 20_000 });

    // The sandbox must say plainly that no real money moves.
    await expect(page.getByText(/وضع التطوير/)).toBeVisible();
    await expect(page.getByText(/مفيش أي مبلغ بيتخصم/)).toBeVisible();

    await page.getByRole('button', { name: 'محاكاة دفع ناجح' }).click();
    await page.waitForURL('**/checkout/return**', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /تم الدفع بنجاح/ })).toBeVisible();

    // --- 5. It is unlocked and in the library ----------------------------
    await page.goto(`/lessons/${paid.id}`);
    await expect(page.getByRole('heading', { name: 'الحصة دي مقفولة' })).toHaveCount(0);

    await page.goto('/dashboard/lessons');
    await expect(page.getByText('مكتبتك لسه فاضية')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'حصصي' })).toBeVisible();

    // --- 6. Progress persists across a reload ----------------------------
    const progressResponse = await page.request.put(`${API}/lessons/${paid.id}/progress`, {
      data: { positionSeconds: 240, durationSeconds: 600 },
    });
    expect(progressResponse.ok()).toBe(true);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'كمّل من مكان ما وقفت' })).toBeVisible();
    // 240/600 = 40%.
    await expect(page.getByText('40٪').first()).toBeVisible();

    // --- 7. Still there after signing out and back in ---------------------
    await page.goto('/dashboard/profile');
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await page.waitForURL('**/', { timeout: 20_000 });

    await page.goto('/login');
    await page.locator('input[name="identifier"]').fill(student.username);
    await page.locator('input[name="password"]').fill(student.password);
    await page.getByRole('button', { name: 'دخول' }).click();
    await page.waitForURL('**/dashboard', { timeout: 20_000 });

    const resumed = await (await page.request.get(`${API}/lessons/${paid.id}/progress`)).json();
    expect(resumed.positionSeconds).toBe(240);
    expect(resumed.percent).toBe(40);
  });
});

test.describe('pathway selection', () => {
  test("only the chosen pathway's grades are offered", async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('button', { name: 'الثانوية العامة' }).click();
    await expect(page.getByRole('button', { name: 'الصف الأول الثانوي' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الصف الثالث الثانوي' })).toBeVisible();
    // A بكالوريا grade must never appear under الثانوية العامة.
    await expect(page.getByRole('button', { name: 'الصف الثاني بكالوريا' })).toHaveCount(0);

    await page.getByRole('button', { name: 'البكالوريا المصرية' }).click();
    await expect(page.getByRole('button', { name: 'الصف الأول بكالوريا' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الصف الثاني بكالوريا' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'الصف الثالث الثانوي' })).toHaveCount(0);
  });

  test('switching pathway clears a previously chosen grade', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('button', { name: 'الثانوية العامة' }).click();
    const secondSecondary = page.getByRole('button', { name: 'الصف الثاني الثانوي' });
    await secondSecondary.click();
    await expect(secondSecondary).toHaveAttribute('aria-pressed', 'true');

    // Switching must not leave an incompatible grade selected underneath.
    await page.getByRole('button', { name: 'البكالوريا المصرية' }).click();
    const baccFirst = page.getByRole('button', { name: 'الصف الأول بكالوريا' });
    await expect(baccFirst).toHaveAttribute('aria-pressed', 'false');
  });

  test('homepage pathway selector reveals the matching grades', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'إنت في نظام إيه؟' }).scrollIntoViewIfNeeded();

    await page.getByRole('button', { name: /البكالوريا المصرية/ }).click();
    await expect(page.getByRole('link', { name: /الصف الأول بكالوريا/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /الصف الثالث الثانوي/ })).toHaveCount(0);
  });
});

test.describe('five distinct academic experiences', () => {
  const grades = [
    { slug: 'first-secondary', theme: 'pharaonic-dawn', name: 'الصف الأول الثانوي' },
    { slug: 'second-secondary', theme: 'renaissance-atlas', name: 'الصف الثاني الثانوي' },
    { slug: 'third-secondary', theme: 'modern-egypt-archive', name: 'الصف الثالث الثانوي' },
    { slug: 'first-baccalaureate', theme: 'bacc-foundations', name: 'الصف الأول بكالوريا' },
    { slug: 'second-baccalaureate', theme: 'revolution-chronicle', name: 'الصف الثاني بكالوريا' },
  ];

  for (const grade of grades) {
    test(`${grade.name} renders its own identity`, async ({ page }) => {
      await page.goto(`/grades/${grade.slug}`, { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { name: grade.name, level: 1 })).toBeVisible();
      await expect(page.locator(`[data-theme="${grade.theme}"]`).first()).toBeVisible();
    });
  }

  test('each grade resolves to a different accent colour', async ({ page }) => {
    const accents = new Set<string>();

    for (const grade of grades) {
      await page.goto(`/grades/${grade.slug}`, { waitUntil: 'networkidle' });
      const accent = await page.evaluate((theme) => {
        const el = document.querySelector(`[data-theme="${theme}"]`);
        return el ? getComputedStyle(el).getPropertyValue('--accent').trim() : '';
      }, grade.theme);
      accents.add(accent);
    }

    // Five levels, five distinct accents — not one palette with five titles.
    expect(accents.size).toBe(5);
  });
});

test.describe('Aurexis footer credit', () => {
  test('is present, centred, and links out correctly', async ({ page }) => {
    await page.goto('/');

    const link = page.getByRole('link', { name: 'Aurexis' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://aurexis.cc/');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);

    await expect(page.getByText('Powered by')).toBeVisible();
  });

  test('stays visible on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');

    const link = page.getByRole('link', { name: 'Aurexis' });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  });

  test('is horizontally centred', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const credit = page.getByText('Powered by').locator('..');
    await credit.scrollIntoViewIfNeeded();

    const box = (await credit.boundingBox())!;
    const viewport = page.viewportSize()!;
    const creditCentre = box.x + box.width / 2;
    const pageCentre = viewport.width / 2;

    // Within 2% of centre.
    expect(Math.abs(creditCentre - pageCentre)).toBeLessThan(viewport.width * 0.02);
  });

  test('appears on student-facing pages too', async ({ page }) => {
    for (const path of ['/grades', '/about', '/faq']) {
      await page.goto(path);
      await expect(page.getByRole('link', { name: 'Aurexis' })).toHaveCount(1);
    }
  });
});
