import type { SubjectKey } from './subject.types';

export interface SubjectProfile {
  key: SubjectKey;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
  };
  benefits: Array<{ title: string; description: string }>;
  accentHex: string;
  accent: { from: string; via: string; to: string };
}

const sharedBenefits = [
  { title: 'شرح منظم', description: 'دروس مرتبة على المنهج، من الأساسيات حتى أصعب الأفكار.' },
  { title: 'تدريب وقياس', description: 'واجبات واختبارات تقيس الفهم وتوضح نقاط التحسن.' },
  { title: 'متابعة مستمرة', description: 'تقدمك محفوظ لتكمل من آخر نقطة وتعرف ما أنجزته.' },
];

export const SUBJECT_PROFILES: Record<SubjectKey, SubjectProfile> = {
  history: {
    key: 'history',
    accentHex: '#c8952a',
    hero: {
      eyebrow: 'افهم الماضي لتصنع المستقبل',
      title: 'التاريخ قصة مترابطة، مش تواريخ للحفظ',
      description: 'شرح بصري وتحليل للأحداث والوثائق يساعدك تفهم السبب والنتيجة وتحل بثقة.',
    },
    benefits: sharedBenefits,
    accent: { from: '#030914', via: '#081f33', to: '#2a1408' },
  },
  chemistry: {
    key: 'chemistry',
    accentHex: '#47bfa0',
    hero: {
      eyebrow: 'افهم التفاعل قبل ما تحفظ المعادلة',
      title: 'الكيمياء بمنطق واضح وتدريب عملي',
      description: 'نبني المفاهيم خطوة بخطوة ونربط القوانين بالمسائل حتى تصل للحل بثقة.',
    },
    benefits: sharedBenefits,
    accent: { from: '#071a16', via: '#0e3a32', to: '#123d50' },
  },
  biology: {
    key: 'biology',
    accentHex: '#81bb52',
    hero: {
      eyebrow: 'شوف النظام كاملًا قبل التفاصيل',
      title: 'الأحياء فهم وربط، مش حفظ منفصل',
      description: 'رسومات وخرائط مفاهيم تربط التركيب بالوظيفة وتحوّل التفاصيل إلى صورة واحدة.',
    },
    benefits: sharedBenefits,
    accent: { from: '#07170f', via: '#174b2c', to: '#2d4a1f' },
  },
  physics: {
    key: 'physics',
    accentHex: '#729eed',
    hero: {
      eyebrow: 'افهم الفكرة قبل القانون',
      title: 'الفيزياء من التصور إلى الحل',
      description: 'نبسط الظواهر ونحوّلها إلى خطوات حسابية ثابتة مع تدريب متدرج على المسائل.',
    },
    benefits: sharedBenefits,
    accent: { from: '#071325', via: '#152f57', to: '#351b59' },
  },
  custom: {
    key: 'custom',
    accentHex: '#d9b465',
    hero: {
      eyebrow: 'تعلم بخطة واضحة',
      title: 'منهجك منظم من أول درس لآخر مراجعة',
      description: 'شرح وتدريب واختبارات ومتابعة تقدم في تجربة واحدة سهلة على كل الأجهزة.',
    },
    benefits: sharedBenefits,
    accent: { from: '#07101f', via: '#172d49', to: '#3a2b18' },
  },
};

export function getSubjectProfile(key: SubjectKey): SubjectProfile {
  return SUBJECT_PROFILES[key] ?? SUBJECT_PROFILES.custom;
}
