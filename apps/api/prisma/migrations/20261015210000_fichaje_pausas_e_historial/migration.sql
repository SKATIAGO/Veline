-- Registro de jornada: pausas dentro de la jornada y el historial completo de
-- correcciones (antes solo se guardaba la primera, en las columnas *Original).
CREATE TABLE "FichajePausa" (
  "id" TEXT NOT NULL,
  "fichajeId" TEXT NOT NULL,
  "inicio" TIMESTAMP(3) NOT NULL,
  "fin" TIMESTAMP(3),
  CONSTRAINT "FichajePausa_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FichajePausa_fichajeId_idx" ON "FichajePausa"("fichajeId");
ALTER TABLE "FichajePausa" ADD CONSTRAINT "FichajePausa_fichajeId_fkey"
  FOREIGN KEY ("fichajeId") REFERENCES "Fichaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FichajeCorreccion" (
  "id" TEXT NOT NULL,
  "fichajeId" TEXT NOT NULL,
  "porId" TEXT,
  "en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "motivo" TEXT NOT NULL,
  "entradaAntes" TIMESTAMP(3),
  "salidaAntes" TIMESTAMP(3),
  "entradaDespues" TIMESTAMP(3) NOT NULL,
  "salidaDespues" TIMESTAMP(3),
  CONSTRAINT "FichajeCorreccion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FichajeCorreccion_fichajeId_en_idx" ON "FichajeCorreccion"("fichajeId", "en");
ALTER TABLE "FichajeCorreccion" ADD CONSTRAINT "FichajeCorreccion_fichajeId_fkey"
  FOREIGN KEY ("fichajeId") REFERENCES "Fichaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FichajeCorreccion" ADD CONSTRAINT "FichajeCorreccion_porId_fkey"
  FOREIGN KEY ("porId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las correcciones que ya existían pasan al historial, para que no haya dos
-- formas de contar lo mismo.
INSERT INTO "FichajeCorreccion" ("id", "fichajeId", "porId", "en", "motivo", "entradaAntes", "salidaAntes", "entradaDespues", "salidaDespues")
SELECT 'mig-' || "id", "id", "corregidoPorId", "corregidoEn", COALESCE("motivo", ''), "entradaOriginal", "salidaOriginal", "entrada", "salida"
FROM "Fichaje" WHERE "corregidoEn" IS NOT NULL;
