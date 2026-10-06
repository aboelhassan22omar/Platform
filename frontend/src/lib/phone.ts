export const EGYPTIAN_PHONE = /^(010|011|012|015)\d{8}$/;

export function normalizePhone(raw: string): string {
  let value = raw
    .trim()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\s\-().]/g, '');
  if (value.startsWith('+20')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0020')) value = `0${value.slice(4)}`;
  else if (value.length === 10 && value.startsWith('1')) value = `0${value}`;
  return value;
}
