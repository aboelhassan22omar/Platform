'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'ESSAY';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface EditorQuestion {
  /** Set for bank questions being edited. */
  id?: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  imageKey: string | null;
  imageUrl: string | null;
  prompt: string;
  /** Explanation after marking; for an essay, the model answer for graders. */
  explanation: string;
  points: number;
  options: Array<{ text: string; isCorrect: boolean }>;
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'اختيار من متعدد',
  TRUE_FALSE: 'صح وغلط',
  ESSAY: 'مقالي',
};
export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  EASY: 'سهل',
  MEDIUM: 'متوسط',
  HARD: 'صعب',
};
export const DIFFICULTY_STYLES: Record<QuestionDifficulty, string> = {
  EASY: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  MEDIUM: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  HARD: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

const TRUE_FALSE = ['صح', 'غلط'];

export const blankQuestion = (type: QuestionType = 'MCQ'): EditorQuestion => ({
  type,
  difficulty: 'MEDIUM',
  imageKey: null,
  imageUrl: null,
  prompt: '',
  explanation: '',
  points: type === 'ESSAY' ? 5 : 1,
  options:
    type === 'TRUE_FALSE'
      ? TRUE_FALSE.map((text, index) => ({ text, isCorrect: index === 0 }))
      : type === 'ESSAY'
        ? []
        : [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ],
});

/** From the API's question shape to the editor's. */
export const toEditorQuestion = (question: {
  id?: string;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  imageKey?: string | null;
  imageUrl?: string | null;
  prompt: string;
  explanation: string | null;
  points: number;
  options: Array<{ text: string; isCorrect: boolean }>;
}): EditorQuestion => ({
  id: question.id,
  type: question.type ?? 'MCQ',
  difficulty: question.difficulty ?? 'MEDIUM',
  imageKey: question.imageKey ?? null,
  imageUrl: question.imageUrl ?? null,
  prompt: question.prompt,
  explanation: question.explanation ?? '',
  points: question.points,
  options: question.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
});

/** The API payload for one question. */
export const toQuestionPayload = (question: EditorQuestion, withDifficulty = false) => ({
  type: question.type,
  ...(withDifficulty ? { difficulty: question.difficulty } : {}),
  imageKey: question.imageKey,
  prompt: question.prompt.trim(),
  explanation: question.explanation.trim() || undefined,
  points: question.points,
  options: question.type === 'ESSAY' ? [] : question.options,
});

export const questionIsValid = (question: EditorQuestion) =>
  question.prompt.trim().length >= 2 &&
  question.points >= 1 &&
  (question.type === 'ESSAY' ||
    (question.options.length >= 2 &&
      question.options.every((option) => option.text.trim()) &&
      question.options.filter((option) => option.isCorrect).length === 1));

async function uploadQuestionImage(file: File) {
  const ticket = await api.post<{
    key: string;
    uploadUrl: string;
    url: string;
    headers: Record<string, string>;
  }>('/admin/assessments/question-image', {
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  const sent = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: ticket.headers,
  });
  if (!sent.ok) throw new Error('تعذر رفع الصورة');
  return { key: ticket.key, url: ticket.url };
}

/**
 * Everything about one question: its type, picture, wording, choices or
 * model answer, points and (in a bank) difficulty.
 */
export function QuestionFields({
  question,
  onChange,
  showDifficulty = false,
}: {
  question: EditorQuestion;
  onChange: (patch: Partial<EditorQuestion>) => void;
  showDifficulty?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const changeType = (type: QuestionType) => {
    if (type === question.type) return;
    const fresh = blankQuestion(type);
    onChange({
      type,
      options:
        type === 'MCQ' && question.options.length >= 2 && question.type === 'MCQ'
          ? question.options
          : fresh.options,
      points: type === 'ESSAY' && question.points < 2 ? fresh.points : question.points,
    });
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setImageError(null);
    try {
      const uploaded = await uploadQuestionImage(file);
      onChange({ imageKey: uploaded.key, imageUrl: uploaded.url });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'تعذر رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="نوع السؤال">
        {(Object.keys(TYPE_LABELS) as QuestionType[]).map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={question.type === type}
            onClick={() => changeType(type)}
            className={cn(
              'min-h-10 rounded-xl border px-3 text-sm font-bold transition-colors',
              question.type === type
                ? 'border-gold-500 bg-gold-500/15 text-gold-800 dark:text-gold-200'
                : 'border-midnight-200 text-midnight-600 hover:border-gold-500/50 dark:border-white/10 dark:text-ivory-300',
            )}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
          نص السؤال
        </span>
        <textarea
          value={question.prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          rows={2}
          className="input-base resize-y"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {question.imageUrl ? (
          <div className="relative">
            <img
              src={question.imageUrl}
              alt="صورة السؤال"
              className="max-h-40 rounded-xl border border-gold-500/20 object-contain"
            />
            <button
              type="button"
              onClick={() => onChange({ imageKey: null, imageUrl: null })}
              className="absolute end-2 top-2 rounded-lg bg-midnight-950/80 px-2 py-1 text-xs font-bold text-white"
            >
              شيل الصورة
            </button>
          </div>
        ) : (
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-dashed border-gold-500/40 px-3 text-sm font-bold text-gold-800 hover:bg-gold-500/10 dark:text-gold-300">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => void pickImage(event.target.files?.[0])}
            />
            {uploading ? 'بنرفع الصورة…' : '+ صورة للسؤال (خريطة، وثيقة…)'}
          </label>
        )}
        {imageError && <span className="text-xs font-bold text-red-600">{imageError}</span>}
      </div>

      {question.type === 'MCQ' && (
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
                onChange={(event) =>
                  onChange({
                    options: question.options.map((item, i) =>
                      i === oi ? { ...item, text: event.target.value } : item,
                    ),
                  })
                }
                className="input-base"
              />
              <button
                type="button"
                aria-pressed={option.isCorrect}
                onClick={() =>
                  onChange({
                    options: question.options.map((item, i) => ({ ...item, isCorrect: i === oi })),
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
                    onChange({
                      options: question.options
                        .filter((_, i) => i !== oi)
                        .map((item, i) => ({
                          ...item,
                          isCorrect: item.isCorrect || (i === 0 && option.isCorrect),
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
                onChange({ options: [...question.options, { text: '', isCorrect: false }] })
              }
              className="min-h-11 text-sm font-bold text-gold-700 dark:text-gold-300"
            >
              + إضافة اختيار
            </button>
          )}
        </div>
      )}

      {question.type === 'TRUE_FALSE' && (
        <div className="flex gap-2" role="radiogroup" aria-label="الإجابة الصحيحة">
          {TRUE_FALSE.map((label, index) => {
            const checked = question.options[index]?.isCorrect ?? index === 0;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() =>
                  onChange({
                    options: TRUE_FALSE.map((text, i) => ({ text, isCorrect: i === index })),
                  })
                }
                className={cn(
                  'min-h-11 flex-1 rounded-xl border-2 text-sm font-black transition-colors',
                  checked
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                    : 'border-midnight-200 text-midnight-600 dark:border-white/10 dark:text-ivory-300',
                )}
              >
                {checked ? `✓ الإجابة: ${label}` : label}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          'grid gap-3',
          showDifficulty ? 'sm:grid-cols-[1fr_7rem_8rem]' : 'sm:grid-cols-[1fr_7rem]',
        )}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
            {question.type === 'ESSAY'
              ? 'الإجابة النموذجية (بتظهر للمصحح، وللطالب بعد التصحيح)'
              : 'توضيح بعد التصحيح (اختياري)'}
          </span>
          {question.type === 'ESSAY' ? (
            <textarea
              value={question.explanation}
              onChange={(event) => onChange({ explanation: event.target.value })}
              rows={2}
              className="input-base resize-y"
            />
          ) : (
            <input
              value={question.explanation}
              onChange={(event) => onChange({ explanation: event.target.value })}
              className="input-base"
            />
          )}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
            الدرجة
          </span>
          <input
            type="number"
            min="1"
            max="100"
            value={question.points}
            onChange={(event) => onChange({ points: Number(event.target.value) })}
            className="input-base"
          />
        </label>
        {showDifficulty && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-black text-midnight-800 dark:text-ivory-100">
              الصعوبة
            </span>
            <select
              value={question.difficulty}
              onChange={(event) =>
                onChange({ difficulty: event.target.value as QuestionDifficulty })
              }
              className="input-base"
            >
              {(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {DIFFICULTY_LABELS[difficulty]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
