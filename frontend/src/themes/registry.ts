/**
 * The five academic experiences.
 *
 * Each grade renders through the same components, but this registry changes
 * its accent metal, hero motif, decorative SVG, background composition and
 * motion sequence — so the five pages read as genuinely different places
 * while staying recognisably one brand.
 *
 * `themeKey` comes from the Grade row in the database, so a new grade can be
 * pointed at an existing identity without a code change.
 */

export type ThemeKey =
  | 'pharaonic-dawn'
  | 'renaissance-atlas'
  | 'modern-egypt-archive'
  | 'bacc-foundations'
  | 'revolution-chronicle';

/** Which decorative SVG motif the hero draws. See components/decor. */
export type MotifKey = 'hieroglyph-columns' | 'compass-atlas' | 'archive-stack' | 'papyrus-grid' | 'banner-waves';

export interface AcademicTheme {
  key: ThemeKey;
  /** Short Arabic label for the era this grade studies. */
  eraLabel: string;
  /** One-line Arabic framing shown under the hero title. */
  eraTagline: string;
  motif: MotifKey;
  /** Tailwind classes for the hero's dark backdrop. */
  heroSurface: string;
  /** Accent colour as a raw hex, for SVG fills and canvas. */
  accentHex: string;
  /** Secondary decorative colour. */
  secondaryHex: string;
  /** Era-specific teacher artwork used by heroes and image fallbacks. */
  heroImage: string;
  /** Compact portrait used by the phone-only hero card. */
  portraitImage: string;
  /**
   * Chronological span drawn on the animated timeline strip.
   * Provisional where the curriculum itself is provisional.
   */
  timeline: Array<{ label: string; caption: string }>;
  /** How the hero elements stagger in. Slower for the exam-year identity. */
  heroStagger: number;
}

export const ACADEMIC_THEMES: Record<ThemeKey, AcademicTheme> = {
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
    timeline: [
      { label: '١٩١٩', caption: 'الحركة الوطنية' },
      { label: '١٩٥٢', caption: 'ثورة ٢٣ يوليو' },
      { label: '١٩٥٦', caption: 'تأميم القناة' },
      { label: '١٩٧٣', caption: 'نصر أكتوبر' },
    ],
    heroStagger: 0.095,
  },
};

export const DEFAULT_THEME_KEY: ThemeKey = 'pharaonic-dawn';

export const getTheme = (key: string | null | undefined): AcademicTheme =>
  ACADEMIC_THEMES[(key as ThemeKey) ?? DEFAULT_THEME_KEY] ??
  ACADEMIC_THEMES[DEFAULT_THEME_KEY];
