# Sanctorum

Plataforma Digital Integral para la gestión operativa, atención comunitaria y transparencia
radical de **Sumando Voluntades Sanctórum A.C.**

Este documento describe la estructura del código y cómo está organizado el proyecto. Para
manuales de uso, requerimientos, modelo entidad-relación y demás documentación funcional,
ver la carpeta `Sanctorum_documentación/` (fuera de este repositorio de código).

## Tabla de contenido

1. [Stack técnico](#stack-técnico)
2. [Estructura de carpetas](#estructura-de-carpetas)
3. [Cómo correrlo localmente](#cómo-correrlo-localmente)
4. [Modelo de roles y permisos](#modelo-de-roles-y-permisos)
5. [Backend (`server.js`)](#backend-serverjs)
6. [Sitio público (`public/`)](#sitio-público-public)
7. [Panel administrativo (`public/admin/`)](#panel-administrativo-publicadmin)
8. [Frontend compartido](#frontend-compartido)
9. [Base de datos y migraciones](#base-de-datos-y-migraciones)
10. [Funciones retiradas](#funciones-retiradas)

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express 5 (`server.js`, un solo archivo, sin carpeta de rutas/controladores separada) |
| Base de datos | PostgreSQL (Supabase), acceso vía `pg` con pool de conexiones |
| Autenticación | JWT (`jsonwebtoken`) + contraseñas con `bcryptjs` |
| Correo | `nodemailer` (notificaciones y avisos por correo) |
| Imágenes / video | Cloudinary (subida directa desde el navegador con upload preset sin firmar) |
| Frontend | HTML + JavaScript "vanilla" (sin framework ni build de JS) servido como archivos estáticos |
| CSS | Tailwind CSS 4, compilado de `public/css/input.css` a `public/css/output.css` |
| Pruebas end-to-end | Playwright (`tests/`, `playwright.config.js`) |
| Despliegue | Pensado para el entorno de Google for Nonprofits / hosting estático + Node (hay un `vercel.json` en `public/`) |

No hay React, Vue, Angular ni ningún bundler de JS: cada página HTML carga sus `<script>` con
`<script src="...">` normal, y la lógica compartida vive en `public/js/`.

## Estructura de carpetas

```
Sanctorum/
├── server.js                  # Todo el backend: middlewares, auth y ~90 rutas /api/*
├── bd.sql                     # Esquema completo de referencia (para recrear la BD desde cero)
├── package.json
├── playwright.config.js
├── .env                       # Variables de entorno (no se versiona)
├── database/                  # Migraciones .sql sueltas, aplicadas manualmente en Supabase
│   └── migracion_*.sql
├── tests/                     # Pruebas Playwright
├── test-results/              # Salida de las pruebas (generado)
└── public/                    # Todo lo que se sirve como archivos estáticos
    ├── README.md               # Este archivo
    ├── index.html               # Landing page pública
    ├── login.html
    ├── nosotros.html
    ├── como_ayudar.html
    ├── comunidad_blog.html      # "Comunidad": publicaciones (avisos, eventos, historias de éxito)
    ├── evento_detalle.html
    ├── calendario_eventos.html
    ├── solicitud_apoyo_oficial.html
    ├── encuesta_satisfaccion.html   # Solo lectura pública (ver "Funciones retiradas")
    ├── aviso_privacidad.html
    ├── credencial.html / programacarne.html / volantecarne.html / editor_volante.html / editorimagenes.html / hoja_membretada.html / flyer.html / herramientas.html
    │                            # Generadores/editores de credenciales y material gráfico
    ├── robots.txt, vercel.json
    ├── admin/                   # Panel administrativo (requiere sesión)
    │   ├── dashboard.html
    │   ├── perfil.html
    │   ├── agenda.html
    │   ├── publicaciones.html
    │   ├── voluntariado.html
    │   ├── aliados_donativos.html
    │   ├── inventario.html
    │   ├── reportes.html
    │   └── constancia.html
    ├── js/
    │   ├── comun.js             # Sesión, fetch autenticado, permisos de UI, utilidades compartidas
    │   ├── incluir.js           # Inyecta los partials (navbar/header/footer) en cada página
    │   └── notificaciones.js    # Campana de notificaciones (polling + dropdown)
    ├── partials/                # Fragmentos HTML inyectados por incluir.js
    │   ├── navbar_publico.html / footer_publico.html
    │   └── header_admin.html / navbar_admin.html / footer_admin.html
    ├── css/
    │   ├── input.css            # Fuente de Tailwind
    │   └── output.css           # Compilado (npm run build:css / watch:css)
    └── assets/                  # Logos, íconos, imágenes institucionales
```

> Nota: si ves en algún respaldo local archivos `.html` sueltos en la raíz del proyecto (fuera
> de `public/`) como `agenda.html`, `expedientes.html`, `inicio.html`, `comunidad_sv.html`, etc.,
> son copias viejas que ya no forman parte del proyecto — el código real y vigente vive
> únicamente dentro de `public/` y `public/admin/`.

## Cómo correrlo localmente

```bash
npm install
npm run build:css      # compila Tailwind una vez (o npm run watch:css en desarrollo)
npm start               # node server.js
```

Variables de entorno esperadas en `.env` (raíz del proyecto):

| Variable | Uso |
|---|---|
| `PORT` | Puerto del servidor Express |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (Supabase) |
| `JWT_SECRET` | Firma de los tokens de sesión |
| `EMAIL_USER` / `EMAIL_PASS` | Cuenta usada por Nodemailer para enviar correos |
| `CLOUDINARY_CLOUD_NAME` | Nombre de la cuenta de Cloudinary usada para imágenes/video |
| `CLOUDINARY_UPLOAD_PRESET` | Preset de subida sin firmar usado desde el navegador |

El sitio se sirve como archivos estáticos desde `public/`; `server.js` expone además todas las
rutas de API bajo `/api/*`.

## Modelo de roles y permisos

| Rol | Constante | Descripción |
|---|---|---|
| 1 | `ROL_ADMIN` | Acceso total |
| 2 | `ROL_ESPECIALISTA` | Staff operativo. Si su `especialidad` contiene "psic" (case-insensitive), `esPsicologo(usuario)` devuelve `true` y aplican reglas adicionales |
| 3 | `ROL_COORDINADOR` | Coordinación de áreas/voluntariado |
| 4 | `ROL_VOLUNTARIO` | Voluntariado |
| 5 | *(Donador)* | Solo se usa para filtros y conteos; no tiene panel propio ni inicia sesión en el admin |

Los permisos se aplican en **dos capas independientes** que hay que mantener sincronizadas a
mano (no existe una única fuente de verdad):

1. **Backend (obligatorio):** middlewares en `server.js` — `verificarToken` (exige JWT válido),
   `requiereRol(...roles)` (whitelist de roles por ruta) y `verificarAutorORol(tabla, columnaId,
   columnaAutor)` (el dueño del registro o alguien con rol suficiente).
2. **Frontend (solo cosmético):** `aplicarRestriccionesNav` y `permisosPorPagina` en
   `public/js/comun.js` ocultan botones/pestañas/links según el rol, pero no protegen nada por sí
   solos — la protección real siempre es la del backend.

## Backend (`server.js`)

Archivo único (~180 KB) que concentra:

- **Setup:** Express 5, `cors`, `express.json()`, pool de `pg`, configuración de Nodemailer.
- **Auth:** `POST /api/auth/login`, generación/verificación de JWT, hash de contraseñas con
  `bcryptjs`.
- **Middlewares reutilizables:** `verificarToken`, `requiereRol`, `verificarAutorORol`.
- **~90 rutas `/api/*`**, agrupadas por dominio (los nombres de archivo del panel admin
  corresponden 1:1 con estos grupos):
  - `usuarios` / `perfil` — alta, edición, cambio de contraseña, roles.
  - `agenda` / `eventos` — actividades con escuelas, categorías compartidas con Publicaciones.
  - `publicaciones` — avisos, eventos de comunidad e Historias de Éxito (ver más abajo).
  - `voluntariado` / `solicitudes` — captación y seguimiento de voluntarios.
  - `aliados` / `donativos` — aliados institucionales y donativos.
  - `inventario` — insumos con punto de reorden y activos fijos.
  - `reportes` — reportes de actividades y sus adjuntos.
  - `categorias` — catálogo reutilizable entre Publicaciones y Agenda.
  - `notificaciones` — campana de notificaciones del panel admin.
- **Patrón de transacción:** las rutas que escriben en varias tablas relacionadas (por ejemplo
  crear una Publicación con imágenes adicionales) usan `BEGIN` / `COMMIT` / `ROLLBACK` explícitos
  sobre un cliente sacado del pool.
- **Patrón de retiro de funciones:** cuando se da de baja una funcionalidad, el código no se
  borra — se comenta con `/* ... */` dejando un comentario explicativo arriba, para que quede
  rastro de qué existía y por qué se apagó (ver [Funciones retiradas](#funciones-retiradas)).

## Sitio público (`public/`)

| Página | Contenido |
|---|---|
| `index.html` | Landing page pública |
| `login.html` | Inicio de sesión (staff/voluntariado) |
| `nosotros.html` | Quiénes somos |
| `como_ayudar.html` | Formas de apoyar a la asociación |
| `comunidad_blog.html` | Publicaciones: avisos, eventos e Historias de Éxito, por categoría, con portada, galería y video opcional |
| `evento_detalle.html` | Detalle de una publicación/evento |
| `calendario_eventos.html` | Calendario público de eventos |
| `solicitud_apoyo_oficial.html` | Formulario de solicitud de apoyo |
| `encuesta_satisfaccion.html` | Página de encuesta — la captura está retirada, ver [Funciones retiradas](#funciones-retiradas) |
| `aviso_privacidad.html` | Aviso de privacidad, enlazado desde el footer público |
| `credencial.html`, `programacarne.html`, `volantecarne.html`, `editor_volante.html`, `editorimagenes.html`, `hoja_membretada.html`, `flyer.html`, `herramientas.html` | Generadores/editores de credenciales, volantes y material gráfico institucional |

## Panel administrativo (`public/admin/`)

Todas requieren sesión iniciada (JWT) y aplican `aplicarRestriccionesNav` según el rol.

| Página | Contenido |
|---|---|
| `dashboard.html` | KPIs generales (incluye `kpi_beneficiarios`, antes `kpi_expedientes`) |
| `perfil.html` | Datos del usuario en sesión y, según rol, gestión de otros usuarios |
| `agenda.html` | Agenda de actividades con escuelas. Conserva la vista histórica de "Cita Clínica" en modo solo-lectura (ver [Funciones retiradas](#funciones-retiradas)) |
| `publicaciones.html` | Alta/edición de avisos, eventos e Historias de Éxito |
| `voluntariado.html` | Solicitudes y seguimiento de voluntariado |
| `aliados_donativos.html` | Aliados institucionales y donativos |
| `inventario.html` | Insumos y activos fijos |
| `reportes.html` | Reportes de actividades |
| `constancia.html` | Generación de constancias |

## Frontend compartido

- **`public/js/comun.js`:** capa de sesión y utilidades usadas por (casi) todas las páginas —
  lectura/validación del JWT guardado, helper de `fetch` autenticado (agrega el header de
  Authorization y maneja 401/403), `aplicarRestriccionesNav`/`permisosPorPagina` (oculta UI según
  rol), y funciones auxiliares comunes (formateo de fechas, manejo de errores, etc.).
- **`public/js/incluir.js`:** inyecta en cada página los fragmentos de `public/partials/` (navbar,
  header y footer) para no repetir ese HTML en cada archivo.
- **`public/js/notificaciones.js`:** campana de notificaciones del panel admin (consulta periódica
  al backend y despliega el dropdown).
- **`public/partials/`:** `navbar_publico.html` / `footer_publico.html` (sitio público, con enlaces
  a redes sociales, contacto y `aviso_privacidad.html`) y `header_admin.html` / `navbar_admin.html`
  / `footer_admin.html` (panel administrativo).

## Base de datos y migraciones

- `bd.sql` en la raíz es el esquema completo de referencia (sirve para recrear la base desde
  cero), con ~23 tablas activas.
- Los cambios posteriores al esquema base se aplican como archivos `.sql` sueltos en
  `database/`, cada uno ejecutado **una sola vez**, manualmente, desde el SQL Editor de Supabase.
  No hay un runner de migraciones automatizado. La convención de nombre es
  `migracion_<tema>_v1.sql` (o `_v2.sql` si reemplaza a una anterior).
- Casi todas usan `IF NOT EXISTS` / `ON CONFLICT`, así que es seguro volver a correrlas si hay
  duda de si ya se aplicaron. Si el servidor marca un error de tipo `column "..." does not
  exist`, casi siempre significa que falta correr alguna migración pendiente.
- Migraciones relevantes: `migracion_categorias_v1.sql` (catálogo de categorías reutilizable),
  `migracion_categoria_ampliar_v1.sql`, `migracion_eventos_descripcion_v1.sql` /
  `migracion_eventos_categoria_v1.sql` / `migracion_eventos_responsable_v1.sql`,
  `migracion_publicaciones_video_v1.sql`, `migracion_aliados_activo_v1.sql`,
  `migracion_escuelas_y_donativos_v1.sql`, `migracion_donaciones_categoria_libre_v1.sql`,
  `migracion_insumos_unidad_medida_v1.sql`, `migracion_normalizacion_categorias_v1.sql`,
  `migracion_usuarios_cantidad_donada_split_v1.sql`, `migracion_reportes_evento_adjuntos_v1.sql`,
  `migracion_encuestas_satisfaccion.sql` / `_v2.sql` (módulo ya retirado, ver abajo) y
  `migracion_historias_exito_nombre_edad_v1.sql` (**pendiente de correr** — agrega
  `nombre_beneficiario`/`edad_beneficiario` a `Historias_Exito` y vuelve opcional
  `id_beneficiario`; sin ella, el código nuevo de Historias de Éxito falla).
- Dos tablas del esquema, `Expedientes_Notas` y `Expedientes_Documentos`, quedaron huérfanas
  tras retirar el módulo de Expedientes: existen en `bd.sql` pero ningún endpoint de `server.js`
  las usa ya.

## Funciones retiradas

Siguiendo el patrón de "comentar, no borrar", estas funcionalidades quedaron apagadas en el
código pero visibles como comentario para referencia futura:

1. **Expedientes / Pacientes.** No existe ya ninguna forma de dar de alta un Beneficiario nuevo
   ni de gestionar expedientes clínicos/psicológicos individuales. Las rutas de directorio de
   pacientes (`/api/agenda/directorio_pacientes`, `/api/agenda/paciente/:id/citas`) están
   comentadas en `server.js`. En `agenda.html`, el directorio de pacientes y el selector de
   beneficiario para Cita Clínica quedaron inertes (inalcanzables porque esa vista ya no se
   muestra).
2. **Cita Clínica (dentro de Agenda).** Ya no se pueden crear ni editar citas clínicas: el tipo
   de registro "clínica" fue removido del formulario de alta, y `POST /api/agenda` ya no acepta
   ese `tipo_registro` (la rama que insertaba en `Eventos`/`Asistencia_Beneficiarios`/
   `Participacion` quedó comentada). Las citas clínicas creadas **antes** de este retiro se
   siguen mostrando en el listado y el calendario de Agenda en modo solo-lectura; intentar
   editarlas desde `agenda.html` muestra un aviso en vez de abrir el formulario.
3. **Encuestas de Satisfacción.** La captura de nuevas encuestas está desactivada tanto en el
   backend como en el panel admin (`perfil.html`); `encuesta_satisfaccion.html` en el sitio
   público queda como página de solo lectura/consulta de resultados históricos.
4. **Historia de Éxito ligada a un Beneficiario existente.** El modal de "Nueva Publicación >
   Historia de Éxito" pedía elegir un Beneficiario de una lista fija — imposible de mantener útil
   una vez retirada el alta de Beneficiarios. Ahora pide directamente **nombre o alias** y
   **edad** en texto libre (columnas `nombre_beneficiario`/`edad_beneficiario` en
   `Historias_Exito`, ver migración arriba). Las historias publicadas antes de este cambio
   conservan su vínculo a `Beneficiarios` y se siguen mostrando igual, vía `LEFT JOIN` de
   respaldo tanto en la carga para edición como en el endpoint público.
5. **`GET /api/estadisticas_psicologia`.** Ruta comentada en `server.js`: alimentaba las tarjetas
   "Beneficiarios en atención actualmente" / "Beneficiarios ayudados con éxito" del `index.html`
   público, que fueron retiradas del landing junto con la llamada a este endpoint.

---
*Desarrollado como proyecto de servicio social para la transformación comunitaria y el
empoderamiento juvenil.*
