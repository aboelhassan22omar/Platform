'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn, formatNumber, pluralizeAr } from '@/lib/utils';

type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'ESSAY';

type Active = {
  mode: 'READY' | 'ACTIVE';
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number | null;
  questionCount: number;
  questions: Array<{
    id: string;
    type: QuestionType;
    prompt: string;
    imageUrl: string | null;
    points: number;
    options: Array<{ id: string; text: string }>;
  }>;
  activeAttempt: {
    id: string;
    expiresAt: string | null;
    answers: Array<{ questionId: string; optionId: string | null; text: string | null }>;
  } | null;
};
type Review = {
  mode: 'REVIEW';
  id: string;
  title: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: string;
  needsGrading: boolean;
  correctCount: number;
  questionCount: number;
  attemptCount: number;
  maxAttempts: number;
  certificateMinScore: number | null;
  certificate: { serial: string; percentage: number } | null;
  canRetry: boolean;
  answers: Array<{
    questionId: string;
    type: QuestionType;
    prompt: string;
    imageUrl: string | null;
    points: number;
    pointsAwarded: number;
    explanation: string | null;
    selectedText: string | null;
    textAnswer: string | null;
    feedback: string | null;
    graded: boolean;
    isCorrect: boolean;
    correctOption: { id: string; text: string } | null;
  }>;
};
type Response = Active | Review;

const TYPE_HINT: Record<QuestionType, string | null> = {
  MCQ: null,
  TRUE_FALSE: 'صح ولا غلط؟',
  ESSAY: 'اكتب إجابتك، والمستر هيصححها',
};

function QuestionImage({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt="صورة مرفقة بالسؤال"
      className="mt-3 max-h-80 w-auto max-w-full rounded-xl border border-gold-500/20 object-contain"
    />
  );
}

export function AssessmentRunner({ id }: { id: string }) {
  const client = useQueryClient(),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [texts, setTexts] = useState<Record<string, string>>({}),
    [remaining, setRemaining] = useState<number | null>(null),
    [confirming, setConfirming] = useState(false);
  const textTimers = useRef<Record<string, number>>({});
  const query = useQuery({
    queryKey: ['assessment', id],
    queryFn: () => api.get<Response>(`/assessments/${id}`),
  });
  const start = useMutation({
    mutationFn: () => api.post<Response>(`/assessments/${id}/start`),
    onSuccess: (data) => client.setQueryData(['assessment', id], data),
  });
  const submit = useMutation({
    mutationFn: () =>
      api.post<Review>(`/assessments/${id}/submit`, {
        answers: [
          ...Object.entries(choices).map(([questionId, optionId]) => ({ questionId, optionId })),
          ...Object.entries(texts).map(([questionId, text]) => ({ questionId, text })),
        ],
      }),
    onSuccess: (data) => {
      setConfirming(false);
      client.setQueryData(['assessment', id], data);
      void client.invalidateQueries({ queryKey: ['student-assessments'] });
      void client.invalidateQueries({ queryKey: ['my-certificates'] });
    },
  });
  const assessment = query.data;
  useEffect(() => {
    if (assessment?.mode === 'ACTIVE' && assessment.activeAttempt) {
      setChoices(
        Object.fromEntries(
          assessment.activeAttempt.answers
            .filter((a) => a.optionId)
            .map((a) => [a.questionId, a.optionId!]),
        ),
      );
      setTexts(
        Object.fromEntries(
          assessment.activeAttempt.answers
            .filter((a) => a.text)
            .map((a) => [a.questionId, a.text!]),
        ),
      );
    }
  }, [assessment]);
  useEffect(() => {
    if (assessment?.mode !== 'ACTIVE' || !assessment.activeAttempt?.expiresAt) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const value = Math.max(
        0,
        Math.ceil((new Date(assessment.activeAttempt!.expiresAt!).getTime() - Date.now()) / 1000),
      );
      setRemaining(value);
      if (value === 0 && !submit.isPending) submit.mutate();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [assessment, submit]);
  useEffect(() => {
    const timers = textTimers.current;
    return () => Object.values(timers).forEach((timer) => window.clearTimeout(timer));
  }, []);
  const choose = (questionId: string, optionId: string) => {
    setChoices((current) => ({ ...current, [questionId]: optionId }));
    void api
      .post(`/assessments/${id}/save`, { answers: [{ questionId, optionId }] })
      .catch(() => undefined);
  };
  /** Written answers save a moment after the student stops typing. */
  const write = (questionId: string, text: string) => {
    setTexts((current) => ({ ...current, [questionId]: text }));
    window.clearTimeout(textTimers.current[questionId]);
    textTimers.current[questionId] = window.setTimeout(() => {
      void api
        .post(`/assessments/${id}/save`, { answers: [{ questionId, text }] })
        .catch(() => undefined);
    }, 1200);
  };
  if (query.isLoading) return <div className="skeleton h-80 rounded-2xl" />;
  if (query.isError || !assessment)
    return (
      <div
        role="alert"
        className="rounded-2xl bg-red-500/10 p-6 text-center font-bold text-red-700"
      >
        تعذر فتح الامتحان. قد يحتاج للشراء أو انتهت إتاحته.
        <br />
        <Link className="underline" href="/dashboard/assessments">
          العودة
        </Link>
      </div>
    );
  if (assessment.mode === 'REVIEW')
    return (
      <ReviewResult result={assessment} onRetry={() => start.mutate()} retrying={start.isPending} />
    );
  if (assessment.mode === 'READY')
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-gold-500/25 bg-white p-8 text-center dark:bg-midnight-950/75">
        <h1 className="font-display text-3xl font-black">{assessment.title}</h1>
        {assessment.description && <p className="mt-3">{assessment.description}</p>}
        <div className="mt-5 flex justify-center gap-2 text-sm font-bold">
          <span className="rounded-lg bg-gold-500/10 px-3 py-2">
            {formatNumber(assessment.questionCount)} سؤال
          </span>
          <span className="rounded-lg bg-gold-500/10 px-3 py-2">
            {assessment.timeLimitMinutes
              ? `${formatNumber(assessment.timeLimitMinutes)} دقيقة`
              : 'بدون وقت محدد'}
          </span>
        </div>
        <p className="mt-5 text-sm text-midnight-500 dark:text-ivory-300/65">
          الوقت يبدأ عند الضغط ويستمر عند الخروج. يمكنك العودة لإكمال نفس المحاولة.
        </p>
        {start.isError && (
          <p role="alert" className="mt-3 text-sm font-bold text-red-600">
            {start.error instanceof ApiError ? start.error.message : 'تعذر بدء الامتحان'}
          </p>
        )}
        <button
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="mt-6 min-h-12 w-full rounded-xl bg-gold-500 font-black text-midnight-950"
        >
          ابدأ الامتحان الآن
        </button>
      </div>
    );
  const isAnswered = (questionId: string, type: QuestionType) =>
    type === 'ESSAY' ? Boolean(texts[questionId]?.trim()) : Boolean(choices[questionId]);
  const answered = assessment.questions.filter((q) => isAnswered(q.id, q.type)).length,
    allAnswered = answered === assessment.questions.length;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="sticky top-28 z-20 rounded-2xl border border-gold-500/30 bg-white/95 p-4 shadow-card backdrop-blur dark:bg-midnight-950/95">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link href="/dashboard/assessments" className="text-xs font-bold text-gold-700">
              الخروج — إجاباتك محفوظة
            </Link>
            <h1 className="text-xl font-black">{assessment.title}</h1>
          </div>
          {remaining !== null && (
            <div
              role="timer"
              className={cn(
                'rounded-xl px-4 py-2 text-xl font-black tabular-nums',
                remaining <= 60 ? 'bg-red-500/15 text-red-600' : 'bg-gold-500/15 text-gold-700',
              )}
            >
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:
              {String(remaining % 60).padStart(2, '0')}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs">
          أجبت عن {formatNumber(answered)} من {formatNumber(assessment.questions.length)} — حفظ
          تلقائي
        </p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (allAnswered) setConfirming(true);
        }}
        className="space-y-4"
      >
        {assessment.questions.map((q, i) => (
          <fieldset
            key={q.id}
            className="rounded-2xl border border-gold-500/20 bg-white p-5 dark:bg-midnight-950/75"
          >
            <legend className="font-black">
              {formatNumber(i + 1)}. <span className="whitespace-pre-line">{q.prompt}</span>
            </legend>
            {TYPE_HINT[q.type] && (
              <p className="mt-1 text-xs font-bold text-midnight-500 dark:text-ivory-300/60">
                {TYPE_HINT[q.type]} ({pluralizeAr(q.points, ['درجة واحدة', 'درجتين', 'درجات'])})
              </p>
            )}
            <QuestionImage url={q.imageUrl} />
            {q.type === 'ESSAY' ? (
              <textarea
                value={texts[q.id] ?? ''}
                onChange={(event) => write(q.id, event.target.value)}
                rows={6}
                maxLength={5000}
                aria-label={`إجابة السؤال ${i + 1}`}
                placeholder="اكتب إجابتك هنا…"
                className="input-base mt-4 resize-y leading-7"
              />
            ) : (
              <div
                className={cn(
                  'mt-4',
                  q.type === 'TRUE_FALSE' ? 'grid grid-cols-2 gap-2' : 'space-y-2',
                )}
              >
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 font-bold',
                      q.type === 'TRUE_FALSE' && 'justify-center',
                      choices[q.id] === o.id
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-midnight-200 dark:border-white/10',
                    )}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={choices[q.id] === o.id}
                      onChange={() => choose(q.id, o.id)}
                      className="h-5 w-5 accent-[#c99a30]"
                    />
                    {o.text}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
        {submit.isError && (
          <p className="bg-red-500/10 p-3 text-red-700">
            {submit.error instanceof ApiError ? submit.error.message : 'تعذر التسليم'}
          </p>
        )}
        <button
          disabled={!allAnswered || submit.isPending}
          className="min-h-12 w-full rounded-xl bg-gold-500 font-black text-midnight-950 disabled:opacity-45"
        >
          {allAnswered
            ? 'تسليم الامتحان'
            : `أكمل ${formatNumber(assessment.questions.length - answered)} إجابة`}
        </button>
      </form>
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-midnight-950/75 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-midnight-900">
            <h2 className="text-xl font-black">تسليم نهائي؟</h2>
            <p className="mt-2 text-sm">بعد التسليم ستدخل للمراجعة والنتيجة فقط.</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => submit.mutate()}
                className="min-h-11 flex-1 rounded-xl bg-gold-500 font-black"
              >
                تأكيد
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded-xl border px-4"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewResult({
  result,
  onRetry,
  retrying,
}: {
  result: Review;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-3xl border border-gold-500/25 bg-white p-7 text-center dark:bg-midnight-950/75">
        {result.needsGrading ? (
          <>
            <p className="font-black text-gold-700">تم التسليم ✍️</p>
            <p className="mt-2 font-display text-2xl font-black">
              في انتظار تصحيح الأسئلة المقالية
            </p>
            <p className="mt-3 text-sm text-midnight-600 dark:text-ivory-300/75">
              أسئلة الاختيارات اتصححت. النتيجة النهائية هتظهر هنا ويوصلك إشعار أول ما المستر يصحح
              إجاباتك المكتوبة.
            </p>
          </>
        ) : (
          <>
            <p className="font-black text-gold-700">النتيجة النهائية</p>
            <p className="mt-2 text-6xl font-black">{formatNumber(result.percentage)}%</p>
            <p className="mt-3 text-lg font-black">
              حليت صح {formatNumber(result.correctCount)} من {formatNumber(result.questionCount)}{' '}
              سؤال
            </p>
            <p className="text-sm">
              {formatNumber(result.score)} من {formatNumber(result.maxScore)} درجة
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-midnight-500 dark:text-ivory-300/65">
          المحاولة {formatNumber(result.attemptCount)} من {formatNumber(result.maxAttempts)}
        </p>
        {result.canRetry && !result.needsGrading && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-5 min-h-12 rounded-xl border border-gold-500/40 px-6 font-black text-gold-800 disabled:opacity-50 dark:text-gold-300"
          >
            {retrying ? 'بنجهّز محاولة جديدة…' : 'ابدأ محاولة جديدة'}
          </button>
        )}
      </section>
      {result.certificate ? (
        <section className="flex flex-col items-center gap-4 rounded-3xl border-2 border-gold-500/50 bg-gold-500/10 p-6 text-center sm:flex-row sm:text-start">
          <span className="text-5xl" aria-hidden>
            🎓
          </span>
          <div className="flex-1">
            <p className="font-display text-xl font-black">مبروك! كسبت شهادة</p>
            <p className="mt-1 text-sm text-midnight-600 dark:text-ivory-300/75">
              شهادتك بدرجة {formatNumber(result.certificate.percentage)}% جاهزة، تقدر تحمّلها PDF
              وتشاركها.
            </p>
          </div>
          <Link
            href={`/certificates/${result.certificate.serial}`}
            className="flex min-h-12 items-center rounded-xl bg-gold-500 px-6 font-black text-midnight-950 hover:bg-gold-400"
          >
            افتح الشهادة
          </Link>
        </section>
      ) : (
        result.certificateMinScore !== null &&
        !result.needsGrading && (
          <p className="rounded-2xl border border-gold-500/25 bg-white p-4 text-center text-sm font-bold dark:bg-midnight-950/75">
            🎓 اجمع {formatNumber(result.certificateMinScore)}% أو أكتر في الامتحان ده وخد شهادة
            {result.canRetry ? ' — لسه عندك محاولة.' : '.'}
          </p>
        )
      )}
      {result.answers.map((a, i) => {
        const pending = a.type === 'ESSAY' && Boolean(a.textAnswer) && !a.graded;
        return (
          <article
            key={a.questionId}
            className={cn(
              'rounded-2xl border bg-white p-5 dark:bg-midnight-950/75',
              pending
                ? 'border-amber-500/40'
                : a.isCorrect
                  ? 'border-emerald-500/35'
                  : a.type === 'ESSAY' && a.pointsAwarded > 0
                    ? 'border-gold-500/40'
                    : 'border-red-500/35',
            )}
          >
            <div className="flex justify-between gap-3">
              <h2 className="whitespace-pre-line font-black">
                {formatNumber(i + 1)}. {a.prompt}
              </h2>
              <span
                className={cn(
                  'shrink-0 text-sm font-bold',
                  pending
                    ? 'text-amber-700 dark:text-amber-300'
                    : a.isCorrect
                      ? 'text-emerald-600'
                      : a.type === 'ESSAY' && a.pointsAwarded > 0
                        ? 'text-gold-700 dark:text-gold-300'
                        : 'text-red-600',
                )}
              >
                {a.type === 'ESSAY'
                  ? pending
                    ? 'مستني تصحيح'
                    : `${formatNumber(a.pointsAwarded)} من ${formatNumber(a.points)}`
                  : a.isCorrect
                    ? 'صحيحة'
                    : 'خطأ'}
              </span>
            </div>
            <QuestionImage url={a.imageUrl} />
            {a.type === 'ESSAY' ? (
              <>
                <div className="mt-3 rounded-xl bg-midnight-500/5 p-3 dark:bg-white/5">
                  <p className="text-xs font-bold text-midnight-500 dark:text-ivory-300/60">
                    إجابتك
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-7">
                    {a.textAnswer ?? 'لم تتم الإجابة'}
                  </p>
                </div>
                {a.feedback && (
                  <p className="mt-2 rounded-xl bg-sky-500/10 p-3 text-sm">
                    تعليق المستر: {a.feedback}
                  </p>
                )}
                {a.explanation && (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-gold-500/10 p-3 text-sm">
                    الإجابة النموذجية: {a.explanation}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-3">
                  إجابتك: <strong>{a.selectedText ?? 'لم تتم الإجابة'}</strong>
                </p>
                {!a.isCorrect && (
                  <p className="mt-2 text-emerald-600">
                    الإجابة الصحيحة: <strong>{a.correctOption?.text}</strong>
                  </p>
                )}
                {a.explanation && (
                  <p className="mt-3 rounded-xl bg-gold-500/10 p-3">التوضيح: {a.explanation}</p>
                )}
              </>
            )}
          </article>
        );
      })}
      <Link
        href="/dashboard/assessments"
        className="flex min-h-12 items-center justify-center rounded-xl bg-gold-500 font-black text-midnight-950"
      >
        العودة للنتائج
      </Link>
    </div>
  );
}
