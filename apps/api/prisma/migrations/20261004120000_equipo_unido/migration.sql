-- Cambiar los permisos de una cuenta desde la ficha de la persona.
ALTER TYPE "AuditAction" ADD VALUE 'USUARIO_ROL_CAMBIADO';

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Enlazar lo que ya existe: cada persona que atiende con la cuenta de su
-- mismo negocio que tiene el mismo nombre. Solo cuando la coincidencia es
-- única por los dos lados; con dudas (dos «Marta» en el mismo negocio) se
-- deja sin enlazar, y el dueño lo enlaza desde la ficha de la persona.
WITH candidatos AS (
  SELECT s.id AS staff_id, u.id AS user_id,
         COUNT(*) OVER (PARTITION BY s.id) AS por_staff,
         COUNT(*) OVER (PARTITION BY u.id) AS por_user
  FROM "Staff" s
  JOIN "User" u
    ON u."businessId" = s."businessId"
   AND lower(trim(u.name)) = lower(trim(s.name))
)
UPDATE "Staff" s
SET "userId" = c.user_id
FROM candidatos c
WHERE s.id = c.staff_id AND c.por_staff = 1 AND c.por_user = 1;
