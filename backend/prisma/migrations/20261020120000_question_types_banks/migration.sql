-- Phase 3: question types (MCQ, true/false, essay), images, question banks
-- with random draws per attempt, and staff grading of written answers.

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'ESSAY');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable
ALTER TABLE "assessment_answers" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedById" TEXT,
ADD COLUMN     "textAnswer" TEXT;

-- AlterTable
ALTER TABLE "assessment_attempts" ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedById" TEXT,
ADD COLUMN     "needsGrading" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "assessment_questions" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "bankId" TEXT,
ADD COLUMN     "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "imageKey" TEXT,
ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
ALTER COLUMN "assessmentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseId" TEXT NOT NULL,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_draw_rules" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "difficulty" "QuestionDifficulty",
    "count" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assessment_draw_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_banks_courseId_idx" ON "question_banks"("courseId");

-- CreateIndex
CREATE INDEX "assessment_draw_rules_assessmentId_idx" ON "assessment_draw_rules"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_draw_rules_bankId_idx" ON "assessment_draw_rules"("bankId");

-- CreateIndex
CREATE INDEX "assessment_attempts_needsGrading_submittedAt_idx" ON "assessment_attempts"("needsGrading", "submittedAt");

-- CreateIndex
CREATE INDEX "assessment_questions_bankId_difficulty_idx" ON "assessment_questions"("bankId", "difficulty");

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_draw_rules" ADD CONSTRAINT "assessment_draw_rules_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_draw_rules" ADD CONSTRAINT "assessment_draw_rules_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "question_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A question is either an assessment's own question or a bank question.
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_owner_check"
  CHECK (("assessmentId" IS NULL) <> ("bankId" IS NULL));

ALTER TABLE "assessment_draw_rules" ADD CONSTRAINT "assessment_draw_rules_count_check"
  CHECK ("count" > 0 AND "count" <= 200);
