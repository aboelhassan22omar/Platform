import { test, expect } from '@playwright/test';
import { createPlatformIdentity } from '../../../frontend/src/config/platform-identity';
import { getSubjectProfile } from '../../../frontend/src/config/subject-profile';
import { getTheme } from '../../../frontend/src/themes/registry';
import { createInitialProducts } from '../../../frontend/src/features/store/catalog-seed';

test('history identity preserves current branding by default', () => {
  const config = createPlatformIdentity();
  expect(config.subject.name).toBe('التاريخ');
  expect(config.teacher.displayName).toBe('مستر عمرو محروس');
  expect(config.brand.logoDark).toContain('horus');
});
test('changing only subject key resolves chemistry defaults without historical copy or art', () => {
  const config = createPlatformIdentity({ subjectKey: 'chemistry' });
  expect(config.subject.name).toBe('الكيمياء');
  expect(config.teacher.tagline).toBe('الكيمياء ببساطة');
  expect(config.brand.platformName).not.toContain('عمرو');
  expect(config.brand.logoDark).not.toContain('horus');
  expect(config.assets.authBackground).not.toContain('museum');
  const products = createInitialProducts(config.subject);
  expect(products).toHaveLength(15);
  expect(
    products.every((p) => !p.title.includes('التاريخ') && !p.description.includes('الأحداث')),
  ).toBeTruthy();
  expect(products[0].id).toBe('chemistry-book-SEC_1');
});
test('branding overrides are trimmed, with safe custom-subject fallback', () => {
  const config = createPlatformIdentity({
    subjectKey: 'unknown',
    subjectName: ' الجيولوجيا ',
    teacherName: ' دكتور أحمد ',
    platformName: ' أكاديمية العلوم ',
    logoDark: ' /brand/custom.svg ',
  });
  expect(config.subject.key).toBe('custom');
  expect(config.subject.name).toBe('الجيولوجيا');
  expect(config.brand.platformName).toBe('أكاديمية العلوم');
  expect(config.brand.logoDark).toBe('/brand/custom.svg');
  expect(config.brand.logoAlt).toContain(config.brand.platformName);
});
test('legacy grade keys do not leak historical artwork when subject changes', () => {
  const theme = getTheme('pharaonic-dawn', 'chemistry');
  expect(theme.key).toBe('chemistry-classroom');
  expect(theme.timeline.map((t) => t.caption).join(' ')).not.toMatch(/الفراعنة|القناة|الرومان/);
  expect(getSubjectProfile('chemistry').hero.title).toContain('الكيمياء');
  expect(theme.heroImage).not.toContain('teacher-hero');
  expect(theme.eraLabel).toBe('الكيمياء');
});
