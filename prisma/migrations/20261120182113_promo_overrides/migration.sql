-- CreateTable
CREATE TABLE "PromoOverride" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "compatibility" "PromoCompatibility" NOT NULL,
    "collectedCompatibility" "PromoCompatibility",
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoOverride_providerId_externalKey_key" ON "PromoOverride"("providerId", "externalKey");

-- AddForeignKey
ALTER TABLE "PromoOverride" ADD CONSTRAINT "PromoOverride_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
