-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('RESERVA_CONFIRMADA', 'RESERVA_CANCELADA', 'RECORDATORIO', 'RESTABLECER_CONTRASENA', 'RESENA_PEDIDA');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('ENVIADO', 'FALLIDO', 'OMITIDO');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "bookingId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "to" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "reason" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageLog_businessId_createdAt_idx" ON "MessageLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_bookingId_idx" ON "MessageLog"("bookingId");

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
