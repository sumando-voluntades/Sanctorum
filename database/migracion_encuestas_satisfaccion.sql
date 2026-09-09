-- ==========================================================================
-- Migración: Encuestas de Satisfacción (RF-15)
-- Ejecutar una sola vez en el SQL Editor de Supabase antes de usar esta
-- funcionalidad. Requerida por los nuevos endpoints /api/encuestas/:token
-- y por la sección de Documentos del expediente clínico en server.js.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS Encuestas_Satisfaccion (
    id_encuesta      SERIAL PRIMARY KEY,
    id_beneficiario  INT NOT NULL REFERENCES Beneficiarios(id_beneficiario) ON DELETE CASCADE,
    id_especialista  INT REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
    token            VARCHAR(64) NOT NULL UNIQUE,
    calificacion     INT CHECK (calificacion BETWEEN 1 AND 5),
    comentarios      TEXT,
    fecha_envio      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta  TIMESTAMP,
    respondida       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_encuestas_token ON Encuestas_Satisfaccion(token);
CREATE INDEX IF NOT EXISTS idx_encuestas_beneficiario ON Encuestas_Satisfaccion(id_beneficiario);

-- Notas:
--   * El token se genera en el servidor (crypto.randomBytes) — no depende de
--     ninguna extensión de Postgres (no requiere pgcrypto ni uuid-ossp).
--   * Mientras esta tabla no exista, el resto del sistema sigue funcionando
--     con normalidad: el código está escrito para no fallar si falta
--     (solo no manda la encuesta ni la muestra en Documentos).
