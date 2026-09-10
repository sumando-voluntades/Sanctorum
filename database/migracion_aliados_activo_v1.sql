-- Migración: agrega la opción de "Archivar" (en vez de eliminar) a los Aliados
-- (Contactos_Externos), mismo patrón ya usado para Escuelas en
-- migracion_escuelas_y_donativos_v1.sql. Un aliado archivado conserva su historial de
-- donativos (evita el error 409 al intentar eliminar uno que ya tiene donativos ligados)
-- pero deja de ofrecerse como opción activa al capturar un donativo nuevo.
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a
-- ejecutarlo: IF NOT EXISTS evita error si la columna ya existe.

ALTER TABLE Contactos_Externos
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
