-- A live recording can be published as a lesson's video.
ALTER TABLE "live_recordings" ADD COLUMN "publishedLessonId" TEXT;
ALTER TABLE "live_recordings" ADD COLUMN "publishedAt" TIMESTAMP(3);

ALTER TABLE "live_recordings"
  ADD CONSTRAINT "live_recordings_publishedLessonId_fkey"
  FOREIGN KEY ("publishedLessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
