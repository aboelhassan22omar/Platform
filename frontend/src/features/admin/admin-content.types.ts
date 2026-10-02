import type { PublishStatus, VideoStatus } from '@/types/api';

export interface AdminGrade {
  id: string;
  nameAr: string;
  shortNameAr: string;
  slug: string;
  themeKey: string;
  educationSystem: string;
}

export interface AdminCourseSummary {
  id: string;
  title: string;
  slug: string;
  status: PublishStatus;
  isProvisional: boolean;
  priceMinor: number | null;
  grade: { id?: string; nameAr: string; shortNameAr?: string; slug: string; themeKey: string };
  academicYear: { label: string };
  _count: { units: number };
}

export interface AdminLesson {
  id: string;
  title: string;
  description: string | null;
  status: PublishStatus;
  sortOrder: number;
  priceMinor: number | null;
  isFreePreview: boolean;
  videoAsset: {
    status: VideoStatus;
    originalName: string | null;
    errorMessage: string | null;
  } | null;
  attachments: Array<{ id: string; title: string; contentType: string; sizeBytes: number }>;
}

export interface AdminChapter {
  id: string;
  title: string;
  description: string | null;
  status: PublishStatus;
  sortOrder: number;
  priceMinor: number | null;
  lessons: AdminLesson[];
}

export interface AdminUnit {
  id: string;
  title: string;
  description: string | null;
  status: PublishStatus;
  sortOrder: number;
  chapters: AdminChapter[];
}

export interface AdminCourseDetail extends Omit<AdminCourseSummary, '_count'> {
  description: string | null;
  grade: { id: string; nameAr: string; slug: string; themeKey: string };
  units: AdminUnit[];
}

export type EntityKind = 'course' | 'unit' | 'chapter' | 'lesson';

export interface EditorTarget {
  kind: EntityKind;
  mode: 'create' | 'edit';
  parentId?: string;
  gradeId?: string;
  entity?: {
    id: string;
    title: string;
    description: string | null;
    status: PublishStatus;
    sortOrder?: number;
    priceMinor?: number | null;
    isFreePreview?: boolean;
    gradeId?: string;
    scheduledAt?: string | null;
  };
}

export const STATUS_LABELS: Record<PublishStatus, string> = {
  DRAFT: 'مسودة',
  SCHEDULED: 'مجدول',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
};

export const VIDEO_LABELS: Partial<Record<VideoStatus, string>> = {
  AWAITING_UPLOAD: 'في انتظار الرفع',
  UPLOADED: 'تم الرفع',
  QUEUED: 'في قائمة المعالجة',
  PROCESSING: 'جاري تجهيز الفيديو',
  READY: 'الفيديو جاهز',
  FAILED: 'فشلت المعالجة',
};
