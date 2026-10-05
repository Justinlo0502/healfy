-- `musclePct` held skeletal muscle % and `skeletalMusclePct` held muscle mass
-- in kg; rename so the column names match what the values are.
ALTER TABLE "RenphoMeasurement" RENAME COLUMN "skeletalMusclePct" TO "muscleMassKg";
ALTER TABLE "RenphoMeasurement" RENAME COLUMN "musclePct" TO "skeletalMusclePct";
