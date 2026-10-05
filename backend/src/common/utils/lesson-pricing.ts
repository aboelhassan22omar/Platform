import { StudentType } from '../../generated/prisma/enums';

export interface LessonPricing {
  priceMinor: number | null;
  centerPriceMinor?: number | null;
  isFreePreview: boolean;
}

export function isLessonFreeFor(lesson: Pick<LessonPricing, 'isFreePreview' | 'centerPriceMinor'>, studentType?: StudentType) {
  return lesson.isFreePreview || (studentType === StudentType.CENTER && lesson.centerPriceMinor === 0);
}

export function lessonPriceFor(lesson: LessonPricing, studentType?: StudentType): number | null {
  if (isLessonFreeFor(lesson, studentType)) return 0;
  return studentType === StudentType.CENTER ? lesson.centerPriceMinor ?? lesson.priceMinor : lesson.priceMinor;
}
