ALTER TABLE "live_sessions" ADD COLUMN "kickedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
