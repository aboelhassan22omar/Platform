-- Additive bilingual-content migration. Existing Arabic content remains the
-- source of truth and is used as the safe fallback until English is supplied.
ALTER TABLE "grades"
  ADD COLUMN "nameEn" TEXT,
  ADD COLUMN "shortNameEn" TEXT,
  ADD COLUMN "descriptionEn" TEXT;

ALTER TABLE "courses" ADD COLUMN "titleEn" TEXT, ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "units" ADD COLUMN "titleEn" TEXT, ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "chapters" ADD COLUMN "titleEn" TEXT, ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "lessons" ADD COLUMN "titleEn" TEXT, ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "attachments" ADD COLUMN "titleEn" TEXT;
ALTER TABLE "products" ADD COLUMN "titleEn" TEXT, ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "plans"
  ADD COLUMN "titleEn" TEXT,
  ADD COLUMN "descriptionEn" TEXT,
  ADD COLUMN "highlightsEn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "assessments" ADD COLUMN "titleEn" TEXT, ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "assessment_questions" ADD COLUMN "promptEn" TEXT, ADD COLUMN "explanationEn" TEXT;
ALTER TABLE "assessment_options" ADD COLUMN "textEn" TEXT;
ALTER TABLE "notifications" ADD COLUMN "titleEn" TEXT, ADD COLUMN "bodyEn" TEXT;

UPDATE "grades" SET "nameEn" = 'First Secondary Grade', "shortNameEn" = 'First Secondary', "descriptionEn" = 'Egypt and the ancient world — from the Pharaohs to Greece and Rome' WHERE "slug" = 'first-secondary';
UPDATE "grades" SET "nameEn" = 'Second Secondary Grade', "shortNameEn" = 'Second Secondary', "descriptionEn" = 'Modern Europe and the Arab world under Ottoman rule' WHERE "slug" = 'second-secondary';
UPDATE "grades" SET "nameEn" = 'Third Secondary Grade', "shortNameEn" = 'Third Secondary', "descriptionEn" = 'Modern and contemporary Egyptian history — examination year' WHERE "slug" = 'third-secondary';
UPDATE "grades" SET "nameEn" = 'First Baccalaureate Grade', "shortNameEn" = 'First Baccalaureate', "descriptionEn" = 'Egypt and the ancient world in the Egyptian Baccalaureate pathway' WHERE "slug" = 'first-baccalaureate';
UPDATE "grades" SET "nameEn" = 'Second Baccalaureate Grade', "shortNameEn" = 'Second Baccalaureate', "descriptionEn" = 'Modern and contemporary Egypt — the July Revolution and major transformations' WHERE "slug" = 'second-baccalaureate';
