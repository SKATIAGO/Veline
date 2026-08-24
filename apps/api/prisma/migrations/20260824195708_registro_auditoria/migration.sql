-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SESION_INICIADA', 'SESION_FALLIDA', 'SESION_CERRADA', 'CONTRASENA_CAMBIADA', 'CONTRASENA_RESTABLECIDA', 'CONTRASENA_OLVIDADA', 'USUARIO_CREADO', 'USUARIO_ACTIVADO', 'USUARIO_DESACTIVADO', 'NEGOCIO_CREADO', 'SERVICIO_CREADO', 'SERVICIO_EDITADO', 'SERVICIO_ELIMINADO', 'HORARIO_EDITADO', 'RESERVA_CREADA', 'RESERVA_CANCELADA');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "actorRole" "Role",
    "businessId" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
