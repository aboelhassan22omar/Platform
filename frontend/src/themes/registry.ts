import { platformConfig } from '../config/platform.config';
import { getSubjectProfile } from '../config/subject-profile';
import { createPlatformIdentity } from '../config/platform-identity';
import type { SubjectKey } from '../config/subject.types';
import { HISTORY_THEMES } from './presets/history';
import type { AcademicTheme, HistoryThemeKey } from './types';
export type { AcademicTheme, HistoryThemeKey, MotifKey, ThemeKey } from './types';

export const DEFAULT_THEME_KEY: HistoryThemeKey = 'pharaonic-dawn';

/** History DB keys stay valid; a new subject never inherits historical artwork or copy. */
export function getTheme(
  key?: string | null,
  subject: SubjectKey = platformConfig.subject.key,
): AcademicTheme {
  if (subject === 'history')
    return HISTORY_THEMES[key as HistoryThemeKey] ?? HISTORY_THEMES[DEFAULT_THEME_KEY];
  const profile = getSubjectProfile(subject);
  const identity =
    subject === platformConfig.subject.key
      ? platformConfig
      : createPlatformIdentity({ subjectKey: subject });
  return {
    key: `${subject}-classroom`,
    eraLabel: identity.subject.name,
    eraTagline: profile.hero.description,
    motif: 'archive-stack',
    heroSurface: 'from-midnight-950 via-midnight-900 to-midnight-800',
    accentHex: profile.accentHex,
    secondaryHex: '#d9b465',
    heroImage: identity.assets.teacher,
    portraitImage: identity.assets.teacher,
    coverImage: identity.assets.teacher,
    timeline: [
      { label: 'افهم', caption: 'تأسيس المفاهيم' },
      { label: 'تدرّب', caption: 'تطبيق الأفكار' },
      { label: 'راجع', caption: 'قياس التقدم' },
    ],
    heroStagger: 0.08,
  };
}
