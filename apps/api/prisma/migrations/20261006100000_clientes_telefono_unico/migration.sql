-- Un cliente, un teléfono: «612345678», «612 34 56 78» y «+34 612 34 56 78»
-- eran tres personas distintas (el teléfono es único, pero tal como se
-- escribió), cada una con su historial. Desde ahora se guarda siempre con
-- nueve cifras (ver normalizarTelefono en packages/shared); esto arregla lo
-- que ya estaba guardado.
--
-- Se hace en una sola transacción (la de la migración): o se une todo o nada.
-- Solo se tocan los teléfonos que, limpios, son de nueve cifras; cualquier
-- otro se deja como está.
--
-- De cada grupo de duplicados se queda el cliente más antiguo, con el
-- nombre más reciente (el que se usó la última vez) y el último correo que
-- se haya dado, igual que habría pasado si siempre hubiera sido el mismo.
-- Sus citas y reseñas pasan a él antes de borrar los demás: las reseñas
-- cuelgan del cliente con ON DELETE CASCADE, así que borrar primero las
-- perdería.

CREATE TEMP TABLE _cliente_clave AS
SELECT id, name, email, "createdAt", clave
FROM (
  SELECT c.*,
         CASE
           WHEN regexp_replace(c.phone, '\D', '', 'g') ~ '^34\d{9}$'
             THEN substr(regexp_replace(c.phone, '\D', '', 'g'), 3)
           ELSE regexp_replace(c.phone, '\D', '', 'g')
         END AS clave
  FROM "Customer" c
) t
WHERE clave ~ '^\d{9}$';

CREATE TEMP TABLE _cliente_fusion AS
SELECT k.id,
       k.clave,
       viejo.id AS superviviente,
       nuevo.name AS nombre,
       correo.email AS correo
FROM _cliente_clave k
JOIN (SELECT DISTINCT ON (clave) clave, id
        FROM _cliente_clave ORDER BY clave, "createdAt", id) viejo USING (clave)
JOIN (SELECT DISTINCT ON (clave) clave, name
        FROM _cliente_clave ORDER BY clave, "createdAt" DESC, id DESC) nuevo USING (clave)
LEFT JOIN (SELECT DISTINCT ON (clave) clave, email
             FROM _cliente_clave WHERE email IS NOT NULL
            ORDER BY clave, "createdAt" DESC, id DESC) correo USING (clave);

UPDATE "Booking" b
SET "customerId" = f.superviviente
FROM _cliente_fusion f
WHERE b."customerId" = f.id AND f.id <> f.superviviente;

UPDATE "Review" r
SET "customerId" = f.superviviente
FROM _cliente_fusion f
WHERE r."customerId" = f.id AND f.id <> f.superviviente;

DELETE FROM "Customer" c
USING _cliente_fusion f
WHERE c.id = f.id AND f.id <> f.superviviente;

UPDATE "Customer" c
SET phone = f.clave,
    name = f.nombre,
    email = COALESCE(f.correo, c.email)
FROM _cliente_fusion f
WHERE c.id = f.id AND f.id = f.superviviente;

DROP TABLE _cliente_fusion;
DROP TABLE _cliente_clave;
