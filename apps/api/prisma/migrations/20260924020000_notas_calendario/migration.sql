-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'NOTA_CREADA';
ALTER TYPE "AuditAction" ADD VALUE 'NOTA_ELIMINADA';

-- CreateTable
CREATE TABLE "CalendarNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarNote_businessId_date_idx" ON "CalendarNote"("businessId", "date");

-- AddForeignKey
ALTER TABLE "CalendarNote" ADD CONSTRAINT "CalendarNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
