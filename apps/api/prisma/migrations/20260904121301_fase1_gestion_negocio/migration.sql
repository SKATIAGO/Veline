-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'RESERVA_MOVIDA';
ALTER TYPE "AuditAction" ADD VALUE 'RESERVA_COMPLETADA';
ALTER TYPE "AuditAction" ADD VALUE 'RESERVA_NO_ASISTIO';
ALTER TYPE "AuditAction" ADD VALUE 'PERSONA_CREADA';
ALTER TYPE "AuditAction" ADD VALUE 'PERSONA_EDITADA';
ALTER TYPE "AuditAction" ADD VALUE 'PERSONA_DESACTIVADA';
ALTER TYPE "AuditAction" ADD VALUE 'PERSONA_ACTIVADA';
ALTER TYPE "AuditAction" ADD VALUE 'CIERRE_CREADO';
ALTER TYPE "AuditAction" ADD VALUE 'CIERRE_ELIMINADO';
ALTER TYPE "AuditAction" ADD VALUE 'NEGOCIO_EDITADO';

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'NO_ASISTIO';
