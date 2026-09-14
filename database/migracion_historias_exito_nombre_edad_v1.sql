-- Migración: Historias de Éxito ya no se vinculan obligatoriamente a un registro de
-- Beneficiarios. Esa gestión (dar de alta un beneficiario nuevo) se retiró del código junto
-- con Expedientes, así que el <select> de "Beneficiario" en Nueva Publicación > Historia de
-- Éxito solo podía ofrecer el mismo conjunto congelado de siempre — no había forma de ligar
-- una historia nueva a alguien que no estuviera ya en esa tabla.
--
-- Esta migración agrega dos columnas libres (nombre_beneficiario, edad_beneficiario) para que
-- el staff escriba directamente el nombre/alias y la edad al publicar una historia nueva, y
-- vuelve opcional el vínculo antiguo (id_beneficiario) — las historias ya publicadas conservan
-- su vínculo tal cual, sin cambios.
--
-- Ejecutar una sola vez en la base de datos de Supabase (SQL Editor) antes de desplegar el
-- código nuevo de server.js / publicaciones.html: si se despliega el código sin correr esto
-- primero, las consultas a Historias_Exito que mencionan nombre_beneficiario/edad_beneficiario
-- fallarán porque esas columnas todavía no existen.

ALTER TABLE Historias_Exito
    ALTER COLUMN id_beneficiario DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS nombre_beneficiario VARCHAR(150),
    ADD COLUMN IF NOT EXISTS edad_beneficiario INTEGER;
