import { test, expect } from '@playwright/test';

test('registration requires an explicit center or online choice', async ({ page }) => {
  await page.goto('/register');
  const center = page.getByRole('radio', { name: 'طالب سنتر' });
  const online = page.getByRole('radio', { name: 'طالب أونلاين' });
  await expect(center).not.toBeChecked();
  await expect(online).not.toBeChecked();
  await center.check();
  await expect(center).toBeChecked();
  await online.check();
  await expect(online).toBeChecked();
  await expect(center).not.toBeChecked();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if ((page.viewportSize()?.width ?? 0) > 768) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect
      .poll(() =>
        page
          .locator('.auth-card')
          .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
      )
      .toBe(true);
  }
});

test('lesson pricing starts unified and reveals center pricing only when enabled', async ({
  page,
}) => {
  const course = {
    id: 'course-ui',
    title: 'كورس اختبار',
    slug: 'test',
    status: 'PUBLISHED',
    isProvisional: false,
    priceMinor: null,
    description: '',
    grade: { id: 'grade-ui', nameAr: 'أولى ثانوي', slug: 'grade', themeKey: 'pharaonic-dawn' },
    academicYear: { label: '٢٠٢٦' },
    _count: { units: 1 },
    units: [
      {
        id: 'unit-ui',
        title: 'الوحدة الأولى',
        status: 'PUBLISHED',
        sortOrder: 0,
        chapters: [
          {
            id: 'chapter-ui',
            title: 'الفصل الأول',
            status: 'PUBLISHED',
            sortOrder: 0,
            priceMinor: null,
            lessons: [],
          },
        ],
      },
    ],
  };
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'teacher-ui',
        fullName: 'المستر',
        username: 'teacher',
        role: 'ADMIN',
        isStaff: true,
        status: 'ACTIVE',
      },
    }),
  );
  await page.route('**/api/admin/content/grades', (route) =>
    route.fulfill({ json: [course.grade] }),
  );
  await page.route('**/api/admin/content/courses', (route) => route.fulfill({ json: [course] }));
  await page.route('**/api/admin/content/courses/course-ui', (route) =>
    route.fulfill({ json: course }),
  );
  await page.goto('/admin/content');
  await page.getByRole('button', { name: 'إضافة حصة', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[name="scheduledAt"]')).toHaveCount(0);
  await dialog.locator('[name="status"]').selectOption('SCHEDULED');
  await expect(dialog.locator('[name="scheduledAt"]')).toHaveCount(1);
  await dialog.locator('[name="status"]').selectOption('PUBLISHED');
  await expect(dialog.getByLabel('السعر للسنتر والأونلاين بالجنيه')).toBeVisible();
  await expect(dialog.getByLabel('مجاني لطلبة السنتر')).toHaveCount(0);
  await dialog.getByLabel('سعر مختلف لطلبة السنتر').check();
  await expect(dialog.getByLabel('سعر الأونلاين بالجنيه')).toBeVisible();
  await expect(dialog.getByLabel('سعر السنتر بالجنيه')).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) > 768) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect
      .poll(() => dialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1))
      .toBe(true);
  }
  await dialog.getByLabel('مجاني لطلبة السنتر').check();
  await expect(dialog.getByLabel('سعر السنتر بالجنيه')).toHaveCount(0);
  await dialog.getByLabel('سعر مختلف لطلبة السنتر').uncheck();
  await expect(dialog.getByLabel('السعر للسنتر والأونلاين بالجنيه')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
