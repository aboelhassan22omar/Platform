'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { Paginated } from '@/types/api';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  QuestionFields,
  TYPE_LABELS,
  blankQuestion,
  questionIsValid,
  toEditorQuestion,
  toQuestionPayload,
  type EditorQuestion,
  type QuestionDifficulty,
  type QuestionType,
} from './question-fields';
import { parseQuestions } from './question-import';

interface CurriculumCourse {
  id: string;
  title: string;
  grade: { id: string; nameAr: string };
  units: Array<{ id: string; title: string }>;
}
interface Bank {
  id: string;
  title: string;
  description: string | null;
  courseId: string;
  unitId: string | null;
  course: { title: string; grade: { nameAr: string } };
  unit: { title: string } | null;
  usedByExams: number;
  counts: Record<QuestionDifficulty, number>;
  total: number;
}
interface BankQuestion {
  id: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  imageKey: string | null;
  imageUrl: string | null;
  prompt: string;
  explanation: string | null;
  points: number;
  answeredCount: number;
  options: Array<{ text: string; isCorrect: boolean }>;
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export function AdminQuestionBanks() {
  const [openBank, setOpenBank] = useState<Bank | null>(null);
  const banks = useQuery({
    queryKey: ['admin-question-banks'],
    queryFn: () => api.get<Bank[]>('/admin/question-banks'),
  });
  const current = openBank
    ? (banks.data?.find((bank) => bank.id === openBank.id) ?? openBank)
    : null;
  return current ? (
    <BankDetail bank={current} onBack={() => setOpenBank(null)} />
  ) : (
    <BankList banks={banks.data} loading={banks.isLoading} onOpen={setOpenBank} />
  );
}

// ---------------------------------------------------------------------------
// Banks
// ---------------------------------------------------------------------------

function BankList({
  banks,
  loading,
  onOpen,
}: {
  banks: Bank[] | undefined;
  loading: boolean;
  onOpen: (bank: Bank) => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/question-banks/${id}`),
    onMutate: () => setError(null),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-question-banks'] }),
    onError: (caught) => setError(errorText(caught, 'تعذر حذف البنك')),
  });

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gold-700 dark:text-gold-300">
            امتحانات مختلفة لكل طالب
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-midnight-950 dark:text-ivory-50">
            بنك الأسئلة
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-midnight-600 dark:text-ivory-300/75">
            حط أسئلة كتير على كل وحدة، وفي الامتحان اختار كام سؤال يتسحب عشوائي لكل طالب. كده كل
            طالب بياخد ورقة مختلفة، ونقل الإجابات بيبقى صعب.
          </p>
        </div>
        <Button type="button" variant="accent" onClick={() => setCreating(true)}>
          بنك جديد
        </Button>
      </header>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      ) : !banks?.length ? (
        <div className="rounded-3xl border border-dashed border-gold-500/30 bg-white/70 px-6 py-14 text-center dark:bg-midnight-950/60">
          <h2 className="font-display text-xl font-black">اعمل أول بنك أسئلة</h2>
          <p className="mt-2 text-sm text-midnight-500 dark:text-ivory-300/65">
            اختار الكورس والوحدة، وبعدين ضيف الأسئلة واحد واحد أو الصقها كلها مرة واحدة.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {banks.map((bank) => (
            <article
              key={bank.id}
              className="rounded-2xl border border-gold-500/20 bg-white p-5 shadow-card dark:bg-midnight-950/75"
            >
              <p className="text-xs font-bold text-midnight-500 dark:text-ivory-300/60">
                {bank.course.grade.nameAr} · {bank.course.title}
                {bank.unit ? ` · ${bank.unit.title}` : ''}
              </p>
              <h2 className="mt-1 font-display text-xl font-black">{bank.title}</h2>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black">
                <span className="rounded-lg bg-midnight-500/10 px-2.5 py-1">
                  {formatNumber(bank.total)} سؤال
                </span>
                {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((difficulty) => (
                  <span
                    key={difficulty}
                    className={cn('rounded-lg px-2.5 py-1', DIFFICULTY_STYLES[difficulty])}
                  >
                    {DIFFICULTY_LABELS[difficulty]} {formatNumber(bank.counts[difficulty])}
                  </span>
                ))}
                {bank.usedByExams > 0 && (
                  <span className="text-midnight-500 dark:text-ivory-300/60">
                    مستخدم في {formatNumber(bank.usedByExams)} امتحان
                  </span>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpen(bank)}
                >
                  افتح وأضف أسئلة
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  isLoading={remove.isPending && remove.variables === bank.id}
                  onClick={() => {
                    if (window.confirm(`حذف بنك «${bank.title}» وكل أسئلته؟`))
                      remove.mutate(bank.id);
                  }}
                >
                  حذف
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && <CreateBankDialog onClose={() => setCreating(false)} onCreated={onOpen} />}
    </div>
  );
}

function CreateBankDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (bank: Bank) => void;
}) {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('');
  const courses = useQuery({
    queryKey: ['assessment-curriculum'],
    queryFn: () => api.get<CurriculumCourse[]>('/admin/assessments/curriculum'),
  });
  const course = courses.data?.find((item) => item.id === courseId);
  const create = useMutation({
    mutationFn: () =>
      api.post<Bank>('/admin/question-banks', { title, courseId, unitId: unitId || null }),
    onSuccess: async (bank) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-question-banks'] });
      onClose();
      onCreated({
        ...bank,
        course: { title: course?.title ?? '', grade: { nameAr: course?.grade.nameAr ?? '' } },
        unit: course?.units.find((unit) => unit.id === unitId) ?? null,
        usedByExams: 0,
        counts: { EASY: 0, MEDIUM: 0, HARD: 0 },
        total: 0,
      });
    },
  });

  return (
    <Modal title="بنك أسئلة جديد" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="الكورس">
          <select
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value);
              setUnitId('');
            }}
            className="input-base"
            required
          >
            <option value="">اختار الكورس</option>
            {courses.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.grade.nameAr} · {item.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الوحدة (اختياري)">
          <select
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value);
              const unit = course?.units.find((item) => item.id === event.target.value);
              if (unit && !title) setTitle(`أسئلة ${unit.title}`);
            }}
            className="input-base"
            disabled={!course}
          >
            <option value="">الكورس كله</option>
            {course?.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اسم البنك">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="input-base"
            required
            minLength={2}
          />
        </Field>
        {create.isError && (
          <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
            {errorText(create.error, 'تعذر إنشاء البنك')}
          </p>
        )}
        <Button
          type="submit"
          variant="accent"
          fullWidth
          isLoading={create.isPending}
          disabled={!courseId || title.trim().length < 2}
        >
          اعمل البنك
        </Button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// One bank's questions
// ---------------------------------------------------------------------------

function BankDetail({ bank, onBack }: { bank: Bank; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | ''>('');
  const [type, setType] = useState<QuestionType | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditorQuestion | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const params = new URLSearchParams({ page: String(page) });
  if (difficulty) params.set('difficulty', difficulty);
  if (type) params.set('type', type);
  if (search.trim()) params.set('search', search.trim());
  const questions = useQuery({
    queryKey: ['admin-bank-questions', bank.id, params.toString()],
    queryFn: () =>
      api.get<Paginated<BankQuestion>>(`/admin/question-banks/${bank.id}/questions?${params}`),
    placeholderData: keepPreviousData,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-bank-questions', bank.id] });
    void queryClient.invalidateQueries({ queryKey: ['admin-question-banks'] });
  };
  const remove = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ archived?: boolean }>(`/admin/question-banks/${bank.id}/questions/${id}`),
    onSuccess: (result) => {
      setNotice({
        ok: true,
        text: result.archived
          ? 'السؤال اتشال من البنك. نتايج الطلاب اللي حلّوه زي ما هي.'
          : 'السؤال اتحذف.',
      });
      refresh();
    },
    onError: (caught) => setNotice({ ok: false, text: errorText(caught, 'تعذر الحذف') }),
  });
  const totalPages = questions.data
    ? Math.max(1, Math.ceil(questions.data.total / questions.data.pageSize))
    : 1;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-bold text-gold-700 dark:text-gold-300"
      >
        → كل البنوك
      </button>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-midnight-500 dark:text-ivory-300/60">
            {bank.course.grade.nameAr} · {bank.course.title}
            {bank.unit ? ` · ${bank.unit.title}` : ''}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black">{bank.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-lg bg-midnight-500/10 px-2.5 py-1">
              {formatNumber(bank.total)} سؤال
            </span>
            {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((item) => (
              <span key={item} className={cn('rounded-lg px-2.5 py-1', DIFFICULTY_STYLES[item])}>
                {DIFFICULTY_LABELS[item]} {formatNumber(bank.counts[item])}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setImporting(true)}>
            الصق أسئلة كتير
          </Button>
          <Button type="button" variant="accent" onClick={() => setEditing(blankQuestion())}>
            سؤال جديد
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="w-full sm:w-40">
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value as QuestionDifficulty | '');
              setPage(1);
            }}
            aria-label="الصعوبة"
            className="input-base h-10 py-0"
          >
            <option value="">كل الصعوبات</option>
            {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((item) => (
              <option key={item} value={item}>
                {DIFFICULTY_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-44">
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as QuestionType | '');
              setPage(1);
            }}
            aria-label="نوع السؤال"
            className="input-base h-10 py-0"
          >
            <option value="">كل الأنواع</option>
            {(Object.keys(TYPE_LABELS) as QuestionType[]).map((item) => (
              <option key={item} value={item}>
                {TYPE_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-64">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="دوّر في نص السؤال"
            aria-label="بحث في الأسئلة"
            className="input-base h-10 py-0"
          />
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className={cn(
            'text-sm font-semibold',
            notice.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
          )}
        >
          {notice.text}
        </p>
      )}

      {questions.isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      ) : !questions.data?.items.length ? (
        <p className="rounded-2xl border border-dashed border-gold-500/30 bg-white p-10 text-center text-sm text-midnight-500 dark:bg-midnight-950/80 dark:text-ivory-300/70">
          مفيش أسئلة هنا لسه.
        </p>
      ) : (
        <ol className="space-y-2">
          {questions.data.items.map((question) => {
            const correct = question.options.find((option) => option.isCorrect);
            return (
              <li
                key={question.id}
                className="rounded-2xl border border-gold-500/20 bg-white p-4 dark:bg-midnight-950/75"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap gap-1.5 text-[11px] font-black">
                      <span className="rounded bg-midnight-500/10 px-1.5 py-0.5">
                        {TYPE_LABELS[question.type]}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5',
                          DIFFICULTY_STYLES[question.difficulty],
                        )}
                      >
                        {DIFFICULTY_LABELS[question.difficulty]}
                      </span>
                      <span className="rounded bg-midnight-500/10 px-1.5 py-0.5">
                        {formatNumber(question.points)} درجة
                      </span>
                      {question.imageUrl && (
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
                          🖼 صورة
                        </span>
                      )}
                      {question.answeredCount > 0 && (
                        <span className="rounded bg-midnight-500/10 px-1.5 py-0.5 text-midnight-500 dark:text-ivory-300/60">
                          اتحل {formatNumber(question.answeredCount)} مرة
                        </span>
                      )}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm font-bold text-midnight-900 dark:text-ivory-100">
                      {question.prompt}
                    </p>
                    {correct && (
                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                        ✓ {correct.text}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {question.answeredCount === 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(toEditorQuestion(question))}
                      >
                        تعديل
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      isLoading={remove.isPending && remove.variables === question.id}
                      onClick={() => {
                        if (window.confirm('حذف السؤال ده من البنك؟')) remove.mutate(question.id);
                      }}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {questions.data && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            السابق
          </Button>
          <span className="text-xs text-midnight-600 dark:text-ivory-300/70">
            صفحة {formatNumber(page)} من {formatNumber(totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}

      {editing && (
        <QuestionDialog
          bankId={bank.id}
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ ok: true, text });
            refresh();
          }}
          onAdded={refresh}
        />
      )}
      {importing && (
        <ImportDialog
          bankId={bank.id}
          onClose={() => setImporting(false)}
          onImported={(added) => {
            setImporting(false);
            setNotice({ ok: true, text: `اتضاف ${formatNumber(added)} سؤال للبنك.` });
            refresh();
          }}
        />
      )}
    </div>
  );
}

function QuestionDialog({
  bankId,
  question: initial,
  onClose,
  onSaved,
  onAdded,
}: {
  bankId: string;
  question: EditorQuestion;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** A question was added and the form stays open for the next one. */
  onAdded: () => void;
}) {
  const [question, setQuestion] = useState(initial);
  const [addedCount, setAddedCount] = useState(0);
  const saveAndNext = useMutation({
    mutationFn: () =>
      api.post(`/admin/question-banks/${bankId}/questions`, {
        questions: [toQuestionPayload(question, true)],
      }),
    onSuccess: () => {
      setAddedCount((count) => count + 1);
      setQuestion({
        ...blankQuestion(question.type),
        difficulty: question.difficulty,
        points: question.points,
      });
      onAdded();
    },
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = toQuestionPayload(question, true);
      return question.id
        ? api.patch(`/admin/question-banks/${bankId}/questions/${question.id}`, payload)
        : api.post(`/admin/question-banks/${bankId}/questions`, { questions: [payload] });
    },
    onSuccess: () => onSaved(question.id ? 'اتحفظ السؤال.' : 'اتضاف السؤال.'),
  });
  return (
    <Modal title={question.id ? 'تعديل سؤال' : 'سؤال جديد'} onClose={onClose} wide>
      <QuestionFields
        question={question}
        onChange={(patch) => setQuestion({ ...question, ...patch })}
        showDifficulty
      />
      {(save.isError || saveAndNext.isError) && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
          {errorText(save.error ?? saveAndNext.error, 'تعذر حفظ السؤال')}
        </p>
      )}
      {addedCount > 0 && (
        <p
          role="status"
          className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
        >
          اتضاف {formatNumber(addedCount)} سؤال. اكتب اللي بعده.
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant="accent"
          className="flex-1"
          isLoading={save.isPending}
          disabled={!questionIsValid(question)}
          onClick={() => save.mutate()}
        >
          حفظ
        </Button>
        {!question.id && (
          <Button
            type="button"
            variant="outline"
            isLoading={saveAndNext.isPending}
            disabled={!questionIsValid(question) || save.isPending}
            onClick={() => saveAndNext.mutate()}
          >
            حفظ وسؤال جديد
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </Modal>
  );
}

const PASTE_EXAMPLE = `١- متى قامت ثورة ١٩١٩؟
أ) ١٩١٨
ب) ١٩١٩ *
ج) ١٩٢٠

قامت الثورة العرابية سنة ١٨٨١ (صح)

اشرح أسباب ثورة ١٩١٩ ونتائجها.`;

function ImportDialog({
  bankId,
  onClose,
  onImported,
}: {
  bankId: string;
  onClose: () => void;
  onImported: (added: number) => void;
}) {
  const [text, setText] = useState('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('MEDIUM');
  const [points, setPoints] = useState(1);
  const parsed = useMemo(
    () => parseQuestions(text, { difficulty, points }),
    [text, difficulty, points],
  );
  const valid = parsed.filter((item) => !item.problem);
  const save = useMutation({
    mutationFn: async () => {
      let added = 0;
      for (let index = 0; index < valid.length; index += 300) {
        const chunk = valid
          .slice(index, index + 300)
          .map((item) => toQuestionPayload(item.question, true));
        added += (
          await api.post<{ added: number }>(`/admin/question-banks/${bankId}/questions`, {
            questions: chunk,
          })
        ).added;
      }
      return added;
    },
    onSuccess: onImported,
  });

  return (
    <Modal title="الصق أسئلة كتير مرة واحدة" onClose={onClose} wide>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs leading-6 text-midnight-600 dark:text-ivory-300/75">
            انسخ الأسئلة من الوورد والصقها هنا. سيب سطر فاضي بين كل سؤال والتاني، وعلّم الإجابة
            الصحيحة بـ <strong>*</strong>. سؤال آخره <strong>(صح)</strong> أو <strong>(غلط)</strong>{' '}
            بيبقى صح وغلط، وسؤال من غير اختيارات بيبقى مقالي.
          </p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            placeholder={PASTE_EXAMPLE}
            className="input-base resize-y font-mono text-sm leading-7"
            aria-label="الأسئلة"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="صعوبة الأسئلة دي">
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as QuestionDifficulty)}
                className="input-base"
              >
                {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((item) => (
                  <option key={item} value={item}>
                    {DIFFICULTY_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="درجة كل سؤال">
              <input
                type="number"
                min="1"
                max="100"
                value={points}
                onChange={(event) => setPoints(Number(event.target.value) || 1)}
                className="input-base"
              />
            </Field>
          </div>
        </div>
        <div className="min-h-0">
          <p className="mb-2 text-sm font-black">
            المعاينة: {formatNumber(valid.length)} سؤال جاهز
            {parsed.length > valid.length && (
              <span className="text-red-600 dark:text-red-400">
                {' '}
                ، و{formatNumber(parsed.length - valid.length)} محتاج تصليح
              </span>
            )}
          </p>
          <ol className="max-h-[26rem] space-y-2 overflow-y-auto">
            {parsed.map((item, index) => (
              <li
                key={index}
                className={cn(
                  'rounded-xl border p-3 text-sm',
                  item.problem
                    ? 'border-red-500/40 bg-red-500/5'
                    : 'border-gold-500/20 bg-white dark:bg-midnight-950/60',
                )}
              >
                <p className="text-[11px] font-black text-midnight-500 dark:text-ivory-300/60">
                  سؤال {formatNumber(index + 1)} — {TYPE_LABELS[item.question.type]}
                </p>
                <p className="mt-1 font-bold">{item.question.prompt || '—'}</p>
                {item.question.type !== 'ESSAY' && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {item.question.options.map((option, optionIndex) => (
                      <li
                        key={optionIndex}
                        className={
                          option.isCorrect
                            ? 'font-black text-emerald-700 dark:text-emerald-300'
                            : ''
                        }
                      >
                        {option.isCorrect ? '✓ ' : '• '}
                        {option.text}
                      </li>
                    ))}
                  </ul>
                )}
                {item.problem && (
                  <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
                    {item.problem}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {save.isError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
          {errorText(save.error, 'تعذر إضافة الأسئلة')}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant="accent"
          className="flex-1"
          isLoading={save.isPending}
          disabled={!valid.length}
          onClick={() => save.mutate()}
        >
          ضيف {formatNumber(valid.length)} سؤال
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function Modal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-midnight-950/75 p-3 backdrop-blur-sm sm:p-6"
    >
      <div
        className={cn(
          'flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-[#fcfaf4] shadow-2xl dark:bg-midnight-900',
          wide ? 'max-w-4xl' : 'max-w-lg',
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gold-500/20 px-5 py-4">
          <h2 className="font-display text-xl font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-11 w-11 place-items-center rounded-xl border border-midnight-200 text-2xl dark:border-white/15"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
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
