-- ==========================================================================
-- Migración: categoria_gasto de Donaciones deja de estar limitada a solo
-- 3 valores fijos (Especialistas, Insumos, Operación).
--
-- El formulario de Donativos (aliados_donativos.html) ya tenía desde antes
-- la opción "Otro" con un campo de texto libre para capturar una categoría
-- distinta -- pero el CHECK constraint de la base de datos la rechazaba al
-- guardar (error de Postgres "violates check constraint
-- donaciones_categoria_gasto_check"), así que en la práctica esa opción
-- nunca funcionaba.
--
-- La gráfica pública de transparencia (/api/transparencia) ya agrupa por
-- categoria_gasto de forma dinámica (GROUP BY, sin lista fija) y el
-- front-end (public/index.html) ya sabe pintar cualquier categoría que no
-- reconozca con un color gris genérico -- por lo que quitar el candado a
-- nivel de base de datos es suficiente para que un donativo etiquetado con
-- una categoría nueva (por ejemplo, si se destina a otra área del proyecto)
-- se vea reflejado también en esa gráfica.
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro
-- volver a ejecutarlo.
-- ==========================================================================

DO $$
DECLARE
    nombre_constraint text;
BEGIN
    SELECT con.conname INTO nombre_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'donaciones'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%categoria_gasto%';

    IF nombre_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE Donaciones DROP CONSTRAINT %I', nombre_constraint);
    END IF;
END $$;

-- Nota: "Especialistas", "Insumos" y "Operación" siguen siendo las 3
-- categorías recomendadas/oficiales para uso normal (así lo sigue diciendo
-- el manual), pero ahora el sistema no impide capturar una categoría
-- adicional cuando de verdad se necesite -- la transparencia es más
-- importante que forzar el donativo a encajar en una de las 3.
