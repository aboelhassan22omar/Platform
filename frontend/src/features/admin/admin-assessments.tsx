'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import type { AssessmentKind, PublishStatus } from '@/types/api';

interface CurriculumCourse {
  id: string;
  title: string;
  academicYear: { id: string; label: string };
  grade: { id: string; nameAr: string };
  units: Array<{
    id: string;
    title: string;
    chapters: Array<{ lessons: Array<{ id: string; title: string }> }>;
  }>;
}
interface AdminAssessment {
  id: string;
  title: string;
  description: string | null;
  kind: AssessmentKind;
  status: PublishStatus;
  lessonId: string | null;
  unitId: string | null;
  timeLimitMinutes: number | null;
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isFree: boolean;
  priceMinor: number | null;
  availableFrom: string | null;
  dueAt: string | null;
  averageScore: number | null;
  passedCount: number;
  lesson: { title: string; chapter: { unit: { title: string; course: { title: string } } } } | null;
  unit: { title: string; course: { title: string } } | null;
  _count: { questions: number; attempts: number };
}
interface EditorQuestion {
  prompt: string;
  explanation: string;
  points: number;
  options: Array<{ text: string; isCorrect: boolean }>;
}
interface EditorState {
  id?: string;
  title: string;
  description: string;
  kind: AssessmentKind;
  status: PublishStatus;
  gradeId: string;
  lessonId: string;
  unitId: string;
  timeLimitMinutes: string;
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isFree: boolean;
  pricePounds: string;
  availableFrom: string;
  dueAt: string;
  questions: EditorQuestion[];
}

const blankQuestion = (): EditorQuestion => ({
  prompt: '',
  explanation: '',
  points: 1,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
});
const blankEditor = (): EditorState => ({
  title: '',
  description: '',
  kind: 'HOMEWORK',
  status: 'DRAFT',
  gradeId: '',
  lessonId: '',
  unitId: '',
  timeLimitMinutes: '',
  passingScore: 50,
  maxAttempts: 1,
  shuffleQuestions: false,
  shuffleOptions: false,
  isFree: true,
  pricePounds: '',
  availableFrom: '',
  dueAt: '',
  questions: [blankQuestion()],
});
const kindLabels: Record<AssessmentKind, string> = {
  HOMEWORK: 'واجب على الدرس',
  LESSON_EXAM: 'اختبار على الدرس',
  UNIT_EXAM: 'امتحان شامل على الوحدة',
};
const statusLabels: Record<PublishStatus, string> = {
  DRAFT: 'مسودة',
  SCHEDULED: 'مجدول',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
};
const toLocalInput = (value: string | null) =>
  value
    ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';

export function AdminAssessments() {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: () => api.get<AdminAssessment[]>('/admin/assessments'),
  });
  const curriculum = useQuery({
    queryKey: ['assessment-curriculum'],
    queryFn: () => api.get<CurriculumCourse[]>('/admin/assessments/curriculum'),
  });
  const detail = useMutation({
    mutationFn: (id: string) =>
      api.get<
        AdminAssessment & {
          questions: Array<{
            prompt: string;
            explanation: string | null;
            points: number;
            options: Array<{ text: string; isCorrect: boolean }>;
          }>;
        }
      >(`/admin/assessments/${id}`),
    onSuccess: (item) => {
      const course = curriculum.data?.find((candidate) =>
        candidate.units.some(
          (unit) =>
            unit.id === item.unitId ||
            unit.chapters.some((chapter) =>
              chapter.lessons.some((lesson) => lesson.id === item.lessonId),
            ),
        ),
      );
      setEditor({
        id: item.id,
        title: item.title,
        description: item.description ?? '',
        kind: item.kind,
        status: item.status,
        gradeId: course?.grade.id ?? '',
        lessonId: item.lessonId ?? '',
        unitId: item.unitId ?? '',
        timeLimitMinutes: item.timeLimitMinutes?.toString() ?? '',
        passingScore: item.passingScore,
        maxAttempts: item.maxAttempts,
        shuffleQuestions: item.shuffleQuestions,
        shuffleOptions: item.shuffleOptions,
        isFree: item.isFree,
        pricePounds: item.priceMinor ? String(item.priceMinor / 100) : '',
        availableFrom: toLocalInput(item.availableFrom),
        dueAt: toLocalInput(item.dueAt),
        questions: item.questions.map((q) => ({
          prompt: q.prompt,
          explanation: q.explanation ?? '',
          points: q.points,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
      });
    },
  });
  const save = useMutation({
    mutationFn: (state: EditorState) => {
      const { id: _id, gradeId: _gradeId, pricePounds: _pricePounds, ...values } = state;
      const payload = {
        ...values,
        priceMinor: state.isFree ? undefined : Math.round(Number(state.pricePounds) * 100),
        lessonId: state.kind === 'UNIT_EXAM' ? undefined : state.lessonId,
        unitId: state.kind === 'UNIT_EXAM' ? state.unitId : undefined,
        timeLimitMinutes: state.timeLimitMinutes ? Number(state.timeLimitMinutes) : undefined,
        availableFrom: state.availableFrom
          ? new Date(state.availableFrom).toISOString()
          : undefined,
        dueAt: state.dueAt ? new Date(state.dueAt).toISOString() : undefined,
      };
      return state.id
        ? api.patch(`/admin/assessments/${state.id}`, payload)
        : api.post('/admin/assessments', payload);
    },
    onSuccess: async () => {
      setEditor(null);
      setNotice('تم حفظ التقييم بنجاح.');
      await queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/assessments/${id}`),
    onSuccess: async () => {
      setNotice('تم حذف التقييم ومحاولاته.');
      await queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
    },
  });
  const archive = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/assessments/${id}/archive`, {}),
    onSuccess: async () => {
      setNotice('تمت أرشفة التقييم مع الاحتفاظ بالأسئلة والمحاولات.');
      await queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
    },
  });
  const grades = Array.from(
    new Map((curriculum.data ?? []).map((course) => [course.grade.id, course.grade])).values(),
  );

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
            بنك التقييمات
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
            الواجبات والامتحانات
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
            أضف واجبًا واختبارًا لكل درس، وامتحانًا شاملًا بعد كل وحدة، مع تصحيح فوري ومتابعة
            النتائج.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor(blankEditor())}
          className="min-h-11 shrink-0 rounded-xl bg-gold-500 px-5 text-sm font-black text-midnight-950 hover:bg-gold-400"
        >
          إضافة تقييم جديد
        </button>
      </header>
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/25 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {notice}
        </div>
      )}
      {list.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
      ) : list.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.data.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-gold-500/20 bg-white p-5 shadow-card dark:bg-midnight-950/75"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-gold-500/10 px-2.5 py-1 text-xs font-black text-gold-700 dark:text-gold-300">
                      {kindLabels[item.kind]}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-black',
                        item.status === 'PUBLISHED'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-midnight-500/10 text-midnight-600 dark:text-ivory-300',
                      )}
                    >
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-xl font-black">{item.title}</h2>
                  <p className="mt-1 text-xs font-bold text-midnight-500 dark:text-ivory-300/60">
                    {item.lesson
                      ? `${item.lesson.chapter.unit.course.title} · ${item.lesson.chapter.unit.title} · ${item.lesson.title}`
                      : `${item.unit?.course.title} · ${item.unit?.title}`}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Metric label="الأسئلة" value={item._count.questions} />
                <Metric label="المحاولات" value={item._count.attempts} />
                <Metric
                  label="المتوسط"
                  value={item.averageScore === null ? '—' : `${formatNumber(item.averageScore)}%`}
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => detail.mutate(item.id)}
                  disabled={detail.isPending}
                  className="min-h-11 flex-1 rounded-xl border border-gold-500/30 px-4 text-sm font-black text-gold-800 hover:bg-gold-500/10 disabled:opacity-50 dark:text-gold-300"
                >
                  تعديل وإدارة الأسئلة
                </button>
                {item.status !== 'ARCHIVED' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `أرشفة «${item.title}»؟ سيختفي من الطلاب مع الاحتفاظ بالأسئلة والمحاولات.`,
                        )
                      )
                        archive.mutate(item.id);
                    }}
                    disabled={archive.isPending}
                    className="min-h-11 rounded-xl border border-amber-500/30 px-4 text-sm font-bold text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
                  >
                    أرشفة
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف «${item.title}» وكل محاولاته؟`)) remove.mutate(item.id);
                  }}
                  className="min-h-11 rounded-xl border border-red-500/25 px-4 text-sm font-bold text-red-700 hover:bg-red-500/10 dark:text-red-300"
                >
                  حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gold-500/30 bg-white/70 px-6 py-14 text-center dark:bg-midnight-950/60">
          <h2 className="font-display text-xl font-black">ابدأ بأول واجب</h2>
          <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/65">
            اربطه بدرس، أضف الأسئلة، ثم انشره للطلاب.
          </p>
        </div>
      )}
      {editor && (
        <AssessmentEditor
          state={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={() => save.mutate(editor)}
          isSaving={save.isPending}
          error={save.error}
          courses={curriculum.data ?? []}
          grades={grades}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-midnight-50 p-3 text-center dark:bg-white/[0.04]">
      <p className="text-lg font-black">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      <p className="mt-0.5 text-[11px] font-bold text-midnight-500 dark:text-ivory-300/60">
        {label}
      </p>
    </div>
  );
}

function AssessmentEditor({
  state,
  onChange,
  onClose,
  onSave,
  isSaving,
  error,
  courses,
  grades,
}: {
  state: EditorState;
  onChange: (state: EditorState) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  error: Error | null;
  courses: CurriculumCourse[];
  grades: Array<{ id: string; nameAr: string }>;
}) {
  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    onChange({ ...state, [key]: value });
  const updateQuestion = (index: number, patch: Partial<EditorQuestion>) =>
    set(
      'questions',
      state.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  const [questionCount, setQuestionCount] = useState('');
  const [, setQuestionCountError] = useState<string | null>(null);
  const filteredCourses = courses.filter(
    (course) => !state.gradeId || course.grade.id === state.gradeId,
  );
  const unitOptions = filteredCourses.flatMap((course) =>
    course.units.map((unit) => ({
      id: unit.id,
      label: `${course.grade.nameAr} · ${course.title} · ${unit.title}`,
    })),
  );
  const lessonOptions = filteredCourses.flatMap((course) =>
    course.units.flatMap((unit) =>
      unit.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => ({
          id: lesson.id,
          label: `${course.grade.nameAr} · ${course.title} · ${unit.title} · ${lesson.title}`,
        })),
      ),
    ),
  );
  const valid =
    state.title.trim().length >= 2 &&
    Boolean(state.gradeId) &&
    (state.isFree || Number(state.pricePounds) >= 1) &&
    Boolean(state.kind === 'UNIT_EXAM' ? state.unitId : state.lessonId) &&
    state.questions.length > 0 &&
    state.questions.every(
      (q) =>
        q.prompt.trim() &&
        q.options.length >= 2 &&
        q.options.every((o) => o.text.trim()) &&
        q.options.filter((o) => o.isCorrect).length === 1,
    );
  const applyQuestionCount = () => {
    const count = Number(questionCount);
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      setQuestionCountError('عدد الأسئلة يجب أن يكون من 1 إلى 200.');
      return;
    }
    if (
      count < state.questions.length &&
      state.questions.slice(count).some((question) => question.prompt.trim()) &&
      !window.confirm('تقليل العدد سيحذف الأسئلة الزائدة المكتوبة. هل تريد المتابعة؟')
    )
      return;
    set(
      'questions',
      Array.from({ length: count }, (_, index) => state.questions[index] ?? blankQuestion()),
    );
    setQuestionCountError(null);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-editor-title"
      className="fixed inset-0 z-50 bg-midnight-950/75 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#fcfaf4] shadow-2xl dark:bg-midnight-900">
        <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-gold-500/20 bg-[#fcfaf4] px-5 py-4 dark:bg-midnight-900">
          <div>
            <p className="text-xs font-black text-gold-700 dark:text-gold-300">
              {state.id ? 'تعديل التقييم' : 'تقييم جديد'}
            </p>
            <h2 id="assessment-editor-title" className="font-display text-xl font-black">
              {state.title || 'بدون عنوان'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-11 w-11 place-items-center rounded-xl border border-midnight-200 text-2xl dark:border-white/15"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="العنوان">
              <input
                value={state.title}
                onChange={(e) => set('title', e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="النوع">
              <select
                value={state.kind}
                onChange={(e) => set('kind', e.target.value as AssessmentKind)}
                className="input-base"
              >
                <option value="HOMEWORK">واجب على الدرس</option>
                <option value="LESSON_EXAM">اختبار على الدرس</option>
                <option value="UNIT_EXAM">امتحان شامل على الوحدة</option>
              </select>
            </Field>
            <Field label="الصف الدراسي">
              <select
                value={state.gradeId}
                onChange={(e) =>
                  onChange({ ...state, gradeId: e.target.value, lessonId: '', unitId: '' })
                }
                className="input-base"
              >
                <option value="">اختر الصف أولًا</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.nameAr}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={state.kind === 'UNIT_EXAM' ? 'الوحدة' : 'الدرس'}>
              <select
                disabled={!state.gradeId}
                value={state.kind === 'UNIT_EXAM' ? state.unitId : state.lessonId}
                onChange={(e) =>
                  state.kind === 'UNIT_EXAM'
                    ? set('unitId', e.target.value)
                    : set('lessonId', e.target.value)
                }
                className="input-base disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {state.gradeId
                    ? `اختر ${state.kind === 'UNIT_EXAM' ? 'الوحدة' : 'الدرس'}`
                    : 'اختر الصف الدراسي أولًا'}
                </option>
                {(state.kind === 'UNIT_EXAM' ? unitOptions : lessonOptions).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="تعليمات للطالب (اختياري)">
                <textarea
                  value={state.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  className="input-base resize-y"
                />
              </Field>
            </div>
            <Field label="حالة النشر">
              <select
                value={state.status}
                onChange={(e) => set('status', e.target.value as PublishStatus)}
                className="input-base"
              >
                <option value="DRAFT">مسودة</option>
                <option value="PUBLISHED">منشور للطلاب</option>
                <option value="ARCHIVED">مؤرشف</option>
              </select>
            </Field>
            <Field label="مدة الحل بالدقائق (اختياري)">
              <input
                type="number"
                min="1"
                max="300"
                value={state.timeLimitMinutes}
                onChange={(e) => set('timeLimitMinutes', e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="درجة النجاح %">
              <input
                type="number"
                min="0"
                max="100"
                value={state.passingScore}
                onChange={(e) => set('passingScore', Number(e.target.value))}
                className="input-base"
              />
            </Field>
            <Field label="عدد المحاولات">
              <input
                type="number"
                min="1"
                max="20"
                value={state.maxAttempts}
                onChange={(e) => set('maxAttempts', Number(e.target.value))}
                className="input-base"
              />
            </Field>
            <Field label="متاح من (اختياري)">
              <DateTimePicker
                className="input-base"
                placeholder="من غير ميعاد"
                value={state.availableFrom}
                onChange={(v) => set('availableFrom', v)}
              />
            </Field>
            <Field label="آخر موعد (اختياري)">
              <DateTimePicker
                className="input-base"
                placeholder="من غير ميعاد"
                value={state.dueAt}
                onChange={(v) => set('dueAt', v)}
              />
            </Field>
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <Toggle
              checked={state.isFree}
              onChange={(checked) => set('isFree', checked)}
              title={state.isFree ? 'الامتحان مجاني' : 'الامتحان مدفوع'}
              description="ألغِ الاختيار لو عايز تحدد سعرًا للامتحان."
            />
            {!state.isFree && (
              <Field label="سعر الامتحان بالجنيه">
                <input
                  type="number"
                  min="1"
                  value={state.pricePounds}
                  onChange={(e) => set('pricePounds', e.target.value)}
                  className="input-base"
                />
              </Field>
            )}
            <Toggle
              checked={state.shuffleQuestions}
              onChange={(checked) => set('shuffleQuestions', checked)}
              title="ترتيب الأسئلة عشوائيًا"
              description="كل طالب يرى الأسئلة بترتيب مختلف."
            />
            <Toggle
              checked={state.shuffleOptions}
              onChange={(checked) => set('shuffleOptions', checked)}
              title="ترتيب الإجابات عشوائيًا"
              description="يتم تغيير ترتيب اختيارات كل سؤال."
            />
          </section>
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-black">الأسئلة</h3>
                <p className="text-xs text-midnight-500 dark:text-ivory-300/60">
                  اكتب الاختيارات ثم اضغط «تحديد كإجابة صحيحة» أمام الاختيار المطلوب.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="عدد الأسئلة (اختياري)">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    placeholder={String(state.questions.length)}
                    className="input-base w-36"
                  />
                </Field>
                <button
                  type="button"
                  onClick={applyQuestionCount}
                  className="min-h-11 rounded-xl border border-gold-500/30 px-4 text-sm font-black text-gold-800 dark:text-gold-300"
                >
                  إنشاء العدد
                </button>
                <button
                  type="button"
                  onClick={() => set('questions', [...state.questions, blankQuestion()])}
                  className="min-h-11 rounded-xl border border-gold-500/30 px-4 text-sm font-black text-gold-800 dark:text-gold-300"
                >
                  إضافة سؤال
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {state.questions.map((question, qi) => (
                <article
                  key={qi}
                  className="rounded-2xl border border-gold-500/20 bg-white p-4 dark:bg-midnight-950/60 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black">السؤال {formatNumber(qi + 1)}</h4>
                    {state.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            'questions',
                            state.questions.filter((_, i) => i !== qi),
                          )
                        }
                        className="min-h-11 px-3 text-sm font-bold text-red-700 dark:text-red-300"
                      >
                        حذف السؤال
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Field label="نص السؤال">
                      <textarea
                        value={question.prompt}
                        onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                        rows={2}
                        className="input-base resize-y"
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                      <Field label="توضيح بعد التصحيح (اختياري)">
                        <input
                          value={question.explanation}
                          onChange={(e) => updateQuestion(qi, { explanation: e.target.value })}
                          className="input-base"
                        />
                      </Field>
                      <Field label="الدرجة">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={question.points}
                          onChange={(e) => updateQuestion(qi, { points: Number(e.target.value) })}
                          className="input-base"
                        />
                      </Field>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-black">الاختيارات</p>
                      {question.options.map((option, oi) => (
                        <div
                          key={oi}
                          className={cn(
                            'grid gap-2 rounded-xl border p-2 sm:grid-cols-[minmax(0,1fr)_11rem_2.75rem]',
                            option.isCorrect
                              ? 'border-emerald-500/50 bg-emerald-500/10'
                              : 'border-midnight-200/70 dark:border-white/10',
                          )}
                        >
                          <input
                            aria-label={`نص الاختيار ${oi + 1}`}
                            value={option.text}
                            onChange={(e) =>
                              updateQuestion(qi, {
                                options: question.options.map((o, i) =>
                                  i === oi ? { ...o, text: e.target.value } : o,
                                ),
                              })
                            }
                            className="input-base"
                          />
                          <button
                            type="button"
                            aria-pressed={option.isCorrect}
                            onClick={() =>
                              updateQuestion(qi, {
                                options: question.options.map((o, i) => ({
                                  ...o,
                                  isCorrect: i === oi,
                                })),
                              })
                            }
                            className={cn(
                              'min-h-11 rounded-lg px-3 text-xs font-black transition-colors',
                              option.isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'border border-gold-500/30 text-gold-800 hover:bg-gold-500/10 dark:text-gold-300',
                            )}
                          >
                            {option.isCorrect ? '✓ الإجابة الصحيحة' : 'تحديد كإجابة صحيحة'}
                          </button>
                          {question.options.length > 2 ? (
                            <button
                              type="button"
                              aria-label={`حذف الاختيار ${oi + 1}`}
                              onClick={() =>
                                updateQuestion(qi, {
                                  options: question.options
                                    .filter((_, i) => i !== oi)
                                    .map((o, i) => ({
                                      ...o,
                                      isCorrect: o.isCorrect || (i === 0 && option.isCorrect),
                                    })),
                                })
                              }
                              className="grid h-11 w-11 place-items-center rounded-lg border border-red-500/20 text-red-600"
                            >
                              ×
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      ))}
                      {question.options.length < 6 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(qi, {
                              options: [...question.options, { text: '', isCorrect: false }],
                            })
                          }
                          className="min-h-11 text-sm font-bold text-gold-700 dark:text-gold-300"
                        >
                          + إضافة اختيار
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/25 bg-red-50 p-4 text-sm font-bold text-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              {error instanceof ApiError ? error.message : 'تعذر حفظ التقييم'}
            </p>
          )}
        </div>
        <footer className="z-10 flex shrink-0 gap-3 border-t border-gold-500/20 bg-[#fcfaf4] p-4 dark:bg-midnight-900">
          <button
            type="button"
            onClick={onSave}
            disabled={!valid || isSaving}
            className="min-h-12 flex-1 rounded-xl bg-gold-500 px-5 font-black text-midnight-950 hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSaving
              ? 'جاري الحفظ…'
              : state.status === 'PUBLISHED'
                ? 'حفظ ونشر للطلاب'
                : 'حفظ المسودة'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-xl border border-midnight-200 px-5 font-bold dark:border-white/15"
          >
            إلغاء
          </button>
        </footer>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-gold-500/20 bg-white p-4 dark:bg-midnight-950/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 accent-[#c99a30]"
      />
      <span>
        <span className="block text-sm font-black">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-midnight-500 dark:text-ivory-300/65">
          {description}
        </span>
      </span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
        {label}
      </span>
      {children}
    </label>
  );
}
