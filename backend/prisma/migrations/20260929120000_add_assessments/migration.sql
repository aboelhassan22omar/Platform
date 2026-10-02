CREATE TYPE "AssessmentKind" AS ENUM ('HOMEWORK', 'LESSON_EXAM', 'UNIT_EXAM');

CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "AssessmentKind" NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "timeLimitMinutes" INTEGER,
    "passingScore" INTEGER NOT NULL DEFAULT 50,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "availableFrom" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "lessonId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessments_scope_check" CHECK (
      ("kind" IN ('HOMEWORK', 'LESSON_EXAM') AND "lessonId" IS NOT NULL AND "unitId" IS NULL)
      OR ("kind" = 'UNIT_EXAM' AND "unitId" IS NOT NULL AND "lessonId" IS NULL)
    ),
    CONSTRAINT "assessments_passing_score_check" CHECK ("passingScore" BETWEEN 0 AND 100),
    CONSTRAINT "assessments_max_attempts_check" CHECK ("maxAttempts" > 0)
);

CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_questions_points_check" CHECK ("points" > 0)
);

CREATE TABLE "assessment_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "assessment_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assessments_lessonId_status_idx" ON "assessments"("lessonId", "status");
CREATE INDEX "assessments_unitId_status_idx" ON "assessments"("unitId", "status");
CREATE INDEX "assessments_kind_status_idx" ON "assessments"("kind", "status");
CREATE INDEX "assessment_questions_assessmentId_sortOrder_idx" ON "assessment_questions"("assessmentId", "sortOrder");
CREATE INDEX "assessment_options_questionId_sortOrder_idx" ON "assessment_options"("questionId", "sortOrder");
CREATE INDEX "assessment_attempts_userId_submittedAt_idx" ON "assessment_attempts"("userId", "submittedAt");
CREATE INDEX "assessment_attempts_assessmentId_userId_idx" ON "assessment_attempts"("assessmentId", "userId");
CREATE UNIQUE INDEX "assessment_answers_attemptId_questionId_key" ON "assessment_answers"("attemptId", "questionId");
CREATE INDEX "assessment_answers_questionId_idx" ON "assessment_answers"("questionId");

ALTER TABLE "assessments" ADD CONSTRAINT "assessments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_options" ADD CONSTRAINT "assessment_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "assessment_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
