import { createPlatformIdentity, publicValue } from './platform-identity';
export type { SubjectKey } from './subject.types';

// Explicit NEXT_PUBLIC reads are required for Next.js to inline client settings.
const identity = createPlatformIdentity({
  subjectKey: process.env.NEXT_PUBLIC_SUBJECT_KEY,
  subjectName: process.env.NEXT_PUBLIC_SUBJECT_NAME,
  subjectAdjective: process.env.NEXT_PUBLIC_SUBJECT_ADJECTIVE,
  teacherName: process.env.NEXT_PUBLIC_TEACHER_NAME,
  teacherShortName: process.env.NEXT_PUBLIC_TEACHER_SHORT_NAME,
  teacherTitle: process.env.NEXT_PUBLIC_TEACHER_TITLE,
  teacherTagline: process.env.NEXT_PUBLIC_TEACHER_TAGLINE,
  platformName: process.env.NEXT_PUBLIC_PLATFORM_NAME,
  shortPlatformName: process.env.NEXT_PUBLIC_PLATFORM_SHORT_NAME,
  description: process.env.NEXT_PUBLIC_PLATFORM_DESCRIPTION,
  logoLight: process.env.NEXT_PUBLIC_LOGO_LIGHT,
  logoDark: process.env.NEXT_PUBLIC_LOGO_DARK,
  logoAlt: process.env.NEXT_PUBLIC_LOGO_ALT,
  teacherImage: process.env.NEXT_PUBLIC_TEACHER_IMAGE,
  authBackground: process.env.NEXT_PUBLIC_AUTH_BACKGROUND,
});

export const platformConfig = Object.freeze({
  ...identity,
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
      identity.subject.name,
      'ثانوية عامة',
      'بكالوريا مصرية',
      identity.teacher.displayName,
      'حصص أونلاين',
    ],
  },
});
export type PlatformConfig = typeof platformConfig;
