/**
 * Public, deployment-specific platform identity.
 *
 * Keep product code generic and change a teacher/subject through environment
 * variables or by replacing this one file. Secrets must never be added here.
 */
export type SubjectKey = 'history' | 'chemistry' | 'biology' | 'physics' | 'custom';

const publicValue = (value: string | undefined, fallback: string) =>
  value?.trim() || fallback;

export const platformConfig = Object.freeze({
  locale: 'ar' as const,
  direction: 'rtl' as const,
  teacher: {
    displayName: publicValue(process.env.NEXT_PUBLIC_TEACHER_NAME, 'مستر عمرو محروس'),
    shortName: publicValue(process.env.NEXT_PUBLIC_TEACHER_SHORT_NAME, 'عمرو محروس'),
    title: publicValue(process.env.NEXT_PUBLIC_TEACHER_TITLE, 'مستر'),
    tagline: publicValue(process.env.NEXT_PUBLIC_TEACHER_TAGLINE, 'أسطورة التاريخ'),
  },
  subject: {
    key: publicValue(process.env.NEXT_PUBLIC_SUBJECT_KEY, 'history') as SubjectKey,
    name: publicValue(process.env.NEXT_PUBLIC_SUBJECT_NAME, 'التاريخ'),
    adjective: publicValue(process.env.NEXT_PUBLIC_SUBJECT_ADJECTIVE, 'التاريخية'),
  },
  brand: {
    platformName: publicValue(
      process.env.NEXT_PUBLIC_PLATFORM_NAME,
      'منصة مستر عمرو محروس التعليمية',
    ),
    shortPlatformName: publicValue(
      process.env.NEXT_PUBLIC_PLATFORM_SHORT_NAME,
      'منصة عمرو محروس',
    ),
    logoLight: publicValue(
      process.env.NEXT_PUBLIC_LOGO_LIGHT,
      '/brand/horus-eye-logo-light.png',
    ),
    logoDark: publicValue(process.env.NEXT_PUBLIC_LOGO_DARK, '/brand/horus-eye-logo.png'),
    logoAlt: publicValue(
      process.env.NEXT_PUBLIC_LOGO_ALT,
      'شعار منصة مستر عمرو محروس التعليمية',
    ),
    description: publicValue(
      process.env.NEXT_PUBLIC_PLATFORM_DESCRIPTION,
      'منصة تعليمية لطلاب الثانوية العامة والبكالوريا، تجمع الشرح والمراجعة والمتابعة في مكان واحد.',
    ),
  },
  contact: {
    facebookUrl: publicValue(
      process.env.NEXT_PUBLIC_FACEBOOK_URL,
      'https://www.facebook.com/share/19mGXkUMKQ/?mibextid=wwXIfr',
    ),
    supportWhatsApp: publicValue(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP, '201000000000'),
    followUpWhatsApp: publicValue(process.env.NEXT_PUBLIC_FOLLOWUP_WHATSAPP, '201100000000'),
    phone: publicValue(process.env.NEXT_PUBLIC_CONTACT_PHONE, '201200000000'),
    supportWhatsAppLabel: publicValue(
      process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_LABEL,
      '010X XXX XXXX',
    ),
    followUpWhatsAppLabel: publicValue(
      process.env.NEXT_PUBLIC_FOLLOWUP_WHATSAPP_LABEL,
      '011X XXX XXXX',
    ),
    phoneLabel: publicValue(process.env.NEXT_PUBLIC_CONTACT_PHONE_LABEL, '012X XXX XXXX'),
  },
  seo: {
    keywords: [
      publicValue(process.env.NEXT_PUBLIC_SUBJECT_NAME, 'التاريخ'),
      'ثانوية عامة',
      'بكالوريا مصرية',
      publicValue(process.env.NEXT_PUBLIC_TEACHER_NAME, 'مستر عمرو محروس'),
      'حصص أونلاين',
    ],
  },
});

export type PlatformConfig = typeof platformConfig;

