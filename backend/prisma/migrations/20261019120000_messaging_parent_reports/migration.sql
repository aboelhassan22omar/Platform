-- Phase 2: WhatsApp outbox, weekly parent reports, daily study time.

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('WEEKLY_REPORT', 'NEW_LESSON', 'LIVE_REMINDER', 'HOMEWORK_DUE', 'SUBSCRIPTION_EXPIRING', 'PAYMENT_CONFIRMED');

-- CreateEnum
CREATE TYPE "MessageAudience" AS ENUM ('STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'MANUAL', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "announcedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "live_sessions" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "parentReportsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "audience" "MessageAudience" NOT NULL,
    "userId" TEXT,
    "toPhone" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "params" TEXT[],
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_reports" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_days" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "study_days_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_messages_providerMessageId_key" ON "outbound_messages"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_messages_dedupeKey_key" ON "outbound_messages"("dedupeKey");

-- CreateIndex
CREATE INDEX "outbound_messages_status_scheduledFor_idx" ON "outbound_messages"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "outbound_messages_userId_createdAt_idx" ON "outbound_messages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "outbound_messages_kind_createdAt_idx" ON "outbound_messages"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "parent_reports_token_key" ON "parent_reports"("token");

-- CreateIndex
CREATE INDEX "parent_reports_createdAt_idx" ON "parent_reports"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "parent_reports_userId_weekStart_key" ON "parent_reports"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "study_days_day_idx" ON "study_days"("day");

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_reports" ADD CONSTRAINT "parent_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_days" ADD CONSTRAINT "study_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lessons already out were announced long ago: only lessons published from
-- now on trigger the "new lesson" message.
UPDATE "lessons" SET "announcedAt" = CURRENT_TIMESTAMP WHERE "status" = 'PUBLISHED';
