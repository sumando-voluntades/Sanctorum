-- ==========================================================================
-- Migración: Eventos.id_responsable -- quién es la persona responsable de
-- un evento operativo.
--
-- Antes, un evento solo guardaba el equipo asignado en Participacion (sin
-- distinguir quién era "el responsable" de quién era "un voluntario más"
-- del equipo) -- no había forma de saber quién lo creó o quién está a
-- cargo. Esto se necesita para que un Coordinador deje de ver, en su
-- Agenda, los eventos operativos a cargo de OTRO Coordinador (sí sigue
-- viendo los de especialistas, voluntarios, los propios, y los que no
-- tengan responsable capturado).
--
-- Los eventos ya existentes quedan con id_responsable en NULL -- el
-- sistema los trata como visibles para todos los Coordinadores (igual que
-- hoy), ya que no hay forma de saber retroactivamente quién estaba a
-- cargo. Solo los eventos operativos creados DESPUÉS de esta migración
-- guardan su responsable y aplican el nuevo filtro.
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro
-- volver a ejecutarlo.
-- ==========================================================================

ALTER TABLE Eventos
    ADD COLUMN IF NOT EXISTS id_responsable INT REFERENCES Usuarios(id_usuario) ON DELETE SET NULL;
