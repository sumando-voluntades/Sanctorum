-- Migración: agrega "Categoría" a los Eventos (Agenda -> Evento Operativo), reutilizando el
-- mismo catálogo de Categorías que ya usan las Publicaciones (ver migracion_categorias_v1.sql).
-- Se guarda como TEXT desde el inicio (no VARCHAR(50)) porque un evento puede tener varias
-- categorías juntas separadas por coma, igual que una publicación, y ese límite de 50
-- caracteres fue justo lo que rompió el guardado de categorías en Publicaciones
-- (ver migracion_categoria_ampliar_v1.sql).
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a
-- ejecutarlo: IF NOT EXISTS evita error si la columna ya existe.

ALTER TABLE Eventos
    ADD COLUMN IF NOT EXISTS categoria TEXT;
