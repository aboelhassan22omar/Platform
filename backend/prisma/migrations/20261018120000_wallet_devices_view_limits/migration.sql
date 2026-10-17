-- Phase 1: platform wallet, per-account device limit, per-lesson view limit.

-- CreateEnum
CREATE TYPE "OrderPurpose" AS ENUM ('PURCHASE', 'WALLET_TOPUP');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'PURCHASE', 'ADMIN_CREDIT', 'ADMIN_DEBIT');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BALANCE';

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'PLATFORM_WALLET';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "walletBalanceMinor" INTEGER NOT NULL DEFAULT 0;

-- The balance can never go below zero, whatever the application does.
ALTER TABLE "users" ADD CONSTRAINT "users_wallet_balance_non_negative" CHECK ("walletBalanceMinor" >= 0);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paidFromWallet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purpose" "OrderPurpose" NOT NULL DEFAULT 'PURCHASE';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "maxViews" INTEGER;

ALTER TABLE "lessons" ADD CONSTRAINT "lessons_max_views_non_negative" CHECK ("maxViews" IS NULL OR "maxViews" >= 0);

-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN     "bonusViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewedSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "deviceId" TEXT;

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "balanceAfterMinor" INTEGER NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_devices_userId_lastSeenAt_idx" ON "user_devices"("userId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_tokenHash_key" ON "user_devices"("userId", "tokenHash");

-- CreateIndex
CREATE INDEX "wallet_transactions_userId_createdAt_idx" ON "wallet_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_orderId_idx" ON "wallet_transactions"("orderId");

-- A top-up order credits the balance exactly once.
CREATE UNIQUE INDEX "wallet_transactions_topup_order_key" ON "wallet_transactions"("orderId") WHERE "type" = 'TOPUP';

-- CreateIndex
CREATE INDEX "refresh_tokens_deviceId_idx" ON "refresh_tokens"("deviceId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
