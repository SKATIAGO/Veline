-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDIENTE', 'COBRADO', 'ANULADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'COBRO_GENERADO';
ALTER TYPE "AuditAction" ADD VALUE 'COBRO_MARCADO';

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDIENTE',
    "plan" "Plan" NOT NULL,
    "seats" INTEGER NOT NULL,
    "subscriptionCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "messagesCents" INTEGER NOT NULL,
    "extraMessages" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Charge_status_period_idx" ON "Charge"("status", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_businessId_period_key" ON "Charge"("businessId", "period");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
