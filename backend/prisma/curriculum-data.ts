import { resolvePlatformIdentity } from '../src/config/platform-identity';
import { HISTORY_CURRICULUM } from './subjects/history';
import { HISTORY_GRADES } from './academic-grades';
import type { SeedCourse, GradeKey } from './curriculum-types';
export type { SeedLesson, SeedChapter, SeedUnit, SeedCourse, GradeKey } from './curriculum-types';
export { PLAN_TEMPLATES } from './plan-templates';

const platform = resolvePlatformIdentity();
// New subjects start with editable grade scaffolding; never invent a curriculum.
export const CURRICULUM: Record<GradeKey, SeedCourse[]> =
  platform.subjectKey === 'history'
    ? HISTORY_CURRICULUM
    : { SEC_1: [], SEC_2: [], SEC_3: [], BACC_1: [], BACC_2: [] };
export const GRADES = HISTORY_GRADES.map((grade) =>
  platform.subjectKey === 'history'
    ? grade
    : {
        ...grade,
        description: `منهج ${platform.subjectName} — ${grade.nameAr}`,
        descriptionEn: `${platform.subjectKey} — ${grade.nameEn}`,
        themeKey: `${platform.subjectKey}-classroom`,
      },
);
