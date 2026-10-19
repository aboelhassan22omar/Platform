/** Shared API types. Mirrors the backend Prisma enums and read models. */

export type Role = 'STUDENT' | 'SUPPORT' | 'CONTENT_MANAGER' | 'ADMIN' | 'SUPER_ADMIN';
export type StudentType = 'ONLINE' | 'CENTER';
export type EducationSystem = 'GENERAL' | 'BACC';
export type GradeLevel = 'SEC_1' | 'SEC_2' | 'SEC_3' | 'BACC_1' | 'BACC_2';
export type PublishStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type AssessmentKind = 'HOMEWORK' | 'LESSON_EXAM' | 'UNIT_EXAM';
export type VideoStatus =
  | 'AWAITING_UPLOAD'
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';
export type ProductKind =
  | 'LESSON'
  | 'CHAPTER_BUNDLE'
  | 'COURSE'
  | 'ASSESSMENT'
  | 'MONTHLY_PLAN'
  | 'YEARLY_PLAN';
export type OrderStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type AccessReason =
  | 'FREE_PREVIEW'
  | 'LESSON_PURCHASE'
  | 'CHAPTER_BUNDLE'
  | 'COURSE_PURCHASE'
  | 'SUBSCRIPTION'
  | 'STAFF'
  | 'WRONG_GRADE'
  | 'NOT_PUBLISHED'
  | 'NO_ENTITLEMENT'
  | 'EXPIRED';

export interface Grade {
  id: string;
  educationSystem: EducationSystem;
  level: GradeLevel;
  nameAr: string;
  nameEn: string | null;
  shortNameAr: string;
  shortNameEn: string | null;
  slug: string;
  themeKey: string;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
}

export interface EducationSystemSummary {
  key: EducationSystem;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  grades: Grade[];
}

export interface LessonProgress {
  positionSeconds: number;
  percent: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  titleEn: string | null;
  slug: string;
  description: string | null;
  descriptionEn: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  status: PublishStatus;
  priceMinor: number | null;
  productId: string | null;
  isFreePreview: boolean;
  durationSeconds: number;
  chapterId: string;
  videoStatus: VideoStatus;
  isPlayable: boolean;
  isAccessible: boolean;
  progress: LessonProgress | null;
}

export interface CourseRef {
  id: string;
  title: string;
  slug: string;
  gradeSlug: string;
  themeKey: string;
}

/** A lesson as it appears in "حصصي". */
export interface LibraryLesson extends LessonSummary {
  accessVia: 'FREE_PREVIEW' | 'LESSON' | 'CHAPTER' | 'COURSE' | 'SUBSCRIPTION';
  expiresAt: string | null;
  course: CourseRef;
  chapterTitle: string;
  unitTitle: string;
}

export interface ContinueWatchingItem extends LessonSummary {
  course: CourseRef;
  chapterTitle: string;
}

export interface Chapter {
  id: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  priceMinor: number | null;
  productId: string | null;
  lessons: LessonSummary[];
}

export interface Unit {
  id: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  chapters: Chapter[];
}

export interface CourseDetail {
  id: string;
  title: string;
  titleEn: string | null;
  slug: string;
  description: string | null;
  descriptionEn: string | null;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  status: PublishStatus;
  isProvisional: boolean;
  priceMinor: number | null;
  productId: string | null;
  academicYear: string;
  grade: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    shortNameAr: string;
    shortNameEn: string | null;
    themeKey: string;
    educationSystem: EducationSystem;
  };
  lessonCount: number;
  accessibleCount: number;
  units: Unit[];
}

export interface Plan {
  id: string;
  productId: string | null;
  kind: ProductKind;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  priceMinor: number;
  currency: string;
  durationDays: number | null;
  accessUntil: string | null;
  highlights: string[];
  highlightsEn: string[];
}

export interface GradeDetail extends Grade {
  courses: Array<{
    id: string;
    title: string;
    titleEn: string | null;
    slug: string;
    description: string | null;
    descriptionEn: string | null;
    thumbnailUrl: string | null;
    coverUrl: string | null;
    unitCount: number;
    academicYear: string;
    priceMinor: number | null;
    isProvisional: boolean;
  }>;
  plans: Plan[];
}

export interface LessonDetail extends LessonSummary {
  access: { allowed: boolean; reason: AccessReason; expiresAt: string | null };
  attachments: Array<{
    id: string;
    title: string;
    contentType: string;
    sizeBytes: number;
  }>;
  chapter: { id: string; title: string };
  unit: { id: string; title: string };
  course: {
    id: string;
    title: string;
    slug: string;
    gradeSlug: string;
    gradeName: string;
    themeKey: string;
  };
}

export interface PlaybackTicket {
  status: 'ADMITTED';
  ticket: string;
  expiresIn: number;
  manifestUrl: string;
  posterUrl: string | null;
  durationSeconds: number;
  renditions: string[];
  accessReason: AccessReason;
  resumeAtSeconds: number;
  /** 0 when the platform has no viewer limit: no heartbeat is needed. */
  heartbeatSeconds: number;
  /** Null for staff. */
  views: ViewAllowance | null;
}

/** How much of a lesson's view allowance a student has left. */
export interface ViewAllowance {
  limited: boolean;
  maxViews: number;
  bonusViews: number;
  durationSeconds: number;
  viewedSeconds: number;
  remainingSeconds: number | null;
  viewsUsed: number;
  remainingViews: number | null;
  exhausted: boolean;
}

/** The platform is at its viewer limit; the student waits their turn. */
export interface PlaybackQueue {
  admitted: false;
  /** 1-based place in line; 0 when even the waiting room is full. */
  position: number;
  etaSeconds: number;
  retryAfterSeconds: number;
  capacity: number;
}

export type PlaybackResponse = PlaybackTicket | { status: 'QUEUED'; queue: PlaybackQueue };

export type PlaybackHeartbeat = { admitted: true } | PlaybackQueue;

export interface Order {
  id: string;
  reference: string;
  status: OrderStatus;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  purpose: 'PURCHASE' | 'WALLET_TOPUP';
  paidFromWallet: boolean;
  /** A top-up has one synthetic line with kind null. */
  items: Array<{ id: string; title: string; kind: ProductKind | null; totalMinor: number }>;
  redirectUrl: string | null;
  payment: {
    provider: string;
    isSandbox: boolean;
    notice?: string;
    transfer?: TransferDetails;
  };
}

export interface Subscription {
  id: string;
  status: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  daysRemaining: number;
  plan: { id: string; title: string; kind: ProductKind; grade: Grade };
  order: { reference: string; totalMinor: number; paidAt: string | null } | null;
}

export interface ProgressSummary {
  lessonsStarted: number;
  lessonsCompleted: number;
  lessonsInProgress: number;
  totalWatchedSeconds: number;
}

export interface LeaderboardStudent {
  id: string;
  fullName: string;
  rank: number;
  totalPoints: number;
  videoPoints: number;
  homeworkPoints: number;
  examPoints: number;
  completionPoints: number;
  lessonsCompleted: number;
  assessmentsCompleted: number;
  averageScore: number;
}

export interface LeaderboardResponse {
  gradeLevel: GradeLevel | null;
  topStudents: LeaderboardStudent[];
  currentStudent: LeaderboardStudent | null;
  scoring: {
    videoProgressMax: number;
    videoCompletionBonus: number;
    homeworkMultiplier: number;
    lessonExamMultiplier: number;
    unitExamMultiplier: number;
    assessmentCompletionBonus: number;
  };
}

export interface AchievementBadge {
  id: string;
  name: string;
  icon:
    | 'trophy'
    | 'crown'
    | 'medal'
    | 'scroll'
    | 'star'
    | 'eye'
    | 'ankh'
    | 'scarab'
    | 'pyramid'
    | 'lotus'
    | 'play'
    | 'book'
    | 'compass'
    | 'shield'
    | 'lightning'
    | 'diamond'
    | 'sword'
    | 'brain';
  category:
    | 'ranking'
    | 'videos'
    | 'homework'
    | 'exams'
    | 'points'
    | 'completion'
    | 'units'
    | 'special';
  earned: boolean;
  progress: number;
  requirement: string;
}

export interface AchievementsResponse {
  gradeName: string;
  title: { name: string; tier: string; nextAt: number | null };
  completionPercent: number;
  earnedCount: number;
  totalCount: number;
  badges: AchievementBadge[];
}

export interface StudentAssessment {
  id: string;
  title: string;
  description: string | null;
  kind: AssessmentKind;
  timeLimitMinutes: number | null;
  passingScore: number;
  /** Minimum % for a certificate, or null when the exam has none. */
  certificateMinScore: number | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isFree: boolean;
  priceMinor: number | null;
  productId: string | null;
  isAccessible: boolean;
  availableFrom: string | null;
  dueAt: string | null;
  questionCount: number;
  attemptCount: number;
  isOverdue: boolean;
  latestAttempt: {
    id: string;
    percentage: number;
    passed: boolean;
    submittedAt: string;
    needsGrading?: boolean;
  } | null;
  lesson: { title: string; unitTitle: string; courseTitle: string } | null;
  unit: { title: string; courseTitle: string } | null;
}

export interface StudentCertificate {
  serial: string;
  assessmentId: string;
  assessmentTitle: string;
  percentage: number;
  issuedAt: string;
}

export interface AssessmentDetail
  extends Omit<StudentAssessment, 'questionCount' | 'isOverdue' | 'lesson' | 'unit'> {
  status: PublishStatus;
  lesson: { title: string } | null;
  unit: { title: string } | null;
  questions: Array<{
    id: string;
    prompt: string;
    points: number;
    sortOrder: number;
    options: Array<{ id: string; text: string; sortOrder: number }>;
  }>;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminOverview {
  students: {
    total: number;
    active: number;
    suspended: number;
    newThisWeek: number;
    bySystem: Array<{ educationSystem: EducationSystem; count: number }>;
    byGrade: Array<{ gradeLevel: GradeLevel; nameAr: string; count: number }>;
  };
  online: {
    total: number;
    byGrade: Array<{ gradeLevel: string; count: number }>;
    definition?: string;
  };
  content: { totalLessons: number; publishedLessons: number; publishedCourses: number };
  commerce: {
    paidOrders: number;
    revenueMinor: number;
    activeSubscriptions: number;
    activeEntitlements: number;
  };
}

export interface AdminStudent {
  studentType: StudentType;
  id: string;
  fullName: string;
  username: string;
  phone: string;
  parentPhone: string;
  educationSystem: EducationSystem | null;
  gradeLevel: GradeLevel | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { entitlements: number; orders: number; progress: number };
}

export interface AdminLessonAccess {
  id: string;
  title: string;
  priceMinor: number | null;
  chapterTitle: string;
  unitTitle: string;
  courseId: string;
  courseTitle: string;
  gradeName: string;
  isAccessible: boolean;
  accessKind: 'ADMIN_GRANT' | 'OTHER' | 'NONE';
  adminGrantEntitlementId: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminPlan {
  id: string;
  gradeId: string;
  academicYearId: string;
  kind: ProductKind;
  title: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  durationDays: number | null;
  accessUntil: string | null;
  isActive: boolean;
  sortOrder: number;
  highlights: string[];
  grade: { nameAr: string; slug: string };
  academicYear: { label: string };
  products: Array<{ id: string; isActive: boolean }>;
  _count: { subscriptions: number };
}

// ---------------------------------------------------------------------------
// Live classes
// ---------------------------------------------------------------------------

export type LiveSessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface LiveSessionSummary {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  status: LiveSessionStatus;
  chatEnabled: boolean;
  recordingEnabled: boolean;
  /** Why it ended: the teacher pressed end, or left and never came back. */
  endReason: 'HOST_ENDED' | 'HOST_LEFT' | null;
  grade: { id: string; nameAr: string; shortNameAr: string; slug: string; themeKey: string };
}

export interface LiveSessionDetail extends LiveSessionSummary {
  isHost: boolean;
  /** Teacher only: a recording segment is running right now. */
  recording: boolean;
  /** False until LiveKit keys are configured on the server. */
  streamingReady: boolean;
}

export type LiveRecordingStatus = 'RECORDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface LiveRecording {
  id: string;
  status: LiveRecordingStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  error: string | null;
  publishedAt?: string | null;
  /** The lesson this recording was published to, and its video's state. */
  publishedLesson?: {
    id: string;
    title: string;
    videoAsset: { status: string; processedAt: string | null } | null;
  } | null;
}

export interface AdminLiveSession extends LiveSessionSummary {
  counts: { messages: number; reactions: number };
  recordings: LiveRecording[];
}

export interface LiveChatMessage {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; isHost: boolean };
}

export interface LiveReactionEvent {
  id: string;
  emoji: string;
  userId: string;
  name: string;
  createdAt: string;
}

export type LiveEvent =
  | { type: 'chat'; message: LiveChatMessage }
  | { type: 'chat-state'; enabled: boolean }
  | { type: 'reaction'; reaction: LiveReactionEvent }
  | { type: 'recording'; active: boolean }
  | { type: 'ended' };

/** Manual transfer destination and where the student's proof stands. */
export interface TransferDetails {
  method: 'INSTAPAY' | 'VODAFONE_CASH';
  phone: string;
  instapayLink: string | null;
  instapayAddress: string | null;
  recipientName: string | null;
  /** WhatsApp number the student sends the transfer screenshot to. */
  whatsappPhone: string | null;
  senderPhone: string | null;
  state: 'waiting' | 'submitted' | 'rejected';
  rejectionReason: string | null;
  submitted: boolean;
}

// ---------------------------------------------------------------------------
// Wallet and devices
// ---------------------------------------------------------------------------

export type WalletTransactionType = 'TOPUP' | 'PURCHASE' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT';

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  /** Signed piastres: positive adds, negative spends. */
  amountMinor: number;
  balanceAfterMinor: number;
  note: string | null;
  createdAt: string;
  orderReference: string | null;
  items: string[];
}

export interface WalletSummary {
  balanceMinor: number;
  transactions: WalletTransaction[];
}

export interface SignedInDevice {
  id: string;
  label: string;
  ip?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isCurrent?: boolean;
}

export interface DeviceList {
  /** 0 = unlimited. */
  limit: number;
  /** No device limit for this account (the app-store reviewers' demo account). */
  exempt?: boolean;
  devices: SignedInDevice[];
}

export interface LessonViewUsage extends ViewAllowance {
  lessonId: string;
  title: string;
  lastWatchedAt: string;
}

// ---------------------------------------------------------------------------
// WhatsApp messages and parent reports
// ---------------------------------------------------------------------------

export type MessageKind =
  | 'WEEKLY_REPORT'
  | 'NEW_LESSON'
  | 'LIVE_REMINDER'
  | 'HOMEWORK_DUE'
  | 'SUBSCRIPTION_EXPIRING'
  | 'PAYMENT_CONFIRMED'
  | 'QUESTION_ANSWERED'
  | 'CENTER_ABSENCE';

export type MessageStatus =
  | 'PENDING'
  | 'MANUAL'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'CANCELLED';

export interface ParentReportData {
  student: { name: string; grade: string | null };
  period: { from: string; to: string };
  watch: {
    totalSeconds: number;
    previousSeconds: number;
    activeDays: number;
    days: Array<{ date: string; seconds: number }>;
  };
  lessons: { watched: number; completed: string[] };
  exams: Array<{ title: string; kind: string; percentage: number; passed: boolean }>;
  missedHomework: Array<{ title: string; dueAt: string }>;
  attendance?: { held: number; attended: number } | null;
  lastSeenAt: string | null;
}

export interface MessagingSettings {
  mode: 'off' | 'manual' | 'cloud';
  kinds: Record<MessageKind, boolean>;
  weeklyReport: { weekday: number; hour: number; audience: 'paying' | 'all' };
  quietHours: { enabled: boolean; from: number; to: number };
}

export interface MessageTemplateInfo {
  kind: MessageKind;
  name: string;
  audience: 'STUDENT' | 'PARENT';
  category: 'UTILITY' | 'MARKETING';
  label: string;
  description: string;
  params: string[];
  text: string;
}

export interface MessagingOverview {
  settings: MessagingSettings;
  cloud: { configured: boolean; phoneNumberId: string | null };
  templates: MessageTemplateInfo[];
  counts: Partial<Record<MessageStatus, number>>;
}

export interface OutboundMessageRow {
  id: string;
  kind: MessageKind;
  audience: 'STUDENT' | 'PARENT';
  toPhone: string;
  body: string;
  status: MessageStatus;
  attempts: number;
  lastError: string | null;
  scheduledFor: string;
  expiresAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
  whatsappLink: string;
}

export interface StudentParentReport {
  enabled: boolean;
  parentPhone: string;
  preview: ParentReportData;
  latestReportUrl: string | null;
  messages: Array<{
    id: string;
    kind: MessageKind;
    audience: 'STUDENT' | 'PARENT';
    status: MessageStatus;
    createdAt: string;
    sentAt: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Lesson Q&A
// ---------------------------------------------------------------------------

export interface LessonQuestionReply {
  id: string;
  body: string;
  fromStaff: boolean;
  createdAt: string;
  edited: boolean;
  author: string;
  mine: boolean;
}

export interface LessonQuestionThread {
  id: string;
  lessonId: string;
  body: string;
  videoSeconds: number | null;
  status: 'OPEN' | 'ANSWERED';
  pinned: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  author: string;
  authorId?: string;
  mine: boolean;
  votes: number;
  votedByMe: boolean;
  replies: LessonQuestionReply[];
  /** Present in the staff inbox. */
  lesson?: { id: string; title: string; courseTitle: string };
}

export interface LessonQuestionPage {
  items: LessonQuestionThread[];
  total: number;
  open: number;
  page: number;
  pageSize: number;
}
