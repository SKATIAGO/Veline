-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PERSONA_HORARIO_EDITADO';

-- CreateTable
CREATE TABLE "StaffHour" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,

    CONSTRAINT "StaffHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffHour_staffId_weekday_idx" ON "StaffHour"("staffId", "weekday");

-- AddForeignKey
ALTER TABLE "StaffHour" ADD CONSTRAINT "StaffHour_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
