-- Migración: normaliza las categorías de Publicaciones y Eventos con tablas de unión reales
-- (Publicaciones_Categorias / Eventos_Categorias), en vez de una lista separada por comas guardada
-- como texto libre en Publicaciones.categoria / Eventos.categoria.
--
-- Por qué: guardar "Infancia, Cultura de Paz, Muralismo" como un solo TEXT viola 1FN (un campo,
-- varios valores atómicos) y tiene los problemas clásicos de eso: no hay integridad referencial
-- real contra Categorias (se puede guardar un nombre que no exista, o que ya no exista si se borra
-- de Categorias), filtrar por categoría exacta requiere buscar substrings (el filtro anterior de
-- /api/publicaciones?categoria=X usaba ILIKE '%X%', lo que puede dar falsos positivos con nombres
-- que se contienen entre sí), y si algún día se renombra una categoría el texto viejo en cada
-- publicación/evento queda desactualizado para siempre.
--
-- Qué NO hace esta migración: no borra ni renombra la columna Publicaciones.categoria /
-- Eventos.categoria. Se queda tal cual, y el backend (server.js) la sigue escribiendo en cada
-- guardado -- ahora es solo una caché de lectura rápida en sincronía con las tablas de unión (útil
-- como respaldo/rollback, y porque datos_demo_sanctorum.sql la usa directamente al sembrar datos
-- de prueba). Las consultas de la API ahora leen y filtran desde las tablas de unión, que son la
-- fuente real de verdad.
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor), DESPUÉS de haber actualizado
-- server.js con la lógica de sincronización (o antes está bien también: las tablas quedan vacías
-- hasta el primer guardado de cada publicación/evento existente, y este script hace el backfill
-- inicial de lo que ya existe). Es seguro volver a ejecutarlo completo: todos los pasos usan
-- IF NOT EXISTS / ON CONFLICT.

-- 1. Tablas de unión.
CREATE TABLE IF NOT EXISTS Publicaciones_Categorias (
    id_publicacion INTEGER NOT NULL REFERENCES Publicaciones(id_publicacion) ON DELETE CASCADE,
    id_categoria   INTEGER NOT NULL REFERENCES Categorias(id_categoria) ON DELETE CASCADE,
    PRIMARY KEY (id_publicacion, id_categoria)
);
CREATE INDEX IF NOT EXISTS idx_publicaciones_categorias_id_categoria
    ON Publicaciones_Categorias(id_categoria);

CREATE TABLE IF NOT EXISTS Eventos_Categorias (
    id_evento    INTEGER NOT NULL REFERENCES Eventos(id_evento) ON DELETE CASCADE,
    id_categoria INTEGER NOT NULL REFERENCES Categorias(id_categoria) ON DELETE CASCADE,
    PRIMARY KEY (id_evento, id_categoria)
);
CREATE INDEX IF NOT EXISTS idx_eventos_categorias_id_categoria
    ON Eventos_Categorias(id_categoria);

-- 2. Asegura que toda categoría mencionada en el texto histórico exista en el catálogo Categorias
--    (por si alguna publicación/evento tiene una categoría que nunca pasó por registrarCategorias,
--    p. ej. datos sembrados directamente por datos_demo_sanctorum.sql).
INSERT INTO Categorias (nombre_categoria)
SELECT DISTINCT btrim(nombre)
FROM Publicaciones, unnest(string_to_array(categoria, ',')) AS nombre
WHERE categoria IS NOT NULL AND btrim(nombre) <> ''
ON CONFLICT (nombre_categoria) DO NOTHING;

INSERT INTO Categorias (nombre_categoria)
SELECT DISTINCT btrim(nombre)
FROM Eventos, unnest(string_to_array(categoria, ',')) AS nombre
WHERE categoria IS NOT NULL AND btrim(nombre) <> ''
ON CONFLICT (nombre_categoria) DO NOTHING;

-- 3. Backfill: vincula cada publicación/evento existente con sus categorías reales.
INSERT INTO Publicaciones_Categorias (id_publicacion, id_categoria)
SELECT DISTINCT p.id_publicacion, c.id_categoria
FROM Publicaciones p, unnest(string_to_array(p.categoria, ',')) AS nombre
JOIN Categorias c ON c.nombre_categoria = btrim(nombre)
WHERE p.categoria IS NOT NULL AND btrim(nombre) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO Eventos_Categorias (id_evento, id_categoria)
SELECT DISTINCT e.id_evento, c.id_categoria
FROM Eventos e, unnest(string_to_array(e.categoria, ',')) AS nombre
JOIN Categorias c ON c.nombre_categoria = btrim(nombre)
WHERE e.categoria IS NOT NULL AND btrim(nombre) <> ''
ON CONFLICT DO NOTHING;

-- 4. Verificación rápida (opcional, corre esto después para comparar conteos):
-- SELECT
--   (SELECT count(*) FROM Publicaciones WHERE categoria IS NOT NULL AND btrim(categoria) <> '') AS publicaciones_con_texto,
--   (SELECT count(DISTINCT id_publicacion) FROM Publicaciones_Categorias) AS publicaciones_con_vinculo,
--   (SELECT count(*) FROM Eventos WHERE categoria IS NOT NULL AND btrim(categoria) <> '') AS eventos_con_texto,
--   (SELECT count(DISTINCT id_evento) FROM Eventos_Categorias) AS eventos_con_vinculo;
