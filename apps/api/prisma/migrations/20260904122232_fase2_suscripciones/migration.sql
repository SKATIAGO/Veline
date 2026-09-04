-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('PRUEBA', 'ACTIVA', 'IMPAGADA', 'SUSPENDIDA', 'CANCELADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'NEGOCIO_PLAN_CAMBIADO';
ALTER TYPE "AuditAction" ADD VALUE 'NEGOCIO_SUSPENDIDO';
ALTER TYPE "AuditAction" ADD VALUE 'NEGOCIO_REACTIVADO';
ALTER TYPE "AuditAction" ADD VALUE 'PRUEBA_AMPLIADA';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "subStatus" "SubStatus" NOT NULL DEFAULT 'PRUEBA',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
