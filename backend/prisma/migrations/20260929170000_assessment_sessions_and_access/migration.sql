ALTER TYPE "ProductKind" ADD VALUE 'ASSESSMENT';
ALTER TYPE "EntitlementScope" ADD VALUE 'ASSESSMENT';
CREATE TYPE "AssessmentAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT');

ALTER TABLE "assessments" ADD COLUMN "isFree" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "assessments" ADD COLUMN "priceMinor" INTEGER;
ALTER TABLE "products" ADD COLUMN "assessmentId" TEXT;
ALTER TABLE "entitlements" ADD COLUMN "assessmentId" TEXT;

ALTER TABLE "assessment_attempts" ADD COLUMN "status" "AssessmentAttemptStatus" NOT NULL DEFAULT 'SUBMITTED';
ALTER TABLE "assessment_attempts" ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "assessment_attempts" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "assessment_attempts" ALTER COLUMN "submittedAt" DROP NOT NULL;
ALTER TABLE "assessment_attempts" ALTER COLUMN "submittedAt" DROP DEFAULT;

CREATE UNIQUE INDEX "products_assessmentId_key" ON "products"("assessmentId");
CREATE INDEX "entitlements_userId_assessmentId_idx" ON "entitlements"("userId", "assessmentId");
CREATE UNIQUE INDEX "entitlements_user_assessment_active" ON "entitlements"("userId", "assessmentId") WHERE "assessmentId" IS NOT NULL AND "status" = 'ACTIVE';
ALTER TABLE "products" ADD CONSTRAINT "products_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
