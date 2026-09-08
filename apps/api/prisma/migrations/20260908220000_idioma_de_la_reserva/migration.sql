-- El idioma en el que reservó el cliente, para poder escribirle en el suyo.
--
-- Por defecto ES: las reservas que ya existen se hicieron en castellano, así
-- que ese es su valor correcto, no un relleno.
CREATE TYPE "Idioma" AS ENUM ('ES', 'EN');

ALTER TABLE "Booking" ADD COLUMN "idioma" "Idioma" NOT NULL DEFAULT 'ES';
