-- Migración: separa Usuarios.cantidad_donada (texto compuesto "<cantidad> <unidad>", p. ej.
-- "25 Lt") en dos columnas reales: cantidad_donada_valor NUMERIC(12,2) y cantidad_donada_unidad
-- VARCHAR(20).
--
-- Por qué: este campo NO es un monto simple -- guarda cantidad y unidad pegadas en un solo
-- string. El propio formulario "Modificar Perfil" del panel ya las maneja como dos inputs
-- separados (Cant. / Unidad) y las junta con un espacio justo antes de mandarlas al backend
-- (ver extraerCantidad() en voluntariado.html) -- eso es exactamente lo que 1FN prohíbe: un solo
-- campo debe guardar un solo valor atómico, no dos combinados con un separador implícito.
--
-- Qué NO hace esta migración: no borra ni toca Usuarios.cantidad_donada (columna de texto). Se
-- queda igual, y server.js la sigue escribiendo en cada guardado como caché de compatibilidad --
-- las dos columnas nuevas son ahora la fuente de verdad con el tipo correcto (NUMERIC de verdad,
-- se puede sumar/ordenar/comparar sin convertir), pero nada del frontend necesitó cambiar: el
-- backend sigue aceptando el mismo texto compuesto que ya mandaba el panel y lo separa él mismo
-- al guardar (ver parsearCantidadDonada() en server.js).
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro volver a ejecutarlo:
-- ADD COLUMN IF NOT EXISTS evita error si ya se corrió antes, y el UPDATE de backfill solo toca
-- filas que todavía no tienen cantidad_donada_valor.

ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS cantidad_donada_valor NUMERIC(12,2);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS cantidad_donada_unidad VARCHAR(20);

-- Restringe la unidad a las 3 opciones que ya ofrece el <select> del panel (Lt/Kg/Pz), permitiendo
-- NULL para quien no sea Donador. DROP + ADD para que sea seguro volver a correr este archivo.
ALTER TABLE Usuarios DROP CONSTRAINT IF EXISTS usuarios_cantidad_donada_unidad_check;
ALTER TABLE Usuarios ADD CONSTRAINT usuarios_cantidad_donada_unidad_check
    CHECK (cantidad_donada_unidad IS NULL OR cantidad_donada_unidad IN ('Lt', 'Kg', 'Pz'));

-- Backfill: separa lo que ya existe en el texto compuesto. Solo convierte filas donde la primera
-- "palabra" es reconociblemente un número -- cualquier fila con texto raro (que no siga el
-- formato "<numero> <unidad>") se queda con cantidad_donada_valor en NULL para revisar a mano,
-- SIN perder el texto original (sigue intacto en Usuarios.cantidad_donada).
UPDATE Usuarios SET
    cantidad_donada_valor = NULLIF(split_part(btrim(cantidad_donada), ' ', 1), '')::NUMERIC(12,2),
    cantidad_donada_unidad = NULLIF(split_part(btrim(cantidad_donada), ' ', 2), '')
WHERE cantidad_donada IS NOT NULL
  AND btrim(cantidad_donada) <> ''
  AND cantidad_donada_valor IS NULL
  AND split_part(btrim(cantidad_donada), ' ', 1) ~ '^-?\d+(\.\d+)?$';

-- Verificación (opcional, corre esto después): filas con texto pero que no se pudieron separar --
-- son las que hay que revisar/corregir a mano.
-- SELECT id_usuario, nombre_completo, cantidad_donada FROM Usuarios
--  WHERE cantidad_donada IS NOT NULL AND btrim(cantidad_donada) <> '' AND cantidad_donada_valor IS NULL;
