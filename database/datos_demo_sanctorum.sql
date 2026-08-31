-- ============================================================
-- Datos de ejemplo (demo) — Plataforma Sanctorum A.C.
-- ============================================================
-- Qué hace este script:
--   Llena Escuelas, Beneficiarios, Expedientes_Notas, Historias_Exito,
--   Insumos, Eventos, Publicaciones y Agenda_Visitas con información
--   realista para que puedas ver cómo luce la plataforma con contenido.
--
-- Por qué está escrito así (importante):
--   NO asume que los IDs libres son 1,2,3... porque tu base de datos
--   ya tiene registros reales (ej. el beneficiario "juan perez" con
--   ID 7). En vez de eso, cada INSERT busca sus relaciones (escuela,
--   especialista, etc.) por NOMBRE con una subconsulta, así que no
--   importa qué IDs ya existan: nunca va a chocar ni sobreescribir
--   nada tuyo.
--
--   También es "re-ejecutable": cada bloque revisa primero con
--   WHERE NOT EXISTS si ese registro de ejemplo ya se insertó, así
--   que si corres el script dos veces por error, no duplica los datos.
--
--   Nota sobre "Noticias_Eventos": esa tabla ya no existe, se renombró
--   a "Publicaciones" en la migración de la ronda 6 — este script ya
--   usa el nombre y las columnas actuales de Publicaciones.
--
-- Requisito: que ya exista al menos 1 usuario con rol Especialista (2),
-- Coordinador (3) o Admin (1) en tu tabla Usuarios (para poder asignar
-- autores/especialistas de forma automática). Si tu plataforma ya
-- tiene gente registrada (Admin, Alfonso Castro, etc.) esto ya se
-- cumple.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ESCUELAS
-- ------------------------------------------------------------
INSERT INTO Escuelas (nombre_escuela, contacto_nombre, puesto_contacto, telefono_escuela, ubicacion)
SELECT 'Primaria Benito Juárez', 'Rocío Hernández Salas', 'Directora', '2221345678', 'Col. La Libertad, Puebla, Pue.'
WHERE NOT EXISTS (SELECT 1 FROM Escuelas WHERE nombre_escuela = 'Primaria Benito Juárez');

INSERT INTO Escuelas (nombre_escuela, contacto_nombre, puesto_contacto, telefono_escuela, ubicacion)
SELECT 'Telesecundaria Miguel Hidalgo', 'Jorge Ramírez Cuevas', 'Subdirector', '2224567890', 'Col. Xilotzingo, Puebla, Pue.'
WHERE NOT EXISTS (SELECT 1 FROM Escuelas WHERE nombre_escuela = 'Telesecundaria Miguel Hidalgo');

INSERT INTO Escuelas (nombre_escuela, contacto_nombre, puesto_contacto, telefono_escuela, ubicacion)
SELECT 'Jardín de Niños Amado Nervo', 'Leticia Morales Vega', 'Directora', '2223456781', 'Col. San Baltazar Campeche, Puebla, Pue.'
WHERE NOT EXISTS (SELECT 1 FROM Escuelas WHERE nombre_escuela = 'Jardín de Niños Amado Nervo');


-- ------------------------------------------------------------
-- 2. BENEFICIARIOS
--    id_escuela e id_especialista se resuelven por subconsulta,
--    nunca por número fijo.
-- ------------------------------------------------------------
INSERT INTO Beneficiarios (nombre_completo, fecha_nacimiento, genero, colonia_puebla, nombre_tutor, telefono_tutor, correo_tutor, id_escuela, id_especialista, estatus, fecha_registro)
SELECT 'María Fernanda López Torres', '2015-03-12', 'Femenino', 'La Libertad',
       'Guadalupe Torres Rivas', '2221112233', 'guadalupe.torres@example.com',
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Primaria Benito Juárez'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'ACTIVO', CURRENT_TIMESTAMP - INTERVAL '120 days'
WHERE NOT EXISTS (SELECT 1 FROM Beneficiarios WHERE nombre_completo = 'María Fernanda López Torres');

INSERT INTO Beneficiarios (nombre_completo, fecha_nacimiento, genero, colonia_puebla, nombre_tutor, telefono_tutor, correo_tutor, id_escuela, id_especialista, estatus, fecha_registro)
SELECT 'Diego Alexander Martínez Cruz', '2013-08-05', 'Masculino', 'Xilotzingo',
       'Araceli Cruz Domínguez', '2222223344', 'araceli.cruz@example.com',
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Telesecundaria Miguel Hidalgo'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'ACTIVO', CURRENT_TIMESTAMP - INTERVAL '95 days'
WHERE NOT EXISTS (SELECT 1 FROM Beneficiarios WHERE nombre_completo = 'Diego Alexander Martínez Cruz');

INSERT INTO Beneficiarios (nombre_completo, fecha_nacimiento, genero, colonia_puebla, nombre_tutor, telefono_tutor, correo_tutor, id_escuela, id_especialista, estatus, fecha_registro)
SELECT 'Sofía Ximena Ramírez Ortiz', '2017-11-20', 'Femenino', 'San Baltazar Campeche',
       'Miriam Ortiz Sánchez', '2223334455', 'miriam.ortiz@example.com',
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Jardín de Niños Amado Nervo'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'ACTIVO', CURRENT_TIMESTAMP - INTERVAL '60 days'
WHERE NOT EXISTS (SELECT 1 FROM Beneficiarios WHERE nombre_completo = 'Sofía Ximena Ramírez Ortiz');

INSERT INTO Beneficiarios (nombre_completo, fecha_nacimiento, genero, colonia_puebla, nombre_tutor, telefono_tutor, correo_tutor, id_escuela, id_especialista, estatus, fecha_registro)
SELECT 'Emiliano Torres Bautista', '2012-01-30', 'Masculino', 'La Libertad',
       'Rosa Isela Bautista León', '2224445566', 'rosa.bautista@example.com',
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Primaria Benito Juárez'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'ALTA', CURRENT_TIMESTAMP - INTERVAL '400 days'
WHERE NOT EXISTS (SELECT 1 FROM Beneficiarios WHERE nombre_completo = 'Emiliano Torres Bautista');

INSERT INTO Beneficiarios (nombre_completo, fecha_nacimiento, genero, colonia_puebla, nombre_tutor, telefono_tutor, correo_tutor, id_escuela, id_especialista, estatus, fecha_registro)
SELECT 'Valentina Hernández Reyes', '2016-06-18', 'Femenino', 'Xilotzingo',
       'Patricia Reyes Molina', '2225556677', 'patricia.reyes@example.com',
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Telesecundaria Miguel Hidalgo'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'ACTIVO', CURRENT_TIMESTAMP - INTERVAL '30 days'
WHERE NOT EXISTS (SELECT 1 FROM Beneficiarios WHERE nombre_completo = 'Valentina Hernández Reyes');


-- ------------------------------------------------------------
-- 3. EXPEDIENTES_NOTAS
--    (dos notas de seguimiento para dos beneficiarios distintos)
-- ------------------------------------------------------------
INSERT INTO Expedientes_Notas (id_beneficiario, id_especialista, contenido_nota, tipo_intervencion, tipo_sesion, modalidad, nivel_riesgo, asistencia)
SELECT (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'María Fernanda López Torres'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'Sesión de seguimiento inicial. La menor muestra buena disposición y participación activa. Se observa apoyo constante por parte de la madre de familia. Se recomienda continuar con sesiones quincenales.',
       'Seguimiento', 'Ordinaria', 'Presencial', 'Bajo', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM Expedientes_Notas
    WHERE id_beneficiario = (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'María Fernanda López Torres')
      AND contenido_nota LIKE 'Sesión de seguimiento inicial%'
);

INSERT INTO Expedientes_Notas (id_beneficiario, id_especialista, contenido_nota, tipo_intervencion, tipo_sesion, modalidad, nivel_riesgo, asistencia)
SELECT (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'Diego Alexander Martínez Cruz'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'Primera evaluación diagnóstica del caso. Se identifican necesidades de reforzamiento académico en matemáticas. Se canaliza a taller de tareas dirigidas los sábados.',
       'Diagnóstico', 'Evaluación', 'Presencial', 'Medio', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM Expedientes_Notas
    WHERE id_beneficiario = (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'Diego Alexander Martínez Cruz')
      AND contenido_nota LIKE 'Primera evaluación diagnóstica%'
);

INSERT INTO Expedientes_Notas (id_beneficiario, id_especialista, contenido_nota, tipo_intervencion, tipo_sesion, modalidad, nivel_riesgo, asistencia)
SELECT (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'María Fernanda López Torres'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'Segunda sesión de seguimiento. Avance notable en confianza y expresión emocional. Se sugiere mantener el mismo plan de trabajo.',
       'Seguimiento', 'Ordinaria', 'En línea', 'Bajo', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM Expedientes_Notas
    WHERE id_beneficiario = (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'María Fernanda López Torres')
      AND contenido_nota LIKE 'Segunda sesión de seguimiento%'
);


-- ------------------------------------------------------------
-- 4. HISTORIAS_EXITO
--    url_documento_consentimiento queda como texto de ejemplo (NO es
--    un archivo real en Cloudinary); reemplázalo subiendo el
--    consentimiento real desde la plataforma cuando quieras publicarla
--    de verdad. Aquí solo es para poder ver la tarjeta en la interfaz.
-- ------------------------------------------------------------
INSERT INTO Historias_Exito (id_beneficiario, id_autor, titulo, contenido_preayuda, contenido_postayuda, consentimiento, url_documento_consentimiento, fecha_creacion)
SELECT (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'Emiliano Torres Bautista'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'De la mano de la comunidad: la historia de Emiliano',
       'Emiliano llegó a Sanctorum con rezago escolar importante y baja autoestima, producto de una situación familiar complicada. Su asistencia a la escuela era irregular.',
       'Después de un año de acompañamiento psicológico y tutorías académicas, Emiliano regularizó su año escolar, mejoró su promedio y hoy participa como monitor de tareas dirigidas con otros niños de su comunidad.',
       TRUE, 'https://res.cloudinary.com/demo/raw/upload/v1700000000/consentimientos/ejemplo_emiliano.pdf',
       CURRENT_TIMESTAMP - INTERVAL '200 days'
WHERE NOT EXISTS (SELECT 1 FROM Historias_Exito WHERE titulo = 'De la mano de la comunidad: la historia de Emiliano');

INSERT INTO Historias_Exito (id_beneficiario, id_autor, titulo, contenido_preayuda, contenido_postayuda, consentimiento, url_documento_consentimiento, fecha_creacion)
SELECT (SELECT id_beneficiario FROM Beneficiarios WHERE nombre_completo = 'Valentina Hernández Reyes'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol = 2 ORDER BY id_usuario LIMIT 1),
       'Valentina: aprender a confiar de nuevo',
       'Valentina mostraba conductas de aislamiento y dificultad para socializar con otros niños de su edad tras un evento familiar difícil.',
       'Gracias a las sesiones de intervención emocional y el trabajo conjunto con su madre, Valentina ahora participa activamente en las actividades grupales y ha recuperado la confianza en sí misma.',
       TRUE, 'https://res.cloudinary.com/demo/raw/upload/v1700000000/consentimientos/ejemplo_valentina.pdf',
       CURRENT_TIMESTAMP - INTERVAL '45 days'
WHERE NOT EXISTS (SELECT 1 FROM Historias_Exito WHERE titulo = 'Valentina: aprender a confiar de nuevo');


-- ------------------------------------------------------------
-- 5. INSUMOS
-- ------------------------------------------------------------
INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
SELECT 'Despensa básica (paquete)', 'Paquete', 40, 10, 250.00, 'Asistencia Social'
WHERE NOT EXISTS (SELECT 1 FROM Insumos WHERE nombre_insumo = 'Despensa básica (paquete)');

INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
SELECT 'Cuaderno profesional', 'Pieza', 150, 30, 18.50, 'Educación'
WHERE NOT EXISTS (SELECT 1 FROM Insumos WHERE nombre_insumo = 'Cuaderno profesional');

INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
SELECT 'Kit de higiene personal', 'Kit', 25, 5, 95.00, 'Salud'
WHERE NOT EXISTS (SELECT 1 FROM Insumos WHERE nombre_insumo = 'Kit de higiene personal');

INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
SELECT 'Playera institucional voluntariado', 'Pieza', 60, 15, 80.00, 'Voluntariado'
WHERE NOT EXISTS (SELECT 1 FROM Insumos WHERE nombre_insumo = 'Playera institucional voluntariado');

INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
SELECT 'Material didáctico (set)', 'Set', 20, 5, 120.00, 'Educación'
WHERE NOT EXISTS (SELECT 1 FROM Insumos WHERE nombre_insumo = 'Material didáctico (set)');

INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
SELECT 'Agua embotellada (caja 24pz)', 'Caja', 8, 4, 95.00, 'Logística'
WHERE NOT EXISTS (SELECT 1 FROM Insumos WHERE nombre_insumo = 'Agua embotellada (caja 24pz)');


-- ------------------------------------------------------------
-- 6. EVENTOS
--    Mezcla de eventos pasados y próximos para que el "Próximo
--    Evento" del inicio y el historial tengan contenido real.
-- ------------------------------------------------------------
INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion, modalidad, direccion_mapa, link_reunion, id_escuela, url_imagen)
SELECT 'Brigada de Salud Comunitaria', 'Brigada de Salud', CURRENT_DATE + INTERVAL '12 days', 'Presencial',
       'Explanada, Col. La Libertad, Puebla, Pue.', NULL,
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Primaria Benito Juárez'),
       'https://res.cloudinary.com/demo/image/upload/v1700000000/eventos/brigada_salud.jpg'
WHERE NOT EXISTS (SELECT 1 FROM Eventos WHERE titulo_evento = 'Brigada de Salud Comunitaria');

INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion, modalidad, direccion_mapa, link_reunion, id_escuela, url_imagen)
SELECT 'Taller de Tareas Dirigidas', 'Taller Educativo', CURRENT_DATE + INTERVAL '5 days', 'Presencial',
       'Telesecundaria Miguel Hidalgo, Col. Xilotzingo, Puebla, Pue.', NULL,
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Telesecundaria Miguel Hidalgo'),
       'https://res.cloudinary.com/demo/image/upload/v1700000000/eventos/taller_tareas.jpg'
WHERE NOT EXISTS (SELECT 1 FROM Eventos WHERE titulo_evento = 'Taller de Tareas Dirigidas');

INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion, modalidad, direccion_mapa, link_reunion, id_escuela, url_imagen)
SELECT 'Recolección de Despensas', 'Recolección de Donativos', CURRENT_DATE - INTERVAL '20 days', 'Presencial',
       'Oficinas Sanctorum A.C., Puebla, Pue.', NULL, NULL,
       'https://res.cloudinary.com/demo/image/upload/v1700000000/eventos/recoleccion_despensas.jpg'
WHERE NOT EXISTS (SELECT 1 FROM Eventos WHERE titulo_evento = 'Recolección de Despensas');

INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion, modalidad, direccion_mapa, link_reunion, id_escuela, url_imagen)
SELECT 'Capacitación a Padres de Familia', 'Capacitación', CURRENT_DATE - INTERVAL '35 days', 'En línea',
       NULL, 'https://meet.google.com/demo-enlace-ejemplo', NULL,
       'https://res.cloudinary.com/demo/image/upload/v1700000000/eventos/capacitacion_padres.jpg'
WHERE NOT EXISTS (SELECT 1 FROM Eventos WHERE titulo_evento = 'Capacitación a Padres de Familia');

INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion, modalidad, direccion_mapa, link_reunion, id_escuela, url_imagen)
SELECT 'Festival Comunitario de Fin de Ciclo', 'Evento Comunitario', CURRENT_DATE + INTERVAL '25 days', 'Presencial',
       'Jardín de Niños Amado Nervo, Col. San Baltazar Campeche, Puebla, Pue.', NULL,
       (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Jardín de Niños Amado Nervo'),
       'https://res.cloudinary.com/demo/image/upload/v1700000000/eventos/festival_comunitario.jpg'
WHERE NOT EXISTS (SELECT 1 FROM Eventos WHERE titulo_evento = 'Festival Comunitario de Fin de Ciclo');


-- ------------------------------------------------------------
-- 7. PUBLICACIONES (antes "Noticias_Eventos")
-- ------------------------------------------------------------
INSERT INTO Publicaciones (titulo, contenido, url_imagen, tipo, categoria, url_documento_consentimiento, id_evento_relacionado, id_autor)
SELECT '¡Únete a nuestra Brigada de Salud Comunitaria!',
       'Este mes realizaremos una jornada de salud gratuita para las familias de la Col. La Libertad: consultas médicas básicas, entrega de kits de higiene y pláticas de prevención. ¡Todos son bienvenidos!',
       'https://res.cloudinary.com/demo/image/upload/v1700000000/publicaciones/brigada_salud_pub.jpg',
       'Evento', 'Salud,Comunidad', NULL,
       (SELECT id_evento FROM Eventos WHERE titulo_evento = 'Brigada de Salud Comunitaria'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol IN (1,3) ORDER BY id_rol, id_usuario LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Publicaciones WHERE titulo = '¡Únete a nuestra Brigada de Salud Comunitaria!');

INSERT INTO Publicaciones (titulo, contenido, url_imagen, tipo, categoria, url_documento_consentimiento, id_evento_relacionado, id_autor)
SELECT 'Cerramos con éxito la Recolección de Despensas',
       'Gracias a la generosidad de nuestros donantes y voluntarios, logramos reunir más de 40 despensas que ya están siendo entregadas a las familias que más lo necesitan. ¡Gracias por seguir apoyando!',
       'https://res.cloudinary.com/demo/image/upload/v1700000000/publicaciones/recoleccion_cierre.jpg',
       'Aviso', 'Donativos,Comunidad', NULL,
       (SELECT id_evento FROM Eventos WHERE titulo_evento = 'Recolección de Despensas'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol IN (1,3) ORDER BY id_rol, id_usuario LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Publicaciones WHERE titulo = 'Cerramos con éxito la Recolección de Despensas');

INSERT INTO Publicaciones (titulo, contenido, url_imagen, tipo, categoria, url_documento_consentimiento, id_evento_relacionado, id_autor)
SELECT 'Convocatoria: Taller de Tareas Dirigidas',
       'Buscamos voluntarios con gusto por la enseñanza para apoyar el nuevo Taller de Tareas Dirigidas en la Telesecundaria Miguel Hidalgo. Los sábados de 10:00 a 12:00 hrs. ¡Anímate a inscribirte desde la Agenda!',
       'https://res.cloudinary.com/demo/image/upload/v1700000000/publicaciones/taller_convocatoria.jpg',
       'Aviso', 'Educación,Voluntariado', NULL,
       (SELECT id_evento FROM Eventos WHERE titulo_evento = 'Taller de Tareas Dirigidas'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol IN (1,3) ORDER BY id_rol, id_usuario LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Publicaciones WHERE titulo = 'Convocatoria: Taller de Tareas Dirigidas');

INSERT INTO Publicaciones (titulo, contenido, url_imagen, tipo, categoria, url_documento_consentimiento, id_evento_relacionado, id_autor)
SELECT 'Se acerca el Festival Comunitario de Fin de Ciclo',
       'Cerraremos el ciclo con un festival lleno de actividades para toda la familia: juegos, música y reconocimientos a nuestros beneficiarios y voluntarios más destacados. ¡No falten!',
       'https://res.cloudinary.com/demo/image/upload/v1700000000/publicaciones/festival_anuncio.jpg',
       'Evento', 'Comunidad', NULL,
       (SELECT id_evento FROM Eventos WHERE titulo_evento = 'Festival Comunitario de Fin de Ciclo'),
       (SELECT id_usuario FROM Usuarios WHERE id_rol IN (1,3) ORDER BY id_rol, id_usuario LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM Publicaciones WHERE titulo = 'Se acerca el Festival Comunitario de Fin de Ciclo');


-- ------------------------------------------------------------
-- 8. AGENDA_VISITAS
-- ------------------------------------------------------------
INSERT INTO Agenda_Visitas (id_escuela, fecha_cita, estatus_alerta, id_usuario_creador, es_prospeccion, asistentes_plan)
SELECT (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Primaria Benito Juárez'),
       CURRENT_DATE + INTERVAL '7 days', 'Pendiente',
       (SELECT id_usuario FROM Usuarios WHERE id_rol IN (1,3) ORDER BY id_rol, id_usuario LIMIT 1),
       TRUE, 3
WHERE NOT EXISTS (
    SELECT 1 FROM Agenda_Visitas
    WHERE id_escuela = (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Primaria Benito Juárez')
      AND estatus_alerta = 'Pendiente'
);

INSERT INTO Agenda_Visitas (id_escuela, fecha_cita, estatus_alerta, id_usuario_creador, es_prospeccion, asistentes_plan)
SELECT (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Jardín de Niños Amado Nervo'),
       CURRENT_DATE + INTERVAL '3 days', 'Confirmado (3 días)',
       (SELECT id_usuario FROM Usuarios WHERE id_rol IN (1,3) ORDER BY id_rol, id_usuario LIMIT 1),
       TRUE, 2
WHERE NOT EXISTS (
    SELECT 1 FROM Agenda_Visitas
    WHERE id_escuela = (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Jardín de Niños Amado Nervo')
      AND estatus_alerta = 'Confirmado (3 días)'
);

INSERT INTO Agenda_Visitas (id_escuela, fecha_cita, estatus_alerta, id_usuario_creador, es_prospeccion, asistentes_plan)
SELECT (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Telesecundaria Miguel Hidalgo'),
       CURRENT_DATE - INTERVAL '15 days', 'Realizado',
       (SELECT id_usuario FROM Usuarios WHERE id_rol IN (1,3) ORDER BY id_rol, id_usuario LIMIT 1),
       TRUE, 2
WHERE NOT EXISTS (
    SELECT 1 FROM Agenda_Visitas
    WHERE id_escuela = (SELECT id_escuela FROM Escuelas WHERE nombre_escuela = 'Telesecundaria Miguel Hidalgo')
      AND estatus_alerta = 'Realizado'
);

-- ============================================================
-- Fin del script. Puedes correrlo completo en el SQL Editor de
-- Supabase las veces que quieras: no duplica datos ni toca los
-- registros que ya tenías (como "juan perez" o cualquier otro).
-- ============================================================
