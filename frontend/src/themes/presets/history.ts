import type { AcademicTheme, HistoryThemeKey } from '../types';

export const HISTORY_THEMES: Record<HistoryThemeKey, AcademicTheme> = {
  // --------------------------------------------------------------------------
  // أولى ثانوي — حضارة مصر والعالم القديم
  // --------------------------------------------------------------------------
  'pharaonic-dawn': {
    key: 'pharaonic-dawn',
    eraLabel: 'الحضارات القديمة',
    eraTagline: 'من وادي النيل لبلاد الرافدين، ومن الإغريق للرومان',
    motif: 'hieroglyph-columns',
    heroSurface: 'from-midnight-950 via-midnight-900 to-midnight-800',
    accentHex: '#c8952a',
    secondaryHex: '#2f6f9e',
    heroImage: '/images/teacher-pharaonic.png',
    portraitImage: '/images/eras/pharaonic-portrait.jpg',
    coverImage: '/images/eras/pharaonic-cover.jpg',
    timeline: [
      { label: '٣١٠٠ ق.م', caption: 'توحيد القطرين' },
      { label: '٢٦٠٠ ق.م', caption: 'عصر بناة الأهرام' },
      { label: '١٥٠٠ ق.م', caption: 'الدولة الحديثة' },
      { label: '٣٣٢ ق.م', caption: 'العصر اليوناني' },
      { label: '٣٠ ق.م', caption: 'العصر الروماني' },
    ],
    heroStagger: 0.09,
  },

  // --------------------------------------------------------------------------
  // تانية ثانوي — أوروبا الحديثة والدولة العثمانية
  // --------------------------------------------------------------------------
  'renaissance-atlas': {
    key: 'renaissance-atlas',
    eraLabel: 'العصر الحديث المبكر',
    eraTagline: 'الكشوف الجغرافية، النهضة الأوروبية، والعالم العربي العثماني',
    motif: 'compass-atlas',
    heroSurface: 'from-midnight-950 via-[#0d2420] to-[#10302a]',
    accentHex: '#2f7d6b',
    secondaryHex: '#c08552',
    heroImage: '/images/teacher-renaissance.png',
    portraitImage: '/images/eras/renaissance-portrait.jpg',
    coverImage: '/images/eras/renaissance-cover.jpg',
    timeline: [
      { label: '١٤٥٣', caption: 'فتح القسطنطينية' },
      { label: '١٤٩٢', caption: 'الكشوف الجغرافية' },
      { label: '١٥١٧', caption: 'مصر ولاية عثمانية' },
      { label: '١٦٠٠', caption: 'أوروبا تتحول' },
    ],
    heroStagger: 0.08,
  },

  // --------------------------------------------------------------------------
  // تالتة ثانوي — سنة الامتحان. Calmest motion, highest information density.
  // --------------------------------------------------------------------------
  'modern-egypt-archive': {
    key: 'modern-egypt-archive',
    eraLabel: 'مصر الحديثة والمعاصرة',
    eraTagline: 'من الحملة الفرنسية لبناء الدولة، وصولاً للكفاح الوطني',
    motif: 'archive-stack',
    heroSurface: 'from-midnight-950 via-[#241018] to-[#2e1219]',
    accentHex: '#8c2f39',
    secondaryHex: '#1d2a47',
    heroImage: '/images/teacher-modern-egypt.png',
    portraitImage: '/images/eras/modern-portrait.jpg',
    coverImage: '/images/eras/modern-cover.jpg',
    timeline: [
      { label: '١٧٩٨', caption: 'الحملة الفرنسية' },
      { label: '١٨٠٥', caption: 'محمد علي' },
      { label: '١٨٨٢', caption: 'الاحتلال البريطاني' },
      { label: '١٩١٩', caption: 'ثورة ١٩١٩' },
      { label: '١٩٥٢', caption: 'ثورة يوليو' },
    ],
    // Slower, more deliberate — the exam year should feel composed, not busy.
    heroStagger: 0.12,
  },

  // --------------------------------------------------------------------------
  // أولى بكالوريا — same curriculum as SEC_1, distinct identity.
  // --------------------------------------------------------------------------
  'bacc-foundations': {
    key: 'bacc-foundations',
    eraLabel: 'أسس البكالوريا',
    eraTagline: 'الحضارات القديمة بمنهجية التفكير التاريخي والتحليل',
    motif: 'papyrus-grid',
    heroSurface: 'from-midnight-950 via-midnight-900 to-[#1a2c4d]',
    accentHex: '#476199',
    secondaryHex: '#c8952a',
    heroImage: '/images/teacher-bacc-foundations.png',
    portraitImage: '/images/eras/bacc-portrait.jpg',
    coverImage: '/images/eras/bacc-cover.jpg',
    timeline: [
      { label: 'الوحدة ١', caption: 'مدخل للحضارة' },
      { label: 'الوحدة ٢', caption: 'مصر الفرعونية' },
      { label: 'الوحدة ٣', caption: 'الشرق الأدنى' },
      { label: 'الوحدة ٤', caption: 'اليونان والرومان' },
    ],
    heroStagger: 0.085,
  },

  // --------------------------------------------------------------------------
  // تانية بكالوريا — ثورة يوليو والتحولات الكبرى
  // --------------------------------------------------------------------------
  'revolution-chronicle': {
    key: 'revolution-chronicle',
    eraLabel: 'ثورة يوليو والتحولات',
    eraTagline: 'صمود الشعب المصري، ثورة ٢٣ يوليو، ومصر المعاصرة',
    motif: 'banner-waves',
    heroSurface: 'from-midnight-950 via-[#2a1408] to-[#331a0c]',
    accentHex: '#b5622c',
    secondaryHex: '#dcaf3a',
    heroImage: '/images/teacher-revolution.png',
    portraitImage: '/images/eras/revolution-portrait.jpg',
    coverImage: '/images/eras/revolution-cover.jpg',
    timeline: [
      { label: '١٩١٩', caption: 'الحركة الوطنية' },
      { label: '١٩٥٢', caption: 'ثورة ٢٣ يوليو' },
      { label: '١٩٥٦', caption: 'تأميم القناة' },
      { label: '١٩٧٣', caption: 'نصر أكتوبر' },
    ],
    heroStagger: 0.095,
  },
};
