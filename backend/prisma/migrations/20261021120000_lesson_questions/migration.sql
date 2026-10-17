-- Phase 4: questions and answers under each lesson.

-- CreateEnum
CREATE TYPE "LessonQuestionStatus" AS ENUM ('OPEN', 'ANSWERED');

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'QUESTION_ANSWERED';

-- CreateTable
CREATE TABLE "lesson_questions" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "videoSeconds" INTEGER,
    "status" "LessonQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_question_replies" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_question_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_question_votes" (
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_question_votes_pkey" PRIMARY KEY ("questionId","userId")
);

-- CreateIndex
CREATE INDEX "lesson_questions_lessonId_hidden_createdAt_idx" ON "lesson_questions"("lessonId", "hidden", "createdAt");

-- CreateIndex
CREATE INDEX "lesson_questions_status_createdAt_idx" ON "lesson_questions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "lesson_questions_userId_createdAt_idx" ON "lesson_questions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "lesson_question_replies_questionId_createdAt_idx" ON "lesson_question_replies"("questionId", "createdAt");

-- CreateIndex
CREATE INDEX "lesson_question_votes_userId_idx" ON "lesson_question_votes"("userId");

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_replies" ADD CONSTRAINT "lesson_question_replies_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "lesson_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_replies" ADD CONSTRAINT "lesson_question_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_votes" ADD CONSTRAINT "lesson_question_votes_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "lesson_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_votes" ADD CONSTRAINT "lesson_question_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
