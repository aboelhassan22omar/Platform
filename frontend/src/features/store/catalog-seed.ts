import { platformConfig } from '../../config/platform.config';
import { STORE_GRADES } from './store-grades';
import type { StoreProduct } from './store.types';

export function createInitialProducts(subject = platformConfig.subject): StoreProduct[] {
  return STORE_GRADES.flatMap((grade, index) => {
    const base = index === 2 ? 22000 : 18000;
    return [
      {
        id: `${subject.key}-book-${grade.key}`,
        title: `كتاب ${subject.name} — ${grade.label}`,
        description: `دليلك المنظم لفهم منهج ${subject.name} للصف ${grade.label}. شرح مبسّط وخرائط ذهنية تربط الأفكار ببعضها. نسخة مطبوعة بتصميم مريح للمذاكرة.`,
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
        highlights: ['شرح المنهج درسًا بدرس', 'خرائط ذهنية وملخصات منظمة', 'تدريبات بعد كل فصل'],
      },
      {
        id: `${subject.key}-notes-${grade.key}`,
        title: `ملزمة الأسئلة — ${grade.label}`,
        description: `تدريبات متدرجة وأسئلة اختيار من متعدد على وحدات منهج ${grade.label}. راجع مستوى فهمك، واتدرب على ربط الأفكار وتحليل الأسئلة قبل الامتحان.`,
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
        highlights: ['أسئلة على كل درس', 'نماذج امتحانات شاملة', 'إجابات للمراجعة الذاتية'],
      },
      {
        id: `${subject.key}-bundle-${grade.key}`,
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
        highlights: ['كتاب الشرح الكامل', 'ملزمة الأسئلة والتدريبات', 'كراسة المراجعة النهائية'],
      },
    ];
  });
}

export const INITIAL_PRODUCTS = createInitialProducts();
