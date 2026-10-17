import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionDifficulty, QuestionType } from '../generated/prisma/enums';

export class QuestionOptionDto {
  @IsString() @MinLength(1) @MaxLength(500) text!: string;
  @IsOptional() @IsString() @MaxLength(500) textEn?: string;
  @IsBoolean() isCorrect!: boolean;
}

/** One question as staff write it, for an exam or a bank. */
export class QuestionDto {
  @IsOptional() @IsEnum(QuestionType) type?: QuestionType;
  @IsOptional() @IsEnum(QuestionDifficulty) difficulty?: QuestionDifficulty;
  /** Key returned by the image upload; only our own question images are accepted. */
  @IsOptional()
  @IsString()
  @Matches(/^questions\/[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/, { message: 'صورة السؤال غير صالحة' })
  imageKey?: string | null;
  @IsString() @MinLength(2) @MaxLength(1500) prompt!: string;
  @IsOptional() @IsString() @MaxLength(1500) promptEn?: string;
  /** Explanation after marking; for an essay, the model answer shown to graders. */
  @IsOptional() @IsString() @MaxLength(3000) explanation?: string;
  @IsOptional() @IsString() @MaxLength(3000) explanationEn?: string;
  @IsInt() @Min(1) @Max(100) points!: number;
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];
}

export const TRUE_FALSE_LABELS = ['صح', 'غلط'] as const;

/**
 * Validates a question against the rules of its type and returns the rows to
 * store. True/false always stores the same two options, so its wording stays
 * consistent; an essay stores none.
 */
export function normalizeQuestion(question: QuestionDto, index: number) {
  const type = question.type ?? QuestionType.MCQ;
  const label = `السؤال رقم ${index + 1}`;
  let options: Array<{ text: string; textEn: string | null; isCorrect: boolean }>;

  if (type === QuestionType.ESSAY) {
    options = [];
  } else if (type === QuestionType.TRUE_FALSE) {
    const correct = question.options.findIndex((option) => option.isCorrect);
    if (correct !== 0 && correct !== 1) {
      throw new BadRequestException(`${label}: اختار الإجابة الصحيحة، صح ولا غلط`);
    }
    options = TRUE_FALSE_LABELS.map((text, optionIndex) => ({
      text,
      textEn: optionIndex === 0 ? 'True' : 'False',
      isCorrect: optionIndex === correct,
    }));
  } else {
    if (question.options.length < 2) {
      throw new BadRequestException(`${label}: محتاج اختيارين على الأقل`);
    }
    if (question.options.filter((option) => option.isCorrect).length !== 1) {
      throw new BadRequestException(`${label} يجب أن يحتوي على إجابة صحيحة واحدة`);
    }
    options = question.options.map((option) => ({
      text: option.text.trim(),
      textEn: option.textEn?.trim() || null,
      isCorrect: option.isCorrect,
    }));
  }

  return {
    type,
    difficulty: question.difficulty ?? QuestionDifficulty.MEDIUM,
    imageKey: question.imageKey || null,
    prompt: question.prompt.trim(),
    promptEn: question.promptEn?.trim() || null,
    explanation: question.explanation?.trim() || null,
    explanationEn: question.explanationEn?.trim() || null,
    points: question.points,
    options,
  };
}

/** Nested-create payload for a normalized question's options. */
export const optionRows = (options: ReturnType<typeof normalizeQuestion>['options']) => ({
  create: options.map((option, sortOrder) => ({ ...option, sortOrder })),
});
