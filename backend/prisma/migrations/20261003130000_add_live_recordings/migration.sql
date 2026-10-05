-- CreateEnum
CREATE TYPE "LiveEndReason" AS ENUM ('HOST_ENDED', 'HOST_LEFT');

-- CreateEnum
CREATE TYPE "LiveRecordingStatus" AS ENUM ('RECORDING', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "live_sessions" ADD COLUMN     "endReason" "LiveEndReason",
ADD COLUMN     "hostAbsentSince" TIMESTAMP(3),
ADD COLUMN     "recordingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "live_recordings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "egressId" TEXT NOT NULL,
    "status" "LiveRecordingStatus" NOT NULL DEFAULT 'RECORDING',
    "objectKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "sizeBytes" BIGINT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_recordings_egressId_key" ON "live_recordings"("egressId");

-- CreateIndex
CREATE INDEX "live_recordings_sessionId_idx" ON "live_recordings"("sessionId");

-- CreateIndex
CREATE INDEX "live_recordings_status_idx" ON "live_recordings"("status");

-- AddForeignKey
ALTER TABLE "live_recordings" ADD CONSTRAINT "live_recordings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
