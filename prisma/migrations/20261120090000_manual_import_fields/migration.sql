-- CreateEnum
CREATE TYPE "PromoOrigin" AS ENUM ('COLLECTED', 'MANUAL');

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "promoPageUrl" TEXT;

-- AlterTable
ALTER TABLE "Promo" ADD COLUMN     "noExpiry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" "PromoOrigin" NOT NULL DEFAULT 'COLLECTED';

