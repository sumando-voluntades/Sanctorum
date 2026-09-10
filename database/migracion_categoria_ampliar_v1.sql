-- Migración: amplía Publicaciones.categoria de VARCHAR(50) a TEXT (sin límite).
--
-- Ese límite de 50 caracteres ya venía desde el esquema original, cuando "categoria"
-- guardaba como mucho un par de palabras. Ahora que el selector de categorías (ver
-- migracion_categorias_v1.sql) deja elegir varias como una lista separada por comas
-- ("Cultura de Paz, Talento, Identidad, ..."), es muy fácil superar los 50 caracteres al
-- marcar 3 o más categorías -- eso es justo lo que provoca el error de Postgres
-- "value too long for type character varying(50)" al guardar una publicación.
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a
-- ejecutarlo: ALTER COLUMN TYPE de TEXT a TEXT no hace nada la segunda vez.

ALTER TABLE Publicaciones
    ALTER COLUMN categoria TYPE TEXT;
