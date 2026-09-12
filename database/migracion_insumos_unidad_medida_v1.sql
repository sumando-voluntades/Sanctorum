-- Migración: agrega 'Unidad' a la lista de valores permitidos en Insumos.unidad_medida.
--
-- El Manual_de_Captura_y_Mantenimiento_de_Datos.docx (sección 6) siempre le ha dicho al
-- personal que "Unidad" es una opción válida de unidad de medida, junto con Litros, Kilos,
-- Piezas y Paquetes. Pero el CHECK real en producción solo permite esas primeras 4 -- así que
-- cualquier intento de guardar un insumo con unidad_medida = 'Unidad' es rechazado por Postgres
-- con un error, aunque el manual le diga al personal que es correcto. Esta migración corrige la
-- base de datos para que coincida con lo que el manual ya documenta (en vez de al revés).
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a ejecutarlo:
-- DROP CONSTRAINT IF EXISTS evita error si ya se corrió antes.
--
-- Nota: el nombre del constraint (insumos_unidad_medida_check) es el que Postgres asigna por
-- default a un CHECK inline sin nombre explícito. Si tu base de datos tiene un nombre distinto,
-- revísalo primero con: SELECT conname FROM pg_constraint WHERE conrelid = 'insumos'::regclass;

ALTER TABLE Insumos DROP CONSTRAINT IF EXISTS insumos_unidad_medida_check;

ALTER TABLE Insumos ADD CONSTRAINT insumos_unidad_medida_check
    CHECK (unidad_medida IN ('Litros', 'Kilos', 'Piezas', 'Paquetes', 'Unidad'));
