ALTER TABLE "courses" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "units" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "chapters" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "lessons" ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX "courses_status_scheduledAt_idx" ON "courses"("status", "scheduledAt");
CREATE INDEX "units_status_scheduledAt_idx" ON "units"("status", "scheduledAt");
CREATE INDEX "chapters_status_scheduledAt_idx" ON "chapters"("status", "scheduledAt");
CREATE INDEX "lessons_status_scheduledAt_idx" ON "lessons"("status", "scheduledAt");
