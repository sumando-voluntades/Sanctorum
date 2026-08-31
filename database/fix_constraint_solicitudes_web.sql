-- ============================================================
-- Arreglo: la tabla Solicitudes_Web tiene una restricción CHECK que
-- solo permitía tipo_solicitud = 'Ayuda Psicológica' (el único valor
-- que se había usado hasta ahora). Ni el Diccionario de Datos ni yo
-- podíamos ver esta restricción sin conectarnos directamente a tu
-- base de datos (no tengo acceso de red hasta Supabase desde aquí),
-- así que el error solo apareció al probarlo en tu máquina.
--
-- Cómo correrlo: entra a tu proyecto en supabase.com → SQL Editor →
-- pega todo este script → Run. Es seguro correrlo tal cual.
-- ============================================================

-- 1. Antes de cambiar nada: mira las restricciones que existen hoy en
--    la tabla (para que veas exactamente qué se va a reemplazar).
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'solicitudes_web'::regclass;

-- 2. Permite los 2 tipos de solicitud nuevos (Donación en Especie y
--    Compartir Historia de Éxito), además del que ya funcionaba.
ALTER TABLE solicitudes_web DROP CONSTRAINT IF EXISTS solicitudes_web_tipo_solicitud_check;
ALTER TABLE solicitudes_web ADD CONSTRAINT solicitudes_web_tipo_solicitud_check
  CHECK (tipo_solicitud IN ('Ayuda Psicológica', 'Donación en Especie', 'Compartir Historia de Éxito'));

-- 3. Es muy probable que exista una restricción parecida sobre "estatus"
--    (hasta ahora solo se había insertado 'Pendiente' — nunca existía
--    una ruta que lo cambiara). Esta la actualiza también, por
--    adelantado, para que "Marcar Atendida" / "Descartar" en Perfil no
--    te dé el mismo error después. Si esa restricción no existe con
--    este nombre exacto, el DROP simplemente no hace nada (no falla).
ALTER TABLE solicitudes_web DROP CONSTRAINT IF EXISTS solicitudes_web_estatus_check;
ALTER TABLE solicitudes_web ADD CONSTRAINT solicitudes_web_estatus_check
  CHECK (estatus IN ('Pendiente', 'Atendida', 'Descartada'));

-- 4. Verificación final: confirma que las dos restricciones quedaron
--    como se espera.
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'solicitudes_web'::regclass;
