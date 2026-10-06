import { test, expect } from '@playwright/test';

test('guest cart, shipping and simulated payment work without an account', async ({
  page,
}) => {
  await page.goto('/store');
  await expect(
    page.getByRole('heading', { name: 'اختار صفّك الدراسي' }),
  ).toBeVisible();
  const cartLink = page.getByRole('link', { name: /عربة التسوق \(/ }).first();
  await expect(cartLink).toBeInViewport();
  if (page.viewportSize()!.width < 768) {
    const menu = page.getByRole('button', { name: 'افتح القائمة الرئيسية' });
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await expect(
      page.getByRole('button', { name: 'افتح القائمة الرئيسية' }),
    ).toBeInViewport();
  }
  await expect(page.locator('.store-product')).toHaveCount(0);
  await expect(page.locator('.store-grade-card')).toHaveCount(5);
  await expect(page.getByText(/نسخة عرض|طلب بدون حساب/)).toHaveCount(0);
  await page
    .locator('.store-grade-card')
    .filter({ hasText: 'تالتة ثانوي' })
    .locator('.store-grade-cta')
    .click();
  await expect(page).toHaveURL(/\/store\/grades\/SEC_3/);
  await expect(page.locator('.store-product')).toHaveCount(3);
  await page.getByRole('button', { name: 'أضف للعربة' }).first().click();
  await page.goto('/store/cart');
  await page.getByRole('button', { name: /زيادة كمية/ }).click();
  await page.reload();
  await expect(page.locator('[aria-label="الكمية"]')).toHaveText('2');
  await page.getByLabel('المحافظة', { exact: true }).selectOption('ASSIUT');
  await expect(page.getByTestId('shipping-total')).toHaveText('١٠٠ ج.م');
  await expect(page.getByTestId('order-total')).toHaveText('٥٤٠ ج.م');
  await expect(
    page
      .getByLabel('المحافظة', { exact: true })
      .locator('option[value="ASSIUT"]'),
  ).toHaveText('أسيوط');
  await expect(
    page.locator('.store-summary').getByText('وجه بحري'),
  ).toHaveCount(0);
  await page.getByLabel('المحافظة', { exact: true }).selectOption('CAIRO');
  await expect(page.getByTestId('order-total')).toHaveText('٥٠٠ ج.م');
  for (const [label, value] of [
    ['الاسم بالكامل', 'أحمد محمد'],
    ['رقم الموبايل', '01012345678'],
    ['رقم موبايل بديل (اختياري)', '01112345678'],
    ['المدينة / المنطقة', 'مدينة نصر'],
    ['العنوان بالتفصيل', 'شارع عباس العقاد بالقرب من الحديقة'],
    ['علامة مميزة عند العنوان (اختياري)', 'أمام الحديقة'],
    ['رقم المبنى', '12'],
    ['الدور', '2'],
    ['رقم الشقة', '5'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'متابعة للدفع' }).click();
  await page.getByRole('radio', { name: /إنستا باي/ }).check();
  await page.getByRole('button', { name: 'مراجعة الطلب' }).click();
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click();
  await expect(page).toHaveURL(/\/store\/orders\/DEMO-/);
  await page.getByLabel('مرجع التحويل').fill('DEMO-TEST-123');
  await page
    .getByRole('button', { name: 'إرسال بيانات التحويل للمراجعة' })
    .click();
  await expect(
    page.getByText('الدفع قيد المراجعة', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('الدفع قيد المراجعة', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test('cart only appears in store routes and grade page shows mixed product types', async ({
  page,
}) => {
  await page.goto('/about');
  await expect(page.getByRole('link', { name: /عربة التسوق \(/ })).toHaveCount(
    0,
  );
  await page.goto('/store');
  await expect(
    page.getByRole('link', { name: /عربة التسوق \(/ }),
  ).toBeVisible();
  await page
    .locator('.store-grade-card')
    .filter({ hasText: 'أولى ثانوي' })
    .click();
  await expect(page.locator('.store-grade-products')).toHaveCount(1);
  await expect(page.locator('.store-product')).toHaveCount(3);
  await expect(page.locator('.store-product h3')).toHaveText([
    'كتاب التاريخ — أولى ثانوي',
    'ملزمة الأسئلة — أولى ثانوي',
    'بكدج التفوق — أولى ثانوي',
  ]);
  await expect(page.locator('.store-collection')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'ابحث في مكتبة الصف' }).fill('بكدج');
  await expect(page.locator('.store-product')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test('teacher edits product, COD availability, shipping and reviews sample payment', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'demo-admin',
        fullName: 'المستر',
        role: 'ADMIN',
        status: 'ACTIVE',
        isStaff: true,
      },
    }),
  );
  await page.goto('/admin/store');
  await page
    .getByRole('button', { name: 'تعديل', exact: true })
    .first()
    .click();
  await page.getByLabel('السعر بالجنيه', { exact: true }).fill('250');
  await page.getByLabel('السماح بالدفع عند الاستلام').uncheck();
  await page.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();
  await page.getByRole('button', { name: 'الشحن', exact: true }).click();
  const region = page.locator('.store-shipping-region').first();
  await region.getByLabel('الشحن بالجنيه').fill('65');
  await region.getByRole('button', { name: 'حفظ', exact: true }).click();
  await page.getByRole('button', { name: 'الطلبات', exact: true }).click();
  await page.getByRole('button', { name: 'تأكيد الدفع' }).click();
  await page.goto('/store/orders/DEMO-1002');
  await expect(page.getByText('تم تأكيد الدفع', { exact: true })).toBeVisible();
  await page.goto('/store/products/history-book-SEC_1');
  await expect(page.getByText('٢٥٠ ج.م', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'أضف للعربة' }).click();
  await page.goto('/store/cart');
  await expect(
    page
      .getByLabel('المحافظة', { exact: true })
      .locator('option[value="CAIRO"]'),
  ).toHaveText('القاهرة');
  await page.getByLabel('المحافظة', { exact: true }).selectOption('CAIRO');
  for (const [label, value] of [
    ['الاسم بالكامل', 'أحمد محمد'],
    ['رقم الموبايل', '01012345678'],
    ['رقم موبايل بديل (اختياري)', '01112345678'],
    ['المدينة / المنطقة', 'مدينة نصر'],
    ['العنوان بالتفصيل', 'شارع عباس العقاد بالقرب من الحديقة'],
    ['علامة مميزة عند العنوان (اختياري)', 'أمام الحديقة'],
    ['رقم المبنى', '12'],
    ['الدور', '2'],
    ['رقم الشقة', '5'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'متابعة للدفع' }).click();
  await expect(
    page.getByRole('radio', { name: /الدفع عند الاستلام/ }),
  ).toBeDisabled();
  await expect(page.getByRole('radio', { name: /فودافون كاش/ })).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test('COD demo confirms immediately, validates alternate phone and clears cart', async ({
  page,
}) => {
  await page.goto('/store/products/history-book-SEC_1');
  await page.getByRole('button', { name: 'أضف للعربة' }).click();
  await page.goto('/store/cart');
  await page.getByLabel('المحافظة', { exact: true }).selectOption('ALEXANDRIA');
  for (const [label, value] of [
    ['الاسم بالكامل', 'أحمد محمد'],
    ['رقم الموبايل', '01012345678'],
    ['رقم موبايل بديل (اختياري)', '01012345678'],
    ['المدينة / المنطقة', 'سموحة'],
    ['العنوان بالتفصيل', 'شارع النصر أمام النادي الرياضي'],
    ['علامة مميزة عند العنوان (اختياري)', 'أمام النادي'],
    ['رقم المبنى', '12'],
    ['الدور', '2'],
    ['رقم الشقة', '5'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'متابعة للدفع' }).click();
  await expect(page.locator('.store-error[role="alert"]')).toHaveText(
    'الرقم البديل لازم يكون مختلف عن رقم الموبايل.',
  );
  await page.getByLabel('رقم موبايل بديل (اختياري)', { exact: true }).fill('');
  await page.getByLabel('علامة مميزة عند العنوان (اختياري)', { exact: true }).fill('');
  await page.getByRole('button', { name: 'متابعة للدفع' }).click();
  await page.getByRole('button', { name: 'مراجعة الطلب' }).click();
  await page.getByRole('button', { name: 'تأكيد الطلب' }).click();
  await expect(
    page.getByRole('heading', { name: 'تم تأكيد الطلب', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('٢٦٠ ج.م', { exact: true })).toBeVisible();
  await expect(page.getByLabel('مرجع التحويل')).toHaveCount(0);
  await page.goto('/store/cart');
  await expect(
    page.getByRole('heading', { name: 'عربتك مستنية اختيارك' }),
  ).toBeVisible();
});
