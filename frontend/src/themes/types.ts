export type HistoryThemeKey =
  | 'pharaonic-dawn'
  | 'renaissance-atlas'
  | 'modern-egypt-archive'
  | 'bacc-foundations'
  | 'revolution-chronicle';

export type ThemeKey =
  | HistoryThemeKey
  | 'chemistry-classroom'
  | 'biology-classroom'
  | 'physics-classroom'
  | 'custom-classroom';

/** Which decorative SVG motif the hero draws. See components/decor. */
export type MotifKey =
  | 'hieroglyph-columns'
  | 'compass-atlas'
  | 'archive-stack'
  | 'papyrus-grid'
  | 'banner-waves';

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
  coverImage: string;
  /**
   * Chronological span drawn on the animated timeline strip.
   * Provisional where the curriculum itself is provisional.
   */
  timeline: Array<{ label: string; caption: string }>;
  /** How the hero elements stagger in. Slower for the exam-year identity. */
  heroStagger: number;
}
