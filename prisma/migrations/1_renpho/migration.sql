-- CreateTable
CREATE TABLE "RenphoAccount" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "RenphoAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenphoMeasurement" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "renphoMeasurementId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bmi" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "musclePct" DOUBLE PRECISION,
    "skeletalMusclePct" DOUBLE PRECISION,
    "waterPct" DOUBLE PRECISION,
    "boneMassKg" DOUBLE PRECISION,
    "visceralFat" DOUBLE PRECISION,
    "bmrKcal" DOUBLE PRECISION,
    "metabolicAge" INTEGER,
    "fatFreeWeightKg" DOUBLE PRECISION,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenphoMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RenphoAccount_athleteId_key" ON "RenphoAccount"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "RenphoMeasurement_renphoMeasurementId_key" ON "RenphoMeasurement"("renphoMeasurementId");

-- CreateIndex
CREATE INDEX "RenphoMeasurement_athleteId_measuredAt_idx" ON "RenphoMeasurement"("athleteId", "measuredAt");

-- AddForeignKey
ALTER TABLE "RenphoAccount" ADD CONSTRAINT "RenphoAccount_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenphoMeasurement" ADD CONSTRAINT "RenphoMeasurement_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

