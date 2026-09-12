-- ==========================================================================
-- Migración v2: Ampliación de la Encuesta de Satisfacción (RF-15)
-- Ejecutar una sola vez en el SQL Editor de Supabase. Es seguro correrla
-- aunque la tabla Encuestas_Satisfaccion ya tenga respuestas guardadas:
-- solo agrega columnas nuevas (todas opcionales para las respuestas viejas,
-- que quedan en NULL) y no borra ni modifica nada existente.
-- ==========================================================================

ALTER TABLE Encuestas_Satisfaccion
    ADD COLUMN IF NOT EXISTS calificacion_especialista INT CHECK (calificacion_especialista BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS calificacion_puntualidad  INT CHECK (calificacion_puntualidad BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS utilidad_sesion            VARCHAR(20) CHECK (utilidad_sesion IN ('Si', 'Parcialmente', 'No')),
    ADD COLUMN IF NOT EXISTS probabilidad_recomendar    INT CHECK (probabilidad_recomendar BETWEEN 0 AND 10),
    ADD COLUMN IF NOT EXISTS revisada                   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fecha_revision             TIMESTAMP,
    ADD COLUMN IF NOT EXISTS id_usuario_revisor          INT REFERENCES Usuarios(id_usuario) ON DELETE SET NULL;

-- Las respuestas insatisfactorias (calificación general 1-2) que ya existan de antes de
-- esta migración se marcan como pendientes de revisar por defecto (revisada = FALSE),
-- para que no se pierdan del radar de coordinadores/administradores.

CREATE INDEX IF NOT EXISTS idx_encuestas_revisada ON Encuestas_Satisfaccion(revisada) WHERE revisada = FALSE;

-- Notas:
--   * utilidad_sesion usa 'Si' sin acento a propósito, para evitar problemas de
--     codificación al comparar strings en distintos clientes/drivers.
--   * Todas las columnas nuevas son opcionales (nullable) a nivel de base de datos;
--     el frontend las pide como obligatorias en el formulario de la encuesta, pero
--     el backend no truena si llegan vacías (defensivo, igual que el resto del sistema).
