-- Store apps: native push tokens, in-app account deletion, a device-limit
-- exemption for the app-store reviewers' demo account, and offline downloads.

-- CreateEnum
CREATE TYPE "NativePlatform" AS ENUM ('ANDROID', 'IOS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deviceLimitExempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "native_push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "NativePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "native_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "native_push_tokens_token_key" ON "native_push_tokens"("token");

-- CreateIndex
CREATE INDEX "native_push_tokens_userId_idx" ON "native_push_tokens"("userId");

-- AddForeignKey
ALTER TABLE "native_push_tokens" ADD CONSTRAINT "native_push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "video_assets" ADD COLUMN     "offlineKey" TEXT,
ADD COLUMN     "offlineQuality" TEXT,
ADD COLUMN     "offlineSize" BIGINT,
ADD COLUMN     "offlineUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lesson_downloads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_downloads_lessonId_idx" ON "lesson_downloads"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_downloads_userId_lessonId_key" ON "lesson_downloads"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "lesson_downloads" ADD CONSTRAINT "lesson_downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_downloads" ADD CONSTRAINT "lesson_downloads_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
