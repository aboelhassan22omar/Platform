import { MessageAudience, MessageKind } from '../generated/prisma/enums';

/**
 * One WhatsApp template per message kind.
 *
 * Business-initiated WhatsApp messages must use templates approved by Meta,
 * so these texts are submitted as-is in WhatsApp Manager under `name`. The
 * same text, filled in, is what staff send by hand in manual mode, so the two
 * modes read identically. Meta's rules: a body may not start or end with a
 * {{n}} variable, and a variable value may not contain new lines.
 */
export interface MessageTemplate {
  kind: MessageKind;
  name: string;
  audience: MessageAudience;
  /** Meta pricing category to choose when submitting. */
  category: 'UTILITY' | 'MARKETING';
  /** Shown to the admin. */
  label: string;
  description: string;
  /** What each {{n}} holds, in order — for the admin and for Meta's samples. */
  params: string[];
  text: string;
}

export const MESSAGE_TEMPLATES: Record<MessageKind, MessageTemplate> = {
  WEEKLY_REPORT: {
    kind: MessageKind.WEEKLY_REPORT,
    name: 'weekly_parent_report',
    audience: MessageAudience.PARENT,
    category: 'UTILITY',
    label: 'التقرير الأسبوعي لولي الأمر',
    description:
      'ملخص أسبوع الطالب: وقت المذاكرة والحصص والامتحانات والواجبات، ومعاه لينك التقرير كامل.',
    params: [
      'اسم الطالب',
      'وقت المذاكرة',
      'الحصص اللي خلّصها',
      'الامتحانات',
      'الواجبات اللي متحلّتش',
      'لينك التقرير',
    ],
    text: [
      'تقرير الأسبوع لـ {{1}} 📊',
      '⏱ وقت المذاكرة: {{2}}',
      '✅ حصص خلّصها: {{3}}',
      '📝 الامتحانات: {{4}}',
      '⚠️ واجبات متحلّتش: {{5}}',
      '',
      'التقرير بالتفصيل: {{6}}',
      'مع تحيات فريق المتابعة 🌟',
    ].join('\n'),
  },
  NEW_LESSON: {
    kind: MessageKind.NEW_LESSON,
    name: 'new_lesson_available',
    audience: MessageAudience.STUDENT,
    category: 'MARKETING',
    label: 'حصة جديدة نزلت',
    description: 'لطلاب الصف أول ما حصة جديدة تتنشر وفيديوها يبقى جاهز.',
    params: ['اسم الحصة', 'الكورس', 'لينك الحصة'],
    text: ['حصة جديدة نزلت 🎬', '«{{1}}» في {{2}}.', 'شوفها من هنا: {{3}}', 'بالتوفيق 💪'].join(
      '\n',
    ),
  },
  LIVE_REMINDER: {
    kind: MessageKind.LIVE_REMINDER,
    name: 'live_class_reminder',
    audience: MessageAudience.STUDENT,
    category: 'UTILITY',
    label: 'تذكير باللايف قبلها بساعة',
    description: 'لطلاب الصف قبل اللايف بساعة. لو اتأخرت لحد ما اللايف بدأ مش بتتبعت.',
    params: ['عنوان اللايف', 'الساعة', 'لينك اللايف'],
    text: [
      'فاضل ساعة على اللايف ⏰',
      '«{{1}}» هيبدأ الساعة {{2}}.',
      'ادخل من هنا: {{3}}',
      'متتأخرش 👋',
    ].join('\n'),
  },
  HOMEWORK_DUE: {
    kind: MessageKind.HOMEWORK_DUE,
    name: 'homework_due_reminder',
    audience: MessageAudience.STUDENT,
    category: 'UTILITY',
    label: 'تذكير بالواجب قبل آخر ميعاد',
    description: 'للطالب اللي لسه محلّش الواجب، قبل آخر ميعاد بيوم.',
    params: ['اسم الواجب', 'آخر ميعاد', 'لينك الواجب'],
    text: [
      'متنساش الواجب 📝',
      '«{{1}}» آخر ميعاد لتسليمه {{2}}.',
      'حلّه من هنا: {{3}}',
      'بالتوفيق 💪',
    ].join('\n'),
  },
  SUBSCRIPTION_EXPIRING: {
    kind: MessageKind.SUBSCRIPTION_EXPIRING,
    name: 'subscription_expiring',
    audience: MessageAudience.STUDENT,
    category: 'UTILITY',
    label: 'الاشتراك قرّب يخلص',
    description: 'للطالب قبل ما اشتراكه يخلص بـ٣ أيام.',
    params: ['اسم الباقة', 'ميعاد النهاية', 'لينك التجديد'],
    text: [
      'اشتراكك في «{{1}}» هيخلص {{2}} ⏳',
      'جدّده من هنا عشان متفوتكش حصص: {{3}}',
      'شكرًا إنك معانا 🌟',
    ].join('\n'),
  },
  PAYMENT_CONFIRMED: {
    kind: MessageKind.PAYMENT_CONFIRMED,
    name: 'payment_confirmed',
    audience: MessageAudience.STUDENT,
    category: 'UTILITY',
    label: 'تأكيد الدفع',
    description: 'للطالب أول ما تأكد تحويله من «سجل المدفوعات».',
    params: ['رقم الطلب', 'اللي اتفتح', 'لينك'],
    text: [
      'تم تأكيد الدفع ✅',
      'طلبك رقم {{1}} اتأكد، و{{2}}.',
      'تقدر تكمل من هنا: {{3}}',
      'شكرًا إنك معانا 🌟',
    ].join('\n'),
  },
  QUESTION_ANSWERED: {
    kind: MessageKind.QUESTION_ANSWERED,
    name: 'lesson_question_answered',
    audience: MessageAudience.STUDENT,
    category: 'UTILITY',
    label: 'الرد على سؤال الطالب',
    description: 'للطالب أول ما المستر أو المساعد يرد على سؤاله تحت الحصة.',
    params: ['اسم الحصة', 'لينك السؤال'],
    text: [
      'المستر رد على سؤالك ✍️',
      'في حصة «{{1}}».',
      'شوف الرد من هنا: {{2}}',
      'بالتوفيق 💪',
    ].join('\n'),
  },
};

/** WhatsApp rejects variable values with new lines, tabs or long space runs. */
export const cleanParam = (value: string): string =>
  value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 900) || '—';

export const renderTemplate = (text: string, params: string[]): string =>
  text.replace(/\{\{(\d+)\}\}/g, (_, index: string) => params[Number(index) - 1] ?? '');
