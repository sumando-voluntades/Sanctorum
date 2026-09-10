-- ==========================================================================
-- Migración: adjuntos (fotos, video, documentos) en Reportes de Evento.
--
-- Reportes_Evento no tenía ninguna columna para guardar evidencia del
-- evento (fotos, video, documentos como listas de asistencia firmadas,
-- etc.) -- solo texto (actividades_realizadas, materiales_utilizados,
-- observaciones). Se agrega una columna de tipo arreglo de texto que
-- guarda las URLs de Cloudinary de cada archivo subido, siguiendo el mismo
-- patrón que ya usa Publicaciones para imágenes/video/documento de
-- consentimiento (subida sin firmar desde el navegador, el backend solo
-- guarda y valida la URL resultante).
--
-- Ejecuta este archivo una sola vez en Supabase (SQL Editor). Es seguro
-- volver a ejecutarlo.
-- ==========================================================================

ALTER TABLE Reportes_Evento
    ADD COLUMN IF NOT EXISTS url_adjuntos TEXT[] NOT NULL DEFAULT '{}';

-- Nota: los reportes ya existentes quedan con un arreglo vacío (sin
-- adjuntos), lo cual es correcto -- no había forma de subir archivos antes
-- de esta migración.
