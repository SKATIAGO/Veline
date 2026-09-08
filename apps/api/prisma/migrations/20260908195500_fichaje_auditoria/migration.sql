-- Corregir un fichaje queda en el registro de actividad: es la única acción
-- del fichaje que cambia lo ya grabado, así que es la que hay que poder mirar.
ALTER TYPE "AuditAction" ADD VALUE 'FICHAJE_CORREGIDO';
