-- Migración: catálogo persistente de Categorías para Publicaciones.
--
-- Antes, las categorías vivían solo como texto suelto dentro de Publicaciones.categoria
-- (una lista separada por comas). Las 5 "conocidas" estaban hardcodeadas en el HTML y
-- cualquier categoría escrita en el campo "Otro" nunca se guardaba en ningún catálogo:
-- se perdía la reutilización y el autocompletado no tenía de dónde sugerir.
--
-- Esta migración crea la tabla Categorias y la siembra con las 5 categorías que ya
-- existían hardcodeadas, para no perder continuidad con publicaciones ya creadas.
-- El backend (server.js) ahora registra automáticamente cualquier categoría nueva
-- que llegue en una publicación (alta o edición) mediante un "get or create".
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a
-- ejecutarlo: IF NOT EXISTS / ON CONFLICT evitan error si ya se corrió antes.

CREATE TABLE IF NOT EXISTS Categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Categorias (nombre_categoria) VALUES
    ('Infancia'),
    ('Adolescencia'),
    ('Consejos para padres'),
    ('Cultura de Paz'),
    ('Muralismo')
ON CONFLICT (nombre_categoria) DO NOTHING;
