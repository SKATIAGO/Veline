-- Varias fotos por servicio y por extra: antes una sola (photo), ahora una
-- lista (photos) cuya primera foto es la principal.
ALTER TABLE "Service" ADD COLUMN "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Extra" ADD COLUMN "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- La foto que ya hubiera pasa a ser la primera (y única) de la lista.
UPDATE "Service" SET "photos" = ARRAY["photo"] WHERE "photo" IS NOT NULL;
UPDATE "Extra" SET "photos" = ARRAY["photo"] WHERE "photo" IS NOT NULL;

ALTER TABLE "Service" DROP COLUMN "photo";
ALTER TABLE "Extra" DROP COLUMN "photo";
