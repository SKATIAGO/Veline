-- Cuentas creadas desde el panel (por el superadmin o por el dueño) que se
-- quedaron sin poder entrar.
--
-- Desde el 8 sep 2026 el login exige el correo confirmado, pero las cuentas
-- que se dan de alta a mano nacían con "emailVerifiedAt" vacío y no reciben
-- enlace de confirmación: no había forma de que entraran nunca.
--
-- Se distinguen de las altas por la web, que sí deben seguir sin verificar
-- hasta que pinchen el enlace, porque esas SIEMPRE tienen una fila en
-- "EmailVerification" (se crea en el mismo alta y no se borra nunca, solo se
-- marca como usada). Una cuenta sin verificar y sin ningún enlace solo puede
-- venir del panel o del seed.
UPDATE "User" u
SET "emailVerifiedAt" = u."createdAt"
WHERE u."emailVerifiedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "EmailVerification" v WHERE v."userId" = u.id);
