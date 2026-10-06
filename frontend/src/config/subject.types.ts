export const SUBJECT_KEYS = ['history', 'chemistry', 'biology', 'physics', 'custom'] as const;
export type SubjectKey = (typeof SUBJECT_KEYS)[number];

export function resolveSubjectKey(value?: string): SubjectKey {
  const key = value?.trim().toLowerCase();
  return SUBJECT_KEYS.includes(key as SubjectKey)
    ? (key as SubjectKey)
    : key
      ? 'custom'
      : 'history';
}
