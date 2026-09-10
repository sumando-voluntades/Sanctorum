-- Migración: agrega "Video" a las Publicaciones (Avisos/Eventos/Otro), como opción adicional
-- a la fotografía de portada. Se guarda la URL de Cloudinary del video (subido igual que una
-- imagen, Cloudinary detecta el tipo de archivo automáticamente con "resource_type=auto").
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a
-- ejecutarlo: IF NOT EXISTS evita error si la columna ya existe.

ALTER TABLE Publicaciones
    ADD COLUMN IF NOT EXISTS url_video TEXT;
