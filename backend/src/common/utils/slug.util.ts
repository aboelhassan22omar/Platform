/**
 * Slug generation that understands Arabic.
 *
 * Latin titles become normal kebab-case. Arabic titles keep their letters —
 * Arabic URL segments are valid and readable once the browser decodes them,
 * and transliterating would produce worse slugs than the original.
 */

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

export const slugify = (input: string): string => {
  const base = input
    .trim()
    .replace(ARABIC_DIACRITICS, '')
    .toLowerCase()
    // Keep ASCII alphanumerics and the Arabic block; everything else separates.
    .replace(/[^a-z0-9\u0621-\u064A\u0660-\u0669]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || 'item';
};

/**
 * Appends `-2`, `-3`, ... until the slug is unique within `taken`.
 * Callers pass the sibling slugs (lessons within a chapter, courses within a
 * grade) because uniqueness is scoped, not global.
 */
export const uniqueSlug = (input: string, taken: Iterable<string>): string => {
  const existing = new Set(taken);
  const base = slugify(input);
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};
