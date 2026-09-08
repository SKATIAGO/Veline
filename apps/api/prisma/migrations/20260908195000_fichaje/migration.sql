-- Registro de jornada (art. 34.9 ET).

CREATE TABLE "Fichaje" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entrada" TIMESTAMP(3) NOT NULL,
    "salida" TIMESTAMP(3),
    -- Lo que decía antes de corregirlo: el original no se pisa nunca.
    "entradaOriginal" TIMESTAMP(3),
    "salidaOriginal" TIMESTAMP(3),
    "corregidoPorId" TEXT,
    "corregidoEn" TIMESTAMP(3),
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fichaje_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Fichaje_businessId_entrada_idx" ON "Fichaje"("businessId", "entrada");
CREATE INDEX "Fichaje_userId_entrada_idx" ON "Fichaje"("userId", "entrada");

ALTER TABLE "Fichaje" ADD CONSTRAINT "Fichaje_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Fichaje" ADD CONSTRAINT "Fichaje_corregidoPorId_fkey"
    FOREIGN KEY ("corregidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Fichaje" ADD CONSTRAINT "Fichaje_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
