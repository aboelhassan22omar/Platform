export type StoreKind = 'BOOK' | 'NOTES' | 'BUNDLE';
export type StoreGrade = 'SEC_1' | 'SEC_2' | 'SEC_3' | 'BACC_1' | 'BACC_2';
export type StoreMethod = 'COD' | 'VODAFONE_CASH' | 'INSTAPAY';
export type StoreStatus =
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';
export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  kind: StoreKind;
  grade: StoreGrade;
  priceMinor: number;
  compareAtMinor: number | null;
  stock: number;
  allowCod: boolean;
  active: boolean;
  featured: boolean;
  pages: number;
  image: string | null;
  highlights: string[];
}
export interface StoreRate {
  code: string;
  name: string;
  region: string;
  priceMinor: number;
}
export interface CartItem {
  productId: string;
  quantity: number;
}
export interface DeliveryDetails {
  customerName: string;
  phone: string;
  alternatePhone: string;
  governorate: string;
  city: string;
  address: string;
  landmark: string;
  building: string;
  floor: string;
  apartment: string;
  notes: string;
}
export interface StoreOrder {
  reference: string;
  createdAt: string;
  delivery: DeliveryDetails;
  items: { product: StoreProduct; quantity: number }[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  method: StoreMethod;
  status: StoreStatus;
  paymentStatus: 'UNPAID' | 'SUBMITTED' | 'PAID' | 'REJECTED';
  transferReference?: string;
  note?: string;
  trackingNumber?: string;
}

export const STORE_GRADES: {
  key: StoreGrade;
  label: string;
  theme: string;
  art: string;
  accent: string;
}[] = [
  {
    key: 'SEC_1',
    label: 'أولى ثانوي',
    theme: 'pharaonic-dawn',
    art: '/images/eras/pharaonic-cover.jpg',
    accent: '#c89a3c',
  },
  {
    key: 'SEC_2',
    label: 'تانية ثانوي',
    theme: 'renaissance-atlas',
    art: '/images/eras/renaissance-cover.jpg',
    accent: '#4b9997',
  },
  {
    key: 'SEC_3',
    label: 'تالتة ثانوي',
    theme: 'modern-egypt-archive',
    art: '/images/eras/modern-cover.jpg',
    accent: '#ba735b',
  },
  {
    key: 'BACC_1',
    label: 'أولى بكالوريا',
    theme: 'bacc-foundations',
    art: '/images/eras/bacc-cover.jpg',
    accent: '#7688bb',
  },
  {
    key: 'BACC_2',
    label: 'تانية بكالوريا',
    theme: 'revolution-chronicle',
    art: '/images/eras/revolution-cover.jpg',
    accent: '#ad8270',
  },
];
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

export const INITIAL_PRODUCTS: StoreProduct[] = STORE_GRADES.flatMap(
  (grade, index) => {
    const base = index === 2 ? 22000 : 18000;
    return [
      {
        id: `history-book-${grade.key}`,
        title: `كتاب التاريخ — ${grade.label}`,
        description: `دليلك المنظم لفهم منهج التاريخ للصف ${grade.label}. شرح مبسّط، خطوط زمنية للأحداث، وخرائط ذهنية تربط الأفكار ببعضها. نسخة مطبوعة بتصميم مريح للمذاكرة.`,
        kind: 'BOOK' as const,
        grade: grade.key,
        priceMinor: base,
        compareAtMinor: base + 4000,
        stock: 40,
        allowCod: true,
        active: true,
        featured: index === 2,
        pages: 240 + index * 16,
        image: null,
        highlights: [
          'شرح المنهج درسًا بدرس',
          'خرائط ذهنية وخطوط زمنية',
          'تدريبات بعد كل فصل',
        ],
      },
      {
        id: `history-notes-${grade.key}`,
        title: `ملزمة الأسئلة — ${grade.label}`,
        description: `تدريبات متدرجة وأسئلة اختيار من متعدد على وحدات منهج ${grade.label}. راجع مستوى فهمك، واتدرب على ربط الأحداث وتحليل المصادر قبل الامتحان.`,
        kind: 'NOTES' as const,
        grade: grade.key,
        priceMinor: index === 2 ? 12000 : 9500,
        compareAtMinor: null,
        stock: 60,
        allowCod: true,
        active: true,
        featured: false,
        pages: 128,
        image: null,
        highlights: [
          'أسئلة على كل درس',
          'نماذج امتحانات شاملة',
          'إجابات للمراجعة الذاتية',
        ],
      },
      {
        id: `history-bundle-${grade.key}`,
        title: `بكدج التفوق — ${grade.label}`,
        description: `بكدج مطبوع يجمع كتاب الشرح، ملزمة الأسئلة، وكراسة المراجعة النهائية للصف ${grade.label}. كل أدوات مذاكرتك في طلب واحد بسعر أوفر.`,
        kind: 'BUNDLE' as const,
        grade: grade.key,
        priceMinor: base + 11000,
        compareAtMinor: base + 19000,
        stock: 25,
        allowCod: true,
        active: true,
        featured: index === 2,
        pages: 420,
        image: null,
        highlights: [
          'كتاب الشرح الكامل',
          'ملزمة الأسئلة والتدريبات',
          'كراسة المراجعة النهائية',
        ],
      },
    ];
  },
);

const rateGroups = [
  {
    region: 'القاهرة الكبرى',
    priceMinor: 6000,
    names: [
      ['CAIRO', 'القاهرة'],
      ['GIZA', 'الجيزة'],
      ['QALYUBIA', 'القليوبية'],
    ],
  },
  {
    region: 'وجه بحري',
    priceMinor: 8000,
    names: [
      ['ALEXANDRIA', 'الإسكندرية'],
      ['BEHEIRA', 'البحيرة'],
      ['DAKAHLIA', 'الدقهلية'],
      ['DAMIETTA', 'دمياط'],
      ['GHARBIA', 'الغربية'],
      ['KAFR_EL_SHEIKH', 'كفر الشيخ'],
      ['MONUFIA', 'المنوفية'],
      ['SHARQIA', 'الشرقية'],
      ['PORT_SAID', 'بورسعيد'],
      ['ISMAILIA', 'الإسماعيلية'],
      ['SUEZ', 'السويس'],
    ],
  },
  {
    region: 'الصعيد',
    priceMinor: 10000,
    names: [
      ['FAYOUM', 'الفيوم'],
      ['BENI_SUEF', 'بني سويف'],
      ['MINYA', 'المنيا'],
      ['ASSIUT', 'أسيوط'],
      ['SOHAG', 'سوهاج'],
      ['QENA', 'قنا'],
      ['LUXOR', 'الأقصر'],
      ['ASWAN', 'أسوان'],
    ],
  },
  {
    region: 'المحافظات الحدودية',
    priceMinor: 10000,
    names: [
      ['RED_SEA', 'البحر الأحمر'],
      ['NEW_VALLEY', 'الوادي الجديد'],
      ['MATROUH', 'مطروح'],
      ['NORTH_SINAI', 'شمال سيناء'],
      ['SOUTH_SINAI', 'جنوب سيناء'],
    ],
  },
];
export const INITIAL_RATES: StoreRate[] = rateGroups.flatMap((group) =>
  group.names.map(([code, name]) => ({
    code,
    name,
    region: group.region,
    priceMinor: group.priceMinor,
  })),
);

export function demoOrders(): StoreOrder[] {
  return [
    {
      reference: 'DEMO-1001',
      method: 'COD' as const,
      status: 'CONFIRMED' as const,
      paymentStatus: 'UNPAID' as const,
      name: 'أحمد محمد',
      gov: 'CAIRO',
      city: 'مدينة نصر',
      shipping: 6000,
      index: 6,
    },
    {
      reference: 'DEMO-1002',
      method: 'INSTAPAY' as const,
      status: 'AWAITING_PAYMENT' as const,
      paymentStatus: 'SUBMITTED' as const,
      name: 'مريم حسن',
      gov: 'ALEXANDRIA',
      city: 'سموحة',
      shipping: 8000,
      index: 5,
    },
    {
      reference: 'DEMO-1003',
      method: 'VODAFONE_CASH' as const,
      status: 'SHIPPED' as const,
      paymentStatus: 'PAID' as const,
      name: 'يوسف علي',
      gov: 'ASSIUT',
      city: 'أسيوط',
      shipping: 10000,
      index: 0,
    },
  ].map((sample, index) => ({
    reference: sample.reference,
    method: sample.method,
    status: sample.status,
    paymentStatus: sample.paymentStatus,
    createdAt: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
    delivery: {
      customerName: sample.name,
      phone: `0100000000${index + 1}`,
      alternatePhone: `0110000000${index + 1}`,
      governorate: sample.gov,
      city: sample.city,
      address: 'شارع المثال، بجوار ميدان الحي',
      landmark: 'بجوار الصيدلية',
      building: '١٢',
      floor: 'الثاني',
      apartment: '٥',
      notes: '',
    },
    items: [{ product: { ...INITIAL_PRODUCTS[sample.index] }, quantity: 1 }],
    subtotalMinor: INITIAL_PRODUCTS[sample.index].priceMinor,
    shippingMinor: sample.shipping,
    totalMinor: INITIAL_PRODUCTS[sample.index].priceMinor + sample.shipping,
    transferReference:
      sample.paymentStatus === 'SUBMITTED' ? 'DEMO-TRANSFER-1002' : undefined,
    trackingNumber: sample.status === 'SHIPPED' ? 'DEMO-SHIP-1003' : undefined,
  }));
}

export function cartTotals(
  items: { product: StoreProduct; quantity: number }[],
  shippingMinor = 0,
) {
  const subtotalMinor = items.reduce(
    (sum, item) => sum + item.product.priceMinor * item.quantity,
    0,
  );
  return {
    subtotalMinor,
    shippingMinor,
    totalMinor: subtotalMinor + shippingMinor,
    codAllowed:
      items.length > 0 && items.every((item) => item.product.allowCod),
  };
}
