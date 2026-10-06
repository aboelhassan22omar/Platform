import { ACADEMIC_LEVELS } from '../../config/academic-levels';
import { getTheme } from '../../themes/registry';

export const STORE_GRADES = ACADEMIC_LEVELS.map((level) => {
  const theme = getTheme(level.historyTheme);
  return {
    key: level.key,
    label: level.label,
    theme: theme.key,
    art: theme.coverImage,
    accent: theme.accentHex,
  };
});
