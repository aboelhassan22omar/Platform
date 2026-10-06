export function resolvePlatformIdentity(env: NodeJS.ProcessEnv = process.env) {
  const requestedKey = env.SUBJECT_KEY?.trim().toLowerCase() || 'history';
  const subjectNames: Record<string, string> = {
    history: 'التاريخ',
    chemistry: 'الكيمياء',
    biology: 'الأحياء',
    physics: 'الفيزياء',
    custom: 'المادة',
  };
  const subjectKey = Object.hasOwn(subjectNames, requestedKey) ? requestedKey : 'custom';
  const teacherName =
    env.TEACHER_NAME?.trim() || (subjectKey === 'history' ? 'مستر عمرو محروس' : 'مستر المدرس');
  return {
    name: env.PLATFORM_NAME?.trim() || `منصة ${teacherName} التعليمية`,
    teacherName,
    subjectKey,
    subjectName: env.SUBJECT_NAME?.trim() || subjectNames[subjectKey] || subjectNames.custom,
    locale: 'ar' as const,
  };
}
