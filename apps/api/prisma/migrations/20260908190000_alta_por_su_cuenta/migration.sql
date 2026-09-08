-- Alta de negocio por su cuenta: aprobación y verificación de correo.

ALTER TABLE "Business" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Lo que ya existe se da por bueno. Sin esto, la columna nace a NULL, el
-- listado del marketplace —que filtra por aprobados— se queda vacío y todos
-- los negocios reales desaparecen de la web de golpe.
-- Se usa su fecha de alta y no now() para no inventarse cuándo se revisaron.
UPDATE "Business" SET "approvedAt" = "createdAt" WHERE "approvedAt" IS NULL;

-- Mismo motivo: las cuentas que existen se crearon a mano y su correo ya se
-- comprobó al darlas de alta. Si nacieran sin verificar, mañana nadie podría
-- entrar al panel.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");
CREATE INDEX "EmailVerification_expiresAt_idx" ON "EmailVerification"("expiresAt");

ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
