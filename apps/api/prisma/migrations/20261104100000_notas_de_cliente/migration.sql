-- Notas que cada negocio apunta de sus clientes (p. ej. la mezcla de tinte).
CREATE TABLE "NotaDeCliente" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaDeCliente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotaDeCliente_businessId_customerId_createdAt_idx" ON "NotaDeCliente"("businessId", "customerId", "createdAt");

ALTER TABLE "NotaDeCliente" ADD CONSTRAINT "NotaDeCliente_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotaDeCliente" ADD CONSTRAINT "NotaDeCliente_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
