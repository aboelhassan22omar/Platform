CREATE TYPE "StudentType" AS ENUM ('ONLINE', 'CENTER');
ALTER TABLE "users" ADD COLUMN "studentType" "StudentType" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "lessons" ADD COLUMN "centerPriceMinor" INTEGER;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_center_price_nonnegative" CHECK ("centerPriceMinor" IS NULL OR "centerPriceMinor" >= 0);
