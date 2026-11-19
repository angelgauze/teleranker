-- CreateEnum
CREATE TYPE "PromoCompatibility" AS ENUM ('FOUR_G', 'FIVE_G', 'FOUR_G_AND_FIVE_G', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DataAllocationKind" AS ENUM ('TOTAL', 'UNLIMITED', 'NONE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ValidityUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('ACTIVE', 'OUTDATED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ScrapeRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promo" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalKey" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCentavos" INTEGER NOT NULL,
    "dataKind" "DataAllocationKind" NOT NULL DEFAULT 'UNKNOWN',
    "dataGb" DECIMAL(10,2),
    "allAccessGb" DECIMAL(10,2),
    "dataNotes" TEXT,
    "validityValue" INTEGER,
    "validityUnit" "ValidityUnit",
    "compatibility" "PromoCompatibility" NOT NULL DEFAULT 'UNKNOWN',
    "callsUnlimited" BOOLEAN,
    "callsIncluded" INTEGER,
    "textsUnlimited" BOOLEAN,
    "textsIncluded" INTEGER,
    "status" "PromoStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "displayName" TEXT,
    "body" VARCHAR(400) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "ScrapeRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsCollected" INTEGER NOT NULL DEFAULT 0,
    "recordsAccepted" INTEGER NOT NULL DEFAULT 0,
    "recordsRejected" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "errorDetail" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promo_providerId_status_idx" ON "Promo"("providerId", "status");

-- CreateIndex
CREATE INDEX "Promo_priceCentavos_idx" ON "Promo"("priceCentavos");

-- CreateIndex
CREATE UNIQUE INDEX "Promo_providerId_externalKey_key" ON "Promo"("providerId", "externalKey");

-- CreateIndex
CREATE INDEX "Review_providerId_status_idx" ON "Review"("providerId", "status");

-- CreateIndex
CREATE INDEX "ScrapeRun_providerId_startedAt_idx" ON "ScrapeRun"("providerId", "startedAt");

-- AddForeignKey
ALTER TABLE "Promo" ADD CONSTRAINT "Promo_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
