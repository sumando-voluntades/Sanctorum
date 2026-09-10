-- Migración: agrega "Descripción" a los Eventos (Agenda -> Evento Operativo), como ya existe
-- "Contenido" en Publicaciones. Antes solo se capturaba el Título; ahora se puede detallar en
-- qué consiste la actividad (Taller, Jornada Muralista, etc.).
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a
-- ejecutarlo: IF NOT EXISTS evita error si la columna ya existe.

ALTER TABLE Eventos
    ADD COLUMN IF NOT EXISTS descripcion TEXT;
