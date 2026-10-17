import { blankQuestion, type EditorQuestion, type QuestionDifficulty } from './question-fields';

/**
 * Turns pasted text (from Word, a PDF or a chat) into questions. Questions are
 * separated by a blank line:
 *
 *   ١- متى قامت ثورة ١٩١٩؟
 *   أ) ١٩١٨
 *   ب) ١٩١٩ *
 *   ج) ١٩٢٠
 *
 *   قامت الثورة العرابية سنة ١٨٨١ (صح)
 *
 *   اشرح أسباب ثورة ١٩١٩.
 *
 * Choices start with a letter or number and ")" "-" "." or a bullet; the
 * correct one is marked with * or ✓. A line ending in (صح) or (غلط) is a
 * true/false question. A question with no choices is an essay.
 */
export interface ParsedQuestion {
  question: EditorQuestion;
  /** Why the block cannot be imported as is, if anything. */
  problem: string | null;
  source: string;
}

const EASTERN = '٠١٢٣٤٥٦٧٨٩';
const toLatinDigits = (text: string) => text.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d)));

const OPTION =
  /^\s*(?:[([]?\s*(?:[أابتثجحخدذرزسشصضطظعغفقكلمنهوي]|[a-hA-H]|\d{1,2})\s*[)\].\-:]|[-•●▪◦*]\s)\s*(.+)$/;
// "١-", "2)", "س٣:", "سؤال 4 -", "Q5." — a separator is required, so a prompt
// that merely starts with the letter س is left alone.
const NUMBERING = /^\s*(?:(?:سؤال|س|Q)\s*[\d٠-٩]*\s*[:/\-).]|[\d٠-٩]{1,3}\s*[).\-:])\s*/i;
const CORRECT_MARK = /\s*(?:\*|✓|✔|\(\s*صح(?:يح)?\s*\))\s*$/;
const LEADING_MARK = /^\s*(?:\*|✓|✔)\s*/;
const TRUE_FALSE = /\s*[([]\s*(صح|صحيح|خطأ|خطا|غلط|✓|✗|×)\s*[)\]]\s*$/;

export function parseQuestions(
  text: string,
  defaults: { difficulty: QuestionDifficulty; points: number },
): ParsedQuestion[] {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const promptLines: string[] = [];
    const options: Array<{ text: string; isCorrect: boolean }> = [];

    for (const line of lines) {
      const match = promptLines.length ? OPTION.exec(toLatinDigits(line)) : null;
      if (match) {
        // Re-read the choice from the original line, keeping its own digits.
        const original = OPTION.exec(line)?.[1] ?? match[1];
        const isCorrect = CORRECT_MARK.test(original) || LEADING_MARK.test(original);
        options.push({
          text: original.replace(CORRECT_MARK, '').replace(LEADING_MARK, '').trim(),
          isCorrect,
        });
      } else if (options.length) {
        // A wrapped choice continues on the next line.
        options[options.length - 1].text += ` ${line}`;
      } else {
        promptLines.push(line);
      }
    }

    let prompt = promptLines.join('\n').replace(NUMBERING, '').trim();
    let question: EditorQuestion;
    let problem: string | null = null;

    const trueFalse = !options.length ? TRUE_FALSE.exec(prompt) : null;
    if (trueFalse) {
      prompt = prompt.replace(TRUE_FALSE, '').trim();
      const isTrue = ['صح', 'صحيح', '✓'].includes(trueFalse[1]);
      question = {
        ...blankQuestion('TRUE_FALSE'),
        options: [
          { text: 'صح', isCorrect: isTrue },
          { text: 'غلط', isCorrect: !isTrue },
        ],
      };
    } else if (!options.length) {
      question = blankQuestion('ESSAY');
    } else {
      question = { ...blankQuestion('MCQ'), options: options.slice(0, 6) };
      const correct = options.filter((option) => option.isCorrect).length;
      if (options.length < 2) problem = 'محتاج اختيارين على الأقل';
      else if (options.length > 6) problem = 'أقصى عدد ٦ اختيارات';
      else if (correct === 0) problem = 'علّم الإجابة الصحيحة بعلامة *';
      else if (correct > 1) problem = 'فيه أكتر من إجابة صحيحة متعلّمة';
    }
    if (prompt.length < 2) problem = 'نص السؤال ناقص';

    return {
      question: {
        ...question,
        prompt,
        difficulty: defaults.difficulty,
        points: question.type === 'ESSAY' ? Math.max(defaults.points, 2) : defaults.points,
      },
      problem,
      source: block,
    };
  });
}
