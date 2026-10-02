ALTER TABLE "assessments"
ADD COLUMN "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shuffleOptions" BOOLEAN NOT NULL DEFAULT false;
