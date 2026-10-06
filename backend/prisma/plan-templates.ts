/**
 * Placeholder subscription packages, one monthly and one yearly per grade.
 * Seeded INACTIVE — the teacher sets real prices and activates them from the
 * dashboard. Nothing is sellable until someone deliberately turns it on.
 */
export const PLAN_TEMPLATES = [
  {
    kind: 'MONTHLY_PLAN' as const,
    titleSuffix: 'الاشتراك الشهري',
    description: 'وصول كامل لكل حصص الصف لمدة شهر.',
    priceMinor: 15000,
    durationDays: 30,
    sortOrder: 1,
    highlights: [
      'كل حصص الشهر متاحة فوراً',
      'مشاهدة غير محدودة طول مدة الاشتراك',
      'تقدر تكمل من مكان ما وقفت',
    ],
  },
  {
    kind: 'YEARLY_PLAN' as const,
    titleSuffix: 'اشتراك العام الدراسي',
    description: 'وصول كامل لكل حصص العام الدراسي.',
    priceMinor: 120000,
    durationDays: 365,
    sortOrder: 2,
    highlights: [
      'كل حصص السنة في اشتراك واحد',
      'أوفر من الاشتراك الشهري',
      'مراجعات نهائية عند إضافتها',
    ],
  },
];
