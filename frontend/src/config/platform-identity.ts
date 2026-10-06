import { resolveSubjectKey } from './subject.types';

export interface PlatformIdentityInput {
  subjectKey?: string;
  subjectName?: string;
  subjectAdjective?: string;
  teacherName?: string;
  teacherShortName?: string;
  teacherTitle?: string;
  teacherTagline?: string;
  platformName?: string;
  shortPlatformName?: string;
  description?: string;
  logoLight?: string;
  logoDark?: string;
  logoAlt?: string;
  teacherImage?: string;
  authBackground?: string;
}

const SUBJECT_DEFAULTS = {
  history: { name: 'التاريخ', adjective: 'التاريخية', tagline: 'أسطورة التاريخ' },
  chemistry: { name: 'الكيمياء', adjective: 'الكيميائية', tagline: 'الكيمياء ببساطة' },
  biology: { name: 'الأحياء', adjective: 'الحيوية', tagline: 'الأحياء بفهم وربط' },
  physics: { name: 'الفيزياء', adjective: 'الفيزيائية', tagline: 'الفيزياء خطوة بخطوة' },
  custom: { name: 'المادة', adjective: 'التعليمية', tagline: 'الفهم قبل الحفظ' },
} as const;

export const publicValue = (value: string | undefined, fallback: string) =>
  value?.trim() || fallback;

/** Pure identity resolution: derived defaults always follow the selected subject and teacher. */
export function createPlatformIdentity(input: PlatformIdentityInput = {}) {
  const key = resolveSubjectKey(input.subjectKey);
  const defaults = SUBJECT_DEFAULTS[key];
  const isHistory = key === 'history';
  const title = publicValue(input.teacherTitle, 'مستر');
  const shortName = publicValue(
    input.teacherShortName,
    input.teacherName?.trim().replace(/^(مستر|أستاذ|أستاذة|دكتور|دكتورة)\s+/, '') ||
      (isHistory ? 'عمرو محروس' : 'المدرس'),
  );
  const displayName = publicValue(input.teacherName, `${title} ${shortName}`);
  const platformName = publicValue(input.platformName, `منصة ${displayName} التعليمية`);
  return {
    locale: 'ar' as const,
    direction: 'rtl' as const,
    teacher: {
      displayName,
      shortName,
      title,
      tagline: publicValue(input.teacherTagline, defaults.tagline),
    },
    subject: {
      key,
      name: publicValue(input.subjectName, defaults.name),
      adjective: publicValue(input.subjectAdjective, defaults.adjective),
    },
    brand: {
      platformName,
      shortPlatformName: publicValue(input.shortPlatformName, `منصة ${shortName}`),
      logoLight: publicValue(
        input.logoLight,
        isHistory ? '/brand/horus-eye-logo-light.png' : '/brand/education-logo.svg',
      ),
      logoDark: publicValue(
        input.logoDark,
        isHistory ? '/brand/horus-eye-logo.png' : '/brand/education-logo.svg',
      ),
      logoAlt: publicValue(input.logoAlt, `شعار ${platformName}`),
      description: publicValue(
        input.description,
        'منصة تعليمية لطلاب الثانوية العامة والبكالوريا، تجمع الشرح والمراجعة والمتابعة في مكان واحد.',
      ),
    },
    assets: {
      teacher: publicValue(
        input.teacherImage,
        isHistory ? '/images/teacher-hero.png' : '/brand/subject-education.svg',
      ),
      authBackground: publicValue(
        input.authBackground,
        isHistory ? '/images/auth-museum-background.png' : '/brand/subject-education.svg',
      ),
    },
  };
}
