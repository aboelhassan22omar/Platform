import type { EducationSystem, GradeLevel } from '../types/api';

export interface AcademicLevel {
  key: GradeLevel;
  system: EducationSystem;
  label: string;
  fullLabel: string;
  labelLines: [string, string];
  slug: string;
  historyTheme: string;
}

export const ACADEMIC_LEVELS: readonly AcademicLevel[] = [
  {
    key: 'SEC_1',
    system: 'GENERAL',
    label: 'أولى ثانوي',
    fullLabel: 'الصف الأول الثانوي',
    labelLines: ['الصف الأول', 'الثانوي'],
    slug: 'first-secondary',
    historyTheme: 'pharaonic-dawn',
  },
  {
    key: 'SEC_2',
    system: 'GENERAL',
    label: 'تانية ثانوي',
    fullLabel: 'الصف الثاني الثانوي',
    labelLines: ['الصف الثاني', 'الثانوي'],
    slug: 'second-secondary',
    historyTheme: 'renaissance-atlas',
  },
  {
    key: 'SEC_3',
    system: 'GENERAL',
    label: 'تالتة ثانوي',
    fullLabel: 'الصف الثالث الثانوي',
    labelLines: ['الصف الثالث', 'الثانوي'],
    slug: 'third-secondary',
    historyTheme: 'modern-egypt-archive',
  },
  {
    key: 'BACC_1',
    system: 'BACC',
    label: 'أولى بكالوريا',
    fullLabel: 'الصف الأول بكالوريا',
    labelLines: ['الصف الأول', 'بكالوريا'],
    slug: 'first-baccalaureate',
    historyTheme: 'bacc-foundations',
  },
  {
    key: 'BACC_2',
    system: 'BACC',
    label: 'تانية بكالوريا',
    fullLabel: 'الصف الثاني بكالوريا',
    labelLines: ['الصف الثاني', 'بكالوريا'],
    slug: 'second-baccalaureate',
    historyTheme: 'revolution-chronicle',
  },
];

export const EDUCATION_SYSTEMS = [
  { key: 'GENERAL' as const, label: 'الثانوية العامة', hint: 'النظام العام' },
  { key: 'BACC' as const, label: 'البكالوريا المصرية', hint: 'النظام الجديد' },
].map((system) => ({
  ...system,
  grades: ACADEMIC_LEVELS.filter((level) => level.system === system.key).map((level) => ({
    value: level.key,
    label: level.fullLabel,
    labelLines: level.labelLines,
  })),
}));
