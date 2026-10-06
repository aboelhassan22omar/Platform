export interface SeedLesson {
  title: string;
  description?: string;
  /** Placeholder price in piastres. null = only sold inside a package. */
  priceMinor?: number | null;
  isFreePreview?: boolean;
}

export interface SeedChapter {
  title: string;
  description?: string;
  priceMinor?: number | null;
  lessons: SeedLesson[];
}

export interface SeedUnit {
  title: string;
  description?: string;
  chapters: SeedChapter[];
}

export interface SeedCourse {
  title: string;
  description: string;
  /** See the sourcing note above. */
  isProvisional: boolean;
  /** Where the content came from, surfaced in the admin UI. */
  sourceNote: string;
  priceMinor?: number | null;
  units: SeedUnit[];
}

export type GradeKey = 'SEC_1' | 'SEC_2' | 'SEC_3' | 'BACC_1' | 'BACC_2';
