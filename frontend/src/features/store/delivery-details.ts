import { EGYPTIAN_PHONE, normalizePhone } from '../../lib/phone';
import type { DeliveryDetails } from './store.types';

export const EMPTY_DELIVERY: DeliveryDetails = {
  customerName: '',
  phone: '',
  alternatePhone: '',
  governorate: '',
  city: '',
  address: '',
  landmark: '',
  building: '',
  floor: '',
  apartment: '',
  notes: '',
};
export const OPTIONAL_DELIVERY_FIELDS: readonly (keyof DeliveryDetails)[] = [
  'alternatePhone',
  'landmark',
  'notes',
];
export const DELIVERY_FIELDS: readonly [keyof DeliveryDetails, string, string?][] = [
  ['customerName', 'الاسم بالكامل'],
  ['phone', 'رقم الموبايل', 'tel'],
  ['alternatePhone', 'رقم موبايل بديل', 'tel'],
  ['city', 'المدينة / المنطقة'],
  ['address', 'العنوان بالتفصيل'],
  ['landmark', 'علامة مميزة عند العنوان'],
  ['building', 'رقم المبنى'],
  ['floor', 'الدور'],
  ['apartment', 'رقم الشقة'],
  ['notes', 'ملاحظات التوصيل (اختياري)'],
];

export function validateDeliveryDetails(
  delivery: DeliveryDetails,
): { delivery: DeliveryDetails; error?: undefined } | { error: string; delivery?: undefined } {
  const phone = normalizePhone(delivery.phone);
  const alternatePhone = normalizePhone(delivery.alternatePhone);
  if (!EGYPTIAN_PHONE.test(phone) || (alternatePhone && !EGYPTIAN_PHONE.test(alternatePhone)))
    return { error: 'اكتب رقم موبايل مصري صحيح من ١١ رقم، ولو أضفت رقم بديل لازم يكون صحيح.' };
  if (phone === alternatePhone) return { error: 'الرقم البديل لازم يكون مختلف عن رقم الموبايل.' };
  return { delivery: { ...delivery, phone, alternatePhone } };
}
