import type { StoreRate } from './store.types';

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
