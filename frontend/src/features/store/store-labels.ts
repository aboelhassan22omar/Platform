import type { StoreKind, StoreMethod, StoreStatus } from './store.types';

export const STORE_KINDS: {
  key: StoreKind;
  title: string;
  label: string;
  description: string;
}[] = [
  {
    key: 'BOOK',
    title: 'كتب الشرح',
    label: 'الكتب',
    description: 'شرح مرتب، خرائط ذهنية، وأمثلة مع كل درس.',
  },
  {
    key: 'NOTES',
    title: 'ملازم التدريب والمراجعة',
    label: 'الملازم',
    description: 'طبّق اللي اتعلمته وراجع أهم الأفكار قبل الامتحان.',
  },
  {
    key: 'BUNDLE',
    title: 'بكدجات السنة الدراسية',
    label: 'البكدجات',
    description: 'الشرح والتدريب والمراجعة، متجمعين في بكدج واحد.',
  },
];
export const METHOD_LABELS: Record<StoreMethod, string> = {
  COD: 'الدفع عند الاستلام',
  VODAFONE_CASH: 'فودافون كاش',
  INSTAPAY: 'إنستا باي',
};
export const STATUS_LABELS: Record<StoreStatus, string> = {
  AWAITING_PAYMENT: 'بانتظار الدفع',
  CONFIRMED: 'تم تأكيد الطلب',
  PROCESSING: 'جاري تجهيز الطلب',
  SHIPPED: 'في الطريق إليك',
  DELIVERED: 'تم التسليم',
  CANCELLED: 'ملغي',
};
export const PAYMENT_LABELS = {
  UNPAID: 'غير مدفوع',
  SUBMITTED: 'الدفع قيد المراجعة',
  PAID: 'تم تأكيد الدفع',
  REJECTED: 'التحويل يحتاج مراجعة',
};
