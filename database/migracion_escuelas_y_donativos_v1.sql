-- ==========================================================================
-- Migración v1: Escuelas archivables + trazabilidad de quién registra
-- un donativo (RF-16 / RF-17). Ejecutar una sola vez en el SQL Editor de
-- Supabase. Es segura de correr aunque ya haya escuelas y donativos
-- guardados: solo agrega columnas nuevas (con default), no borra ni
-- modifica nada existente.
-- ==========================================================================

-- Escuelas: en vez de poder eliminarse (rompería el historial de visitas,
-- eventos y beneficiarios ligados a ellas), ahora se pueden "archivar" —
-- deja de aparecer en el directorio activo, pero conserva todo su historial
-- y se puede reactivar después. Todas las escuelas existentes quedan
-- activas por default.
ALTER TABLE Escuelas
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Donaciones: registra qué usuario (Admin/Coordinador) capturó cada
-- donativo, para mostrarlo en la columna "Registrado por" de Aliados y
-- Donativos. Los donativos ya existentes quedan con esta columna en NULL
-- (no hay forma de saber retroactivamente quién los registró).
ALTER TABLE Donaciones
    ADD COLUMN IF NOT EXISTS id_usuario_registro INT REFERENCES Usuarios(id_usuario) ON DELETE SET NULL;

-- Notas:
--   * El backend (server.js) ya está escrito para degradar sin tronar si
--     estas columnas todavía no existen (intenta con ellas primero y cae a
--     una versión sin ellas si falla) — pero conviene correr esta migración
--     pronto para tener el directorio de Escuelas y la trazabilidad de
--     Donativos completos.
--   * activo usa DEFAULT TRUE, así que ninguna escuela existente se oculta
--     al correr esto.
