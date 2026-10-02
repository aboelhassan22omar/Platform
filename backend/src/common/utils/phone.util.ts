/**
 * Egyptian mobile number handling.
 *
 * Accepted input shapes (students type all of these):
 *   01012345678          national
 *   +201012345678        E.164
 *   00201012345678       international prefix
 *   ٠١٠١٢٣٤٥٦٧٨          Eastern-Arabic digits
 *   010 1234 5678        spaces / dashes
 *
 * Everything is normalised to the 11-digit national form `01XXXXXXXXX`, which
 * is what the database stores and what the UI displays back to the student.
 */

/** Valid Egyptian mobile operator prefixes: Vodafone, Etisalat, Orange, WE. */
const OPERATOR_PREFIXES = ['010', '011', '012', '015'] as const;

const EASTERN_ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Converts Eastern-Arabic and Persian digits to ASCII.
 * Egyptian phone keypads and copy-pasted text routinely produce these.
 */
export const toAsciiDigits = (input: string): string =>
  input.replace(/[٠-٩۰-۹]/g, (char) => {
    const eastern = EASTERN_ARABIC_DIGITS.indexOf(char);
    if (eastern !== -1) return String(eastern);
    return String(PERSIAN_DIGITS.indexOf(char));
  });

/**
 * Normalises any accepted shape to `01XXXXXXXXX`.
 * Returns null when the value is not a valid Egyptian mobile number.
 */
export const normalizeEgyptianPhone = (raw: string): string | null => {
  if (!raw) return null;

  // Strip spaces, dashes, dots and parentheses, then fold Arabic digits.
  let value = toAsciiDigits(raw.trim()).replace(/[\s\-().]/g, '');

  if (value.startsWith('+20')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0020')) value = `0${value.slice(4)}`;
  else if (value.startsWith('20') && value.length === 12) value = `0${value.slice(2)}`;
  // A 10-digit number missing its leading zero, e.g. "1012345678".
  else if (value.length === 10 && value.startsWith('1')) value = `0${value}`;

  if (!/^\d{11}$/.test(value)) return null;
  if (!OPERATOR_PREFIXES.some((prefix) => value.startsWith(prefix))) return null;

  return value;
};

export const isValidEgyptianPhone = (raw: string): boolean =>
  normalizeEgyptianPhone(raw) !== null;

/** Renders a stored number for display: `0101 234 5678`. */
export const formatEgyptianPhone = (phone: string): string => {
  const normalized = normalizeEgyptianPhone(phone);
  if (!normalized) return phone;
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
};

/**
 * Masks a number for audit logs and support views: `0101***5678`.
 * Student and parent phone numbers are personal data; only staff who need the
 * full value get it, and logs never do.
 */
export const maskPhone = (phone: string): string => {
  const normalized = normalizeEgyptianPhone(phone);
  if (!normalized) return '***';
  return `${normalized.slice(0, 4)}***${normalized.slice(-4)}`;
};
