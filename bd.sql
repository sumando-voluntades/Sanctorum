-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.roles (
  id_rol integer NOT NULL DEFAULT nextval('roles_id_rol_seq'::regclass),
  nombre_rol character varying NOT NULL CHECK (nombre_rol::text = ANY (ARRAY['Admin'::character varying, 'Especialista'::character varying, 'Coordinador'::character varying, 'Voluntario'::character varying, 'Donador'::character varying]::text[])),
  descripcion text,
  CONSTRAINT roles_pkey PRIMARY KEY (id_rol)
);
CREATE TABLE public.usuarios (
  id_usuario integer NOT NULL DEFAULT nextval('usuarios_id_usuario_seq'::regclass),
  nombre_completo character varying NOT NULL,
  correo character varying NOT NULL UNIQUE,
  contraseña character varying NOT NULL,
  id_rol integer,
  estatus character varying DEFAULT 'Nuevo'::character varying,
  telefono character varying,
  especialidad character varying DEFAULT 'General'::character varying,
  fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  material_donado character varying,
  cantidad_donada character varying,
  foto_perfil_url text,
  documento_profesional_url text,
  biografia text,
  documento_profesional_estatus character varying DEFAULT 'Pendiente'::character varying CHECK (documento_profesional_estatus::text = ANY (ARRAY['Pendiente'::character varying, 'Aprobado'::character varying, 'Rechazado'::character varying, 'No Aplica'::character varying]::text[])),
  documento_revisado_por integer,
  documento_fecha_revision timestamp without time zone,
  edad integer,
  genero character varying,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT usuarios_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.roles(id_rol),
  CONSTRAINT fk_usuario_doc_revisor FOREIGN KEY (documento_revisado_por) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.beneficiarios (
  id_beneficiario integer NOT NULL DEFAULT nextval('beneficiarios_id_beneficiario_seq'::regclass),
  nombre_completo character varying NOT NULL,
  genero character varying CHECK (genero::text = ANY (ARRAY['Masculino'::character varying, 'Femenino'::character varying, 'Otro'::character varying]::text[])),
  fecha_nacimiento date,
  colonia_puebla character varying,
  nombre_tutor character varying,
  telefono_tutor character varying,
  fecha_registro date DEFAULT CURRENT_TIMESTAMP,
  id_escuela integer,
  id_especialista integer,
  estatus character varying DEFAULT 'ACTIVO'::character varying CHECK (estatus::text = ANY (ARRAY['ACTIVO'::character varying, 'EN PAUSA'::character varying, 'ALTA'::character varying]::text[])),
  correo_tutor character varying,
  CONSTRAINT beneficiarios_pkey PRIMARY KEY (id_beneficiario),
  CONSTRAINT beneficiarios_id_escuela_fkey FOREIGN KEY (id_escuela) REFERENCES public.escuelas(id_escuela),
  CONSTRAINT beneficiarios_id_especialista_fkey FOREIGN KEY (id_especialista) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.expedientes_notas (
  id_nota integer NOT NULL DEFAULT nextval('expedientes_notas_id_nota_seq'::regclass),
  id_beneficiario integer NOT NULL,
  id_especialista integer,
  fecha_atencion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tipo_intervencion character varying CHECK (tipo_intervencion::text = ANY (ARRAY['Diagnóstico'::character varying, 'Seguimiento'::character varying, 'Cierre'::character varying, 'Crisis'::character varying]::text[])),
  duracion_minutos integer,
  contenido_nota text NOT NULL,
  tipo_sesion character varying,
  modalidad character varying,
  nivel_riesgo character varying,
  asistencia character varying,
  CONSTRAINT expedientes_notas_pkey PRIMARY KEY (id_nota),
  CONSTRAINT expedientes_notas_id_beneficiario_fkey FOREIGN KEY (id_beneficiario) REFERENCES public.beneficiarios(id_beneficiario),
  CONSTRAINT expedientes_notas_id_especialista_fkey FOREIGN KEY (id_especialista) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.historias_exito (
  id_historia integer NOT NULL DEFAULT nextval('historias_exito_id_historia_seq'::regclass),
  id_beneficiario integer NOT NULL,
  id_autor integer,
  titulo character varying NOT NULL,
  contenido_preayuda text NOT NULL,
  contenido_postayuda text NOT NULL,
  consentimiento boolean DEFAULT false,
  url_documento_consentimiento text,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historias_exito_pkey PRIMARY KEY (id_historia),
  CONSTRAINT historias_exito_id_beneficiario_fkey FOREIGN KEY (id_beneficiario) REFERENCES public.beneficiarios(id_beneficiario),
  CONSTRAINT historias_exito_id_autor_fkey FOREIGN KEY (id_autor) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.escuelas (
  id_escuela integer NOT NULL DEFAULT nextval('escuelas_id_escuela_seq'::regclass),
  nombre_escuela character varying NOT NULL,
  contacto_nombre character varying,
  puesto_contacto character varying,
  telefono_escuela character varying,
  ubicacion character varying,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT escuelas_pkey PRIMARY KEY (id_escuela)
);
CREATE TABLE public.agenda_visitas (
  id_visita integer NOT NULL DEFAULT nextval('agenda_visitas_id_visita_seq'::regclass),
  id_escuela integer NOT NULL,
  fecha_cita timestamp without time zone NOT NULL,
  asistentes_plan integer,
  asistentes_reales integer,
  estatus_alerta character varying DEFAULT 'Pendiente'::character varying CHECK (estatus_alerta::text = ANY (ARRAY['Pendiente'::character varying, 'Confirmado (3 días)'::character varying, 'Realizado'::character varying, 'Cancelado'::character varying]::text[])),
  id_evento_ejecucion integer,
  es_prospeccion boolean DEFAULT true,
  id_usuario_creador integer,
  CONSTRAINT agenda_visitas_pkey PRIMARY KEY (id_visita),
  CONSTRAINT agenda_visitas_id_escuela_fkey FOREIGN KEY (id_escuela) REFERENCES public.escuelas(id_escuela),
  CONSTRAINT agenda_visitas_id_evento_ejecucion_fkey FOREIGN KEY (id_evento_ejecucion) REFERENCES public.eventos(id_evento),
  CONSTRAINT fk_visita_usuario_creador FOREIGN KEY (id_usuario_creador) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.insumos (
  id_insumo integer NOT NULL DEFAULT nextval('insumos_id_insumo_seq'::regclass),
  nombre_insumo character varying NOT NULL,
  unidad_medida character varying CHECK (unidad_medida::text = ANY (ARRAY['Litros'::character varying, 'Kilos'::character varying, 'Piezas'::character varying, 'Paquetes'::character varying]::text[])),
  stock_actual numeric DEFAULT 0.00,
  punto_reorden numeric DEFAULT 0.00,
  costo_unitario numeric DEFAULT 0.00,
  area_proyecto character varying,
  CONSTRAINT insumos_pkey PRIMARY KEY (id_insumo)
);
CREATE TABLE public.activos_fijos (
  id_activo integer NOT NULL DEFAULT nextval('activos_fijos_id_activo_seq'::regclass),
  nombre_equipo character varying NOT NULL,
  estado_actual character varying DEFAULT 'Funcional'::character varying CHECK (estado_actual::text = ANY (ARRAY['Funcional'::character varying, 'Dañado'::character varying, 'En Mantenimiento'::character varying]::text[])),
  id_responsable integer,
  ubicacion character varying,
  CONSTRAINT activos_fijos_pkey PRIMARY KEY (id_activo),
  CONSTRAINT activos_fijos_id_responsable_fkey FOREIGN KEY (id_responsable) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.contactos_externos (
  id_contacto integer NOT NULL DEFAULT nextval('contactos_externos_id_contacto_seq'::regclass),
  id_usuario_enlace integer,
  nombre_aliado character varying NOT NULL,
  tipo_aliado character varying CHECK (tipo_aliado::text = ANY (ARRAY['Voluntario'::character varying, 'Donante Individual'::character varying, 'Empresa Aliada'::character varying]::text[])),
  especialidad character varying,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT contactos_externos_pkey PRIMARY KEY (id_contacto),
  CONSTRAINT contactos_externos_id_usuario_enlace_fkey FOREIGN KEY (id_usuario_enlace) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.donaciones (
  id_donacion integer NOT NULL DEFAULT nextval('donaciones_id_donacion_seq'::regclass),
  id_contacto integer NOT NULL,
  id_insumo integer,
  monto numeric NOT NULL,
  metodo_pago character varying CHECK (metodo_pago::text = ANY (ARRAY['Transferencia'::character varying, 'Efectivo'::character varying, 'Plataforma Digital'::character varying, 'En especie'::character varying]::text[])),
  categoria_gasto character varying CHECK (categoria_gasto::text = ANY (ARRAY['Especialistas'::character varying, 'Insumos'::character varying, 'Operación'::character varying]::text[])),
  comprobante_url character varying,
  fecha_donacion date NOT NULL,
  id_usuario_registro integer,
  CONSTRAINT donaciones_pkey PRIMARY KEY (id_donacion),
  CONSTRAINT donaciones_id_contacto_fkey FOREIGN KEY (id_contacto) REFERENCES public.contactos_externos(id_contacto),
  CONSTRAINT donaciones_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumos(id_insumo),
  CONSTRAINT donaciones_id_usuario_registro_fkey FOREIGN KEY (id_usuario_registro) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.eventos (
  id_evento integer NOT NULL DEFAULT nextval('eventos_id_evento_seq'::regclass),
  titulo_evento character varying NOT NULL,
  tipo_evento character varying,
  fecha_realizacion timestamp without time zone NOT NULL,
  id_escuela integer,
  url_imagen text,
  direccion_mapa text,
  link_reunion text,
  modalidad character varying CHECK (modalidad IS NULL OR (modalidad::text = ANY (ARRAY['En línea'::character varying, 'Presencial'::character varying]::text[]))),
  categoria text,
  descripcion text,
  CONSTRAINT eventos_pkey PRIMARY KEY (id_evento),
  CONSTRAINT eventos_id_escuela_fkey FOREIGN KEY (id_escuela) REFERENCES public.escuelas(id_escuela)
);
CREATE TABLE public.participacion (
  id_participacion integer NOT NULL DEFAULT nextval('participacion_id_participacion_seq'::regclass),
  id_evento integer NOT NULL,
  id_usuario integer NOT NULL,
  horas_invertidas numeric,
  CONSTRAINT participacion_pkey PRIMARY KEY (id_participacion),
  CONSTRAINT participacion_id_evento_fkey FOREIGN KEY (id_evento) REFERENCES public.eventos(id_evento),
  CONSTRAINT participacion_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.consumo_insumos (
  id_consumo integer NOT NULL DEFAULT nextval('consumo_insumos_id_consumo_seq'::regclass),
  id_evento integer NOT NULL,
  id_insumo integer NOT NULL,
  cantidad_usada numeric NOT NULL,
  CONSTRAINT consumo_insumos_pkey PRIMARY KEY (id_consumo),
  CONSTRAINT consumo_insumos_id_insumo_fkey FOREIGN KEY (id_insumo) REFERENCES public.insumos(id_insumo),
  CONSTRAINT consumo_insumos_id_evento_fkey FOREIGN KEY (id_evento) REFERENCES public.eventos(id_evento)
);
CREATE TABLE public.solicitudes_web (
  id_solicitud integer NOT NULL DEFAULT nextval('solicitudes_web_id_solicitud_seq'::regclass),
  id_usuario_asignado integer,
  nombre_contacto character varying NOT NULL,
  telefono character varying,
  correo character varying NOT NULL,
  tipo_solicitud character varying CHECK (tipo_solicitud::text = ANY (ARRAY['Ayuda Psicológica'::character varying, 'Donación en Especie'::character varying, 'Compartir Historia de Éxito'::character varying]::text[])),
  mensaje text NOT NULL,
  estatus character varying DEFAULT 'Pendiente'::character varying CHECK (estatus::text = ANY (ARRAY['Pendiente'::character varying, 'Atendida'::character varying, 'Descartada'::character varying]::text[])),
  fecha_envio timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT solicitudes_web_pkey PRIMARY KEY (id_solicitud),
  CONSTRAINT solicitudes_web_id_usuario_asignado_fkey FOREIGN KEY (id_usuario_asignado) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.asistencia_beneficiarios (
  id_asistencia integer NOT NULL DEFAULT nextval('asistencia_beneficiarios_id_asistencia_seq'::regclass),
  id_evento integer NOT NULL,
  id_beneficiario integer NOT NULL,
  CONSTRAINT asistencia_beneficiarios_pkey PRIMARY KEY (id_asistencia),
  CONSTRAINT asistencia_beneficiarios_id_evento_fkey FOREIGN KEY (id_evento) REFERENCES public.eventos(id_evento),
  CONSTRAINT asistencia_beneficiarios_id_beneficiario_fkey FOREIGN KEY (id_beneficiario) REFERENCES public.beneficiarios(id_beneficiario)
);
CREATE TABLE public.expedientes_documentos (
  id_doc integer NOT NULL DEFAULT nextval('expedientes_documentos_id_doc_seq'::regclass),
  id_beneficiario integer,
  nombre_archivo character varying,
  url_archivo text,
  fecha_subida timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expedientes_documentos_pkey PRIMARY KEY (id_doc),
  CONSTRAINT expedientes_documentos_id_beneficiario_fkey FOREIGN KEY (id_beneficiario) REFERENCES public.beneficiarios(id_beneficiario)
);
CREATE TABLE public.publicaciones (
  id_publicacion integer NOT NULL DEFAULT nextval('noticias_eventos_id_noticia_seq'::regclass),
  titulo character varying NOT NULL,
  contenido text NOT NULL,
  url_imagen text,
  tipo character varying DEFAULT 'Aviso'::character varying,
  fecha_post timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  categoria text,
  url_documento_consentimiento text,
  id_evento_relacionado integer,
  id_autor integer,
  id_editor integer,
  url_video text,
  CONSTRAINT publicaciones_pkey PRIMARY KEY (id_publicacion),
  CONSTRAINT fk_noticia_evento_relacionado FOREIGN KEY (id_evento_relacionado) REFERENCES public.eventos(id_evento),
  CONSTRAINT fk_publicacion_autor FOREIGN KEY (id_autor) REFERENCES public.usuarios(id_usuario),
  CONSTRAINT fk_publicacion_editor FOREIGN KEY (id_editor) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.reportes_evento (
  id_reporte integer NOT NULL DEFAULT nextval('reportes_evento_id_reporte_seq'::regclass),
  id_evento integer NOT NULL,
  id_usuario integer NOT NULL,
  actividades_realizadas text NOT NULL,
  materiales_utilizados text,
  numero_asistentes integer,
  observaciones text,
  fecha_reporte timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT reportes_evento_pkey PRIMARY KEY (id_reporte),
  CONSTRAINT reportes_evento_id_evento_fkey FOREIGN KEY (id_evento) REFERENCES public.eventos(id_evento),
  CONSTRAINT reportes_evento_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.donaciones_registro (
  id_registro integer NOT NULL DEFAULT nextval('donaciones_registro_id_registro_seq'::regclass),
  id_usuario integer NOT NULL,
  material character varying NOT NULL,
  cantidad numeric NOT NULL,
  unidad character varying,
  fecha_donacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT donaciones_registro_pkey PRIMARY KEY (id_registro),
  CONSTRAINT donaciones_registro_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.galeria_imagenes (
  id_imagen integer NOT NULL DEFAULT nextval('galeria_imagenes_id_imagen_seq'::regclass),
  tipo_entidad character varying NOT NULL CHECK (tipo_entidad::text = ANY (ARRAY['noticia'::character varying, 'evento'::character varying]::text[])),
  id_entidad integer NOT NULL,
  url_imagen text NOT NULL,
  orden integer DEFAULT 0,
  fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT galeria_imagenes_pkey PRIMARY KEY (id_imagen)
);
CREATE TABLE public.encuestas_satisfaccion (
  id_encuesta integer NOT NULL DEFAULT nextval('encuestas_satisfaccion_id_encuesta_seq'::regclass),
  id_beneficiario integer NOT NULL,
  id_especialista integer,
  token character varying NOT NULL UNIQUE,
  calificacion integer CHECK (calificacion >= 1 AND calificacion <= 5),
  comentarios text,
  fecha_envio timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta timestamp without time zone,
  respondida boolean NOT NULL DEFAULT false,
  calificacion_especialista integer CHECK (calificacion_especialista >= 1 AND calificacion_especialista <= 5),
  calificacion_puntualidad integer CHECK (calificacion_puntualidad >= 1 AND calificacion_puntualidad <= 5),
  utilidad_sesion character varying CHECK (utilidad_sesion::text = ANY (ARRAY['Si'::character varying, 'Parcialmente'::character varying, 'No'::character varying]::text[])),
  probabilidad_recomendar integer CHECK (probabilidad_recomendar >= 0 AND probabilidad_recomendar <= 10),
  revisada boolean NOT NULL DEFAULT false,
  fecha_revision timestamp without time zone,
  id_usuario_revisor integer,
  CONSTRAINT encuestas_satisfaccion_pkey PRIMARY KEY (id_encuesta),
  CONSTRAINT encuestas_satisfaccion_id_beneficiario_fkey FOREIGN KEY (id_beneficiario) REFERENCES public.beneficiarios(id_beneficiario),
  CONSTRAINT encuestas_satisfaccion_id_especialista_fkey FOREIGN KEY (id_especialista) REFERENCES public.usuarios(id_usuario),
  CONSTRAINT encuestas_satisfaccion_id_usuario_revisor_fkey FOREIGN KEY (id_usuario_revisor) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.categorias (
  id_categoria integer NOT NULL DEFAULT nextval('categorias_id_categoria_seq'::regclass),
  nombre_categoria character varying NOT NULL UNIQUE,
  fecha_creacion timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT categorias_pkey PRIMARY KEY (id_categoria)
);