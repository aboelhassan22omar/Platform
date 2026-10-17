-- Phase 5: phone notifications (Web Push) and center attendance by QR.

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('SCAN', 'MANUAL');

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'CENTER_ABSENCE';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "pushedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "closedAt" TIMESTAMP(3),
    "absenceNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "attendance_sessions_gradeId_startsAt_idx" ON "attendance_sessions"("gradeId", "startsAt");

-- CreateIndex
CREATE INDEX "attendance_sessions_startsAt_idx" ON "attendance_sessions"("startsAt");

-- CreateIndex
CREATE INDEX "attendance_userId_markedAt_idx" ON "attendance"("userId", "markedAt");

-- CreateIndex
CREATE INDEX "notifications_pushedAt_createdAt_idx" ON "notifications"("pushedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing notifications are history, not news: never push them.
UPDATE "notifications" SET "pushedAt" = "createdAt";
