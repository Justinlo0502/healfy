-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('STRAVA', 'GARMIN', 'MERGED');

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "maxHR" INTEGER,
    "restingHR" INTEGER,
    "lthr" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StravaAccount" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "stravaAthleteId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "webhookVerified" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "StravaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarminAccount" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "encryptedSession" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "GarminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "source" "ActivitySource" NOT NULL,
    "stravaId" TEXT,
    "garminId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "movingTimeSec" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "elevationGainMeters" DOUBLE PRECISION,
    "elevationLossMeters" DOUBLE PRECISION,
    "avgHR" INTEGER,
    "maxHR" INTEGER,
    "avgPaceSecPerKm" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "humidityPct" INTEGER,
    "streamData" JSONB,
    "trainingLoad" DOUBLE PRECISION,
    "aerobicEfficiency" DOUBLE PRECISION,
    "hrDriftPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bodyBattery" INTEGER,
    "hrvStatus" TEXT,
    "hrvMs" INTEGER,
    "restingHR" INTEGER,
    "sleepScore" INTEGER,
    "trainingReadiness" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedWorkout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "garminWorkoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "structure" JSONB NOT NULL,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HevyAccount" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastEventSyncAt" TIMESTAMP(3),

    CONSTRAINT "HevyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HevyRoutineFolder" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "hevyFolderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hevyIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HevyRoutineFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HevyRoutine" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "hevyRoutineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "folderId" TEXT,
    "exercises" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HevyRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HevyExerciseTemplate" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "hevyExerciseTemplateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "primaryMuscleGroup" TEXT,
    "equipment" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HevyExerciseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HevyWorkout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "hevyWorkoutId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "exercises" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HevyWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HevyBodyMeasurement" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "hevyMeasurementId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "otherMeasurements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HevyBodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_email_key" ON "Athlete"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StravaAccount_athleteId_key" ON "StravaAccount"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaAccount_stravaAthleteId_key" ON "StravaAccount"("stravaAthleteId");

-- CreateIndex
CREATE UNIQUE INDEX "GarminAccount_athleteId_key" ON "GarminAccount"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_stravaId_key" ON "Activity"("stravaId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_garminId_key" ON "Activity"("garminId");

-- CreateIndex
CREATE INDEX "Activity_athleteId_startTime_idx" ON "Activity"("athleteId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_athleteId_date_key" ON "DailyMetric"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedWorkout_garminWorkoutId_key" ON "PlannedWorkout"("garminWorkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedWorkout_activityId_key" ON "PlannedWorkout"("activityId");

-- CreateIndex
CREATE INDEX "ChatMessage_athleteId_createdAt_idx" ON "ChatMessage"("athleteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HevyAccount_athleteId_key" ON "HevyAccount"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "HevyRoutineFolder_hevyFolderId_key" ON "HevyRoutineFolder"("hevyFolderId");

-- CreateIndex
CREATE UNIQUE INDEX "HevyRoutine_hevyRoutineId_key" ON "HevyRoutine"("hevyRoutineId");

-- CreateIndex
CREATE UNIQUE INDEX "HevyExerciseTemplate_hevyExerciseTemplateId_key" ON "HevyExerciseTemplate"("hevyExerciseTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "HevyWorkout_hevyWorkoutId_key" ON "HevyWorkout"("hevyWorkoutId");

-- CreateIndex
CREATE INDEX "HevyWorkout_athleteId_startTime_idx" ON "HevyWorkout"("athleteId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "HevyBodyMeasurement_hevyMeasurementId_key" ON "HevyBodyMeasurement"("hevyMeasurementId");

-- CreateIndex
CREATE INDEX "HevyBodyMeasurement_athleteId_date_idx" ON "HevyBodyMeasurement"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "StravaAccount" ADD CONSTRAINT "StravaAccount_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarminAccount" ADD CONSTRAINT "GarminAccount_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMetric" ADD CONSTRAINT "DailyMetric_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HevyAccount" ADD CONSTRAINT "HevyAccount_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HevyRoutineFolder" ADD CONSTRAINT "HevyRoutineFolder_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HevyRoutine" ADD CONSTRAINT "HevyRoutine_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HevyRoutine" ADD CONSTRAINT "HevyRoutine_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "HevyRoutineFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HevyExerciseTemplate" ADD CONSTRAINT "HevyExerciseTemplate_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HevyWorkout" ADD CONSTRAINT "HevyWorkout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HevyBodyMeasurement" ADD CONSTRAINT "HevyBodyMeasurement_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

