const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length === 0) {
    console.error('ERROR FATAL: falta la variable de entorno JWT_SECRET en el .env.');
    process.exit(1);
}

const app = express();

const ORIGENES_PERMITIDOS = [
    'https://sumandovoluntadesensanctorum.org',
    'http://localhost:3000'
];
const opcionesCors = {
    origin(origin, callback) {
        if (!origin || ORIGENES_PERMITIDOS.includes(origin)) return callback(null, true);
        callback(new Error('Origen no permitido por la politica de CORS.'));
    },
};
app.use(cors(opcionesCors));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/partials', express.static(path.join(__dirname, 'public', 'partials')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://res.cloudinary.com",
        "connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com",
        "frame-ancestors 'none'",
    ].join('; '));
    next();
});

function crearLimitador({ ventanaMs, maxIntentos, mensaje }) {
    const intentosPorIp = new Map();
    const limpieza = setInterval(() => {
        const ahora = Date.now();
        for (const [ip, datos] of intentosPorIp.entries()) {
            if (ahora > datos.resetAt) intentosPorIp.delete(ip);
        }
    }, ventanaMs);
    limpieza.unref?.();

    return (req, res, next) => {
        const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
        const ahora = Date.now();
        let datos = intentosPorIp.get(ip);
        if (!datos || ahora > datos.resetAt) {
            datos = { count: 0, resetAt: ahora + ventanaMs };
            intentosPorIp.set(ip, datos);
        }
        datos.count++;
        if (datos.count > maxIntentos) {
            res.set('Retry-After', String(Math.ceil((datos.resetAt - ahora) / 1000)));
            return res.status(429).json({ success: false, message: mensaje });
        }
        next();
    };
}

const limitadorAuth = crearLimitador({
    ventanaMs: 60 * 1000,
    maxIntentos: 5,
    mensaje: 'Demasiados intentos. Espera un minuto antes de volver a intentar.'
});
const limitadorGeneral = crearLimitador({
    ventanaMs: 60 * 1000,
    maxIntentos: 200,
    mensaje: 'Demasiadas solicitudes. Intenta de nuevo en unos momentos.'
});

app.use('/api/auth', limitadorAuth);
app.use('/api', limitadorGeneral);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

<<<<<<< HEAD
=======
// Envía un correo sin bloquear la respuesta al cliente. El SMTP de Gmail puede tardar
// varios segundos en responder; si cada ruta esperara (`await`) ese envío antes de
// contestar, el botón que disparó la acción se sentiría "trabado" ese mismo tiempo aunque
// la acción real (guardar en la base de datos) ya haya terminado. El correo es una
// notificación secundaria: se dispara en segundo plano y cualquier falla solo se registra
// en consola, nunca hace fallar la petición original.
function enviarCorreoAsync(opciones, contexto) {
    transporter.sendMail(opciones).catch(err => {
        console.error(`No se pudo enviar el correo (${contexto || 'sin contexto'}):`, err);
    });
}

// ==========================================
// ENCUESTA DE SATISFACCIÓN POST-CONSULTA (RF-15)
// Requiere la tabla Encuestas_Satisfaccion — ver migracion_encuestas_satisfaccion.sql.
// Se dispara desde POST /api/expedientes/:id/notas cuando asistencia === 'Asistió'.
// ==========================================

// Crea el registro de la encuesta (con un token de un solo uso) y le manda al tutor el
// enlace por correo. No bloquea nada: si el beneficiario no tiene correo de tutor
// registrado, o si la tabla todavía no existe (falta correr la migración), no hace nada —
// nunca debe hacer fallar el guardado de la nota clínica que la dispara.
async function enviarEncuestaSatisfaccion(idBeneficiario, idEspecialista) {
    const benRes = await pool.query('SELECT nombre_completo, nombre_tutor, correo_tutor FROM Beneficiarios WHERE id_beneficiario = $1', [idBeneficiario]);
    const ben = benRes.rows[0];
    if (!ben || !ben.correo_tutor) return;

    const token = crypto.randomBytes(24).toString('hex');
    await pool.query(
        'INSERT INTO Encuestas_Satisfaccion (id_beneficiario, id_especialista, token) VALUES ($1, $2, $3)',
        [idBeneficiario, idEspecialista || null, token]
    );

    // Mismo dominio de producción provisional que usa el resto de los correos del sistema
    // (ver Variables_de_Entorno_y_Checklist_Despliegue.docx, sección de CORS) — actualizar
    // aquí también el día que se confirme el dominio final.
    const enlace = `https://sanctorum-sitio.vercel.app/encuesta_satisfaccion?token=${token}`;
    const contenido = `
        <p>Hola <b>${ben.nombre_tutor || 'tutor(a)'}</b>,</p>
        <p>Nos gustaría conocer tu opinión sobre la sesión de <b>${ben.nombre_completo}</b>. Tu respuesta nos ayuda a mejorar el servicio — toma menos de un minuto.</p>
        <div style="text-align:center;margin:25px 0;">
            <a href="${enlace}" style="background-color:#b50062;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:30px;font-weight:bold;display:inline-block;">Responder encuesta</a>
        </div>
        <p style="font-style:italic;color:#877362;text-align:center;">"Sumando Voluntades"</p>
    `;
    enviarCorreoAsync({
        from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
        to: ben.correo_tutor,
        subject: 'Cuéntanos cómo te fue - Sanctorum A.C.',
        html: emailTemplate('Encuesta de Satisfacción', contenido)
    }, 'encuesta de satisfacción');
}

// Avisa a Coordinadores y Administradores cuando llega una calificación insatisfactoria
// (1 o 2 de 5), para que puedan darle seguimiento al caso.
async function avisarEncuestaInsatisfactoria(idBeneficiario, calificacion, comentarios, detalle = {}) {
    const benRes = await pool.query('SELECT nombre_completo FROM Beneficiarios WHERE id_beneficiario = $1', [idBeneficiario]);
    const nombreBen = benRes.rows[0]?.nombre_completo || 'un beneficiario';
    const staffRes = await pool.query("SELECT correo FROM Usuarios WHERE id_rol IN (1, 3) AND correo IS NOT NULL AND COALESCE(estatus,'Activo') != 'Inactivo'");
    const correos = staffRes.rows.map(r => r.correo).filter(Boolean);
    if (correos.length === 0) return;

    const { calificacionEspecialista, calificacionPuntualidad, utilidadSesion, probabilidadRecomendar } = detalle;
    const filasDetalle = [
        calificacionEspecialista ? `<li>Trato del especialista: <b>${calificacionEspecialista} de 5</b></li>` : '',
        calificacionPuntualidad ? `<li>Puntualidad: <b>${calificacionPuntualidad} de 5</b></li>` : '',
        utilidadSesion ? `<li>¿La sesión le ayudó?: <b>${escapeHtmlServidor(utilidadSesion)}</b></li>` : '',
        (probabilidadRecomendar !== undefined && probabilidadRecomendar !== null) ? `<li>Probabilidad de recomendar: <b>${probabilidadRecomendar} de 10</b></li>` : '',
    ].filter(Boolean).join('');

    const contenido = `
        <p>Hola,</p>
        <p>Se recibió una calificación insatisfactoria (<b>${calificacion} de 5</b>) en la encuesta de satisfacción de <b>${escapeHtmlServidor(nombreBen)}</b>.</p>
        ${filasDetalle ? `<ul>${filasDetalle}</ul>` : ''}
        ${comentarios ? `<p><b>Comentarios:</b> ${escapeHtmlServidor(comentarios)}</p>` : ''}
        <p>Entra a tu perfil dentro de la plataforma (sección "Encuestas por revisar") o al expediente del beneficiario para darle seguimiento.</p>
    `;
    enviarCorreoAsync({
        from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
        to: correos.join(','),
        subject: 'Alerta: encuesta de satisfacción insatisfactoria - Sanctorum A.C.',
        html: emailTemplate('Encuesta con calificación baja', contenido)
    }, 'alerta de encuesta insatisfactoria');
}

// Si en "Material a utilizar" se escogió "Otro: escribir...", se da de alta un Insumo nuevo
// (con el stock inicial igual a lo que se va a usar, para que quede en 0 tras el consumo) en
// vez de fallar por no existir en el catálogo. Si ya viene un id de insumo real, se usa tal cual.
// Valida que las URLs de archivos (foto de perfil, documento profesional, comprobante de
// donativo, imagen de evento/galeria, documento de consentimiento) vengan de Cloudinary antes
// de guardarlas — el frontend las renderiza tal cual en <a href> / <img src>. Se acepta un
// valor vacio/nulo, o uno que empiece exactamente con "https://res.cloudinary.com/".
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
const PREFIJO_URL_CLOUDINARY = 'https://res.cloudinary.com/';
function validarUrlCloudinaria(valor, nombreCampo) {
    if (valor === undefined || valor === null || valor === '') return { ok: true, valor: null };
    if (typeof valor === 'string' && valor.startsWith(PREFIJO_URL_CLOUDINARY)) return { ok: true, valor };
    return { ok: false, mensaje: `${nombreCampo} debe ser una URL de Cloudinary válida (empezar con ${PREFIJO_URL_CLOUDINARY}).` };
}

<<<<<<< HEAD
=======
// Igual que validarUrlCloudinaria pero para un arreglo de URLs (adjuntos de un Reporte de
// Evento: fotos, video, documentos) — cada elemento debe ser una URL de Cloudinary válida.
function validarUrlsCloudinariaArray(valor, nombreCampo) {
    if (valor === undefined || valor === null) return { ok: true, valor: [] };
    if (!Array.isArray(valor)) return { ok: false, mensaje: `${nombreCampo} debe ser una lista de URLs.` };
    const limpio = [];
    for (const item of valor) {
        const chk = validarUrlCloudinaria(item, nombreCampo);
        if (!chk.ok) return chk;
        if (chk.valor) limpio.push(chk.valor);
    }
    return { ok: true, valor: limpio };
}

// Valida el formato del correo del remitente en POST /api/solicitudes (buzón público, sin
// autenticación) antes de usarlo en el "to:" de nodemailer, que separa direcciones por coma
// en un string de "to". Es una validación simple a propósito (no intenta ser 100% RFC 5322):
// solo rechaza lo que permitiría inyectar más de un destinatario o caracteres de control.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
const FORMATO_CORREO_SIMPLE = /^[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+$/;
function validarFormatoCorreo(valor) {
    return typeof valor === 'string' && FORMATO_CORREO_SIMPLE.test(valor.trim());
}

function escapeHtmlServidor(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function resolverIdInsumoParaEvento(cliente, item) {
    if (item.id && item.id !== 'otro') return item.id;
    if (!item.nombre_otro || !item.nombre_otro.trim()) return null;
    const nuevo = await cliente.query(
        `INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
         VALUES ($1, 'Unidad', $2, 0, NULL, 'Evento') RETURNING id_insumo`,
        [item.nombre_otro.trim(), item.cant || 0]
    );
    return nuevo.rows[0].id_insumo;
}

const emailTemplate = (titulo, contenido, subtitulo = "Construyendo comunidad paso a paso") => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #020617; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1);" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="height: 8px; width: 100%; background: linear-gradient(90deg, #e6007e 0%, #f39200 50%, #43b02a 75%, #0072ce 100%);"></td>
          </tr>
          <tr>
            <td align="center" style="padding: 32px 24px 16px 24px; background: linear-gradient(180deg, #fdf2f7 0%, #fff8f0 40%, #ffffff 100%); border-bottom: 1px solid #f1f5f9;">
              <img src="https://sumandovoluntadesensanctorum.org/assets/Logo.png" alt="Sumando Voluntades en Sanctórum A.C." style="max-width: 190px; width: 100%; height: auto; display: block; margin: 0 auto 12px auto;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 24px 28px 8px 28px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.25;">
                ${titulo}
              </h2>
              <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; color: #f39200; text-transform: uppercase; letter-spacing: 1px;">
                ${subtitulo}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 28px 24px 28px; font-size: 14px; line-height: 1.6; color: #334155;">
              ${contenido}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 28px 28px 28px;">
              <a href="https://sumandovoluntadesensanctorum.org" target="_blank" style="display: block; width: 100%; max-width: 320px; box-sizing: border-box; background: linear-gradient(90deg, #e6007e 0%, #b50062 100%); color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-align: center; box-shadow: 0 4px 14px rgba(230, 0, 126, 0.3);">
                Conocer más sobre nuestro impacto →
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 20px 28px; border-top: 1px solid #f1f5f9; background-color: #fafaf9;">
              <p style="margin: 0; font-size: 14px; font-weight: 700; font-style: italic; color: #b50062;">
                "Sumando Voluntades en Sanctórum"
              </p>
              <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #64748b;">
                Comité Directivo & Equipo Comunitario
              </p>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">
                Avenida Cholula #14 B, Cuautlancingo, México, C.P. 72730
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 20px 24px; background-color: #0b1120; color: #94a3b8; font-size: 11px; line-height: 1.5;">
              <p style="margin: 0 0 8px 0; color: #cbd5e1;">
                Notificación oficial emitida por <strong style="color: #ffffff;">Sumando Voluntades en Sanctórum A.C.</strong>
              </p>
              <p style="margin: 0; font-size: 10px; color: #64748b;">
                © 2026 Sumando Voluntades Sanctórum A.C. · Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const HASH_SEÑUELO_TIMING = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
app.post('/api/auth/login', async (req, res) => {
    const { correo, contraseña } = req.body;
    const credencialesInvalidas = () => res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
    try {
        const result = await pool.query('SELECT * FROM Usuarios WHERE correo = $1', [correo]);
        if (result.rows.length === 0) {
            await bcrypt.compare(contraseña || '', HASH_SEÑUELO_TIMING);
            return credencialesInvalidas();
        }

        const usuario = result.rows[0];
        const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);
        if (!contraseñaValida) return credencialesInvalidas();

        if (usuario.estatus === 'Inactivo') return res.status(401).json({ success: false, message: 'Cuenta desactivada.' });
        if (usuario.estatus === 'Nuevo' || usuario.estatus === 'Entrevista') return res.status(401).json({ success: false, message: 'Tu perfil sigue en revisión.' });

        const token = jwt.sign({ id: usuario.id_usuario, rol: usuario.id_rol, nombre: usuario.nombre_completo, correo: usuario.correo, especialidad: usuario.especialidad }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, token, usuario: { nombre: usuario.nombre_completo, rol: usuario.id_rol } });
    } catch (err) {
        console.error(">>> ERROR EXACTO EN LOGIN:", err);
        res.status(500).json({ success: false, message: err.message || 'Error de servidor.' });
    }
});

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No autenticado. Falta el token de acceso.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
        if (err) return res.status(403).json({ success: false, message: 'Token inválido o expirado. Vuelve a iniciar sesión.' });
        req.usuario = usuario;
        next();
    });
}

<<<<<<< HEAD
=======
// Igual que verificarToken, pero para rutas públicas que cambian de comportamiento si quien
// pregunta ya está identificado (ej. /api/publicaciones filtrando por autor desde el panel).
// No bloquea la petición: si no hay token, o es inválido/expiró, simplemente devuelve null.
function usuarioOpcional(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return null;
    }
}

// Roles: 1=Admin, 2=Especialista, 3=Coordinador, 4=Voluntario, 5=Donador
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
const ROL_ADMIN = 1, ROL_ESPECIALISTA = 2, ROL_COORDINADOR = 3, ROL_VOLUNTARIO = 4;

function esPsicologo(usuario) {
    return usuario.rol === ROL_ESPECIALISTA && (usuario.especialidad || '').toLowerCase().includes('psic');
}

function puedePublicarHistoria(usuario) {
    return usuario.rol === ROL_ADMIN || usuario.rol === ROL_COORDINADOR || esPsicologo(usuario);
}

function estatusDocPorRol(idRol) {
    const rolNum = parseInt(idRol, 10);
    return (rolNum === ROL_ESPECIALISTA || rolNum === ROL_COORDINADOR) ? 'Pendiente' : 'No Aplica';
}

function requiereRol(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para realizar esta acción.' });
        }
        next();
    };
}

<<<<<<< HEAD
=======
// Exige que, si el usuario no es Admin, su req.usuario.id coincida con el id_especialista
// asignado al beneficiario del :id de la ruta — un Especialista solo puede leer/editar el
// expediente clinico de sus propios pacientes.
async function verificarOwnershipExpediente(req, res, next) {
    // Coordinador tiene acceso completo al módulo de Expedientes, igual que Admin.
    if (req.usuario && (req.usuario.rol === ROL_ADMIN || req.usuario.rol === ROL_COORDINADOR)) return next();
    try {
        const result = await pool.query('SELECT id_especialista FROM Beneficiarios WHERE id_beneficiario = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
        const idEspecialistaAsignado = result.rows[0].id_especialista;
        if (idEspecialistaAsignado === null || Number(idEspecialistaAsignado) !== Number(req.usuario.id)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para acceder a este expediente.' });
        }
        next();
    } catch (error) {
        console.error('Error al verificar propiedad del expediente:', error);
        res.status(500).json({ success: false });
    }
}

// Genera un middleware para rutas de una sola tabla que exige ser el autor original
// (comparado por columnaAutor) o un Admin, para PUT/DELETE. Publicaciones/Historias_Exito, al
// tener dos tablas posibles segun el body/query, resuelven esto en linea dentro del propio
// handler en vez de usar este helper (ver mas abajo).
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
function verificarAutorORol(tabla, columnaId, columnaAutor) {
    return async (req, res, next) => {
        if (req.usuario && req.usuario.rol === ROL_ADMIN) return next();
        try {
            const result = await pool.query(`SELECT ${columnaAutor} AS id_autor FROM ${tabla} WHERE ${columnaId} = $1`, [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
            if (Number(result.rows[0].id_autor) !== Number(req.usuario.id)) {
                return res.status(403).json({ success: false, message: 'Solo el autor original o un Admin pueden modificar este registro.' });
            }
            next();
        } catch (error) {
            console.error(`Error al verificar autor en ${tabla}:`, error);
            res.status(500).json({ success: false });
        }
    };
}

const MENSAJE_RECUPERAR_GENERICO = { success: true, message: 'Si el correo está registrado, en unos minutos llegarán las instrucciones para recuperar el acceso.' };
app.post('/api/auth/recuperar', async (req, res) => {
    const { correo } = req.body;
    try {
        const userRes = await pool.query('SELECT id_usuario, nombre_completo FROM Usuarios WHERE correo = $1', [correo]);
        if (userRes.rows.length === 0) return res.json(MENSAJE_RECUPERAR_GENERICO);

        const voluntario = userRes.rows[0];
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10));

        await pool.query('UPDATE Usuarios SET contraseña = $1 WHERE id_usuario = $2', [hashedPassword, voluntario.id_usuario]);

        const contenidoCorreo = `<p>Hola <b>${voluntario.nombre_completo}</b>,</p><p>Tu nueva contraseña temporal es: <span style="background: #ffd9e2; padding: 3px 8px; border-radius: 5px; font-family: monospace; font-size: 16px;">${tempPassword}</span></p><p>Cámbiala inmediatamente al iniciar sesión.</p>`;
        
<<<<<<< HEAD
        await transporter.sendMail({ 
            from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`, 
            to: correo, 
            subject: 'Recuperación de Acceso', 
            html: emailTemplate('Restablecimiento', contenidoCorreo) 
        });

=======
        // Respondemos primero (el mensaje es siempre el mismo, exista o no la cuenta) y
        // el correo real se envía después, sin bloquear la respuesta.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
        res.json(MENSAJE_RECUPERAR_GENERICO);
        enviarCorreoAsync({
            from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Recuperación de Acceso',
            html: emailTemplate('Restablecimiento', contenidoCorreo)
        }, 'recuperar contraseña');
    } catch (err) { 
        console.error("ERROR DE GMAIL AL RECUPERAR:", err);
        res.status(500).json({ success: false }); 
    }
});

app.put('/api/auth/cambiar-password', verificarToken, async (req, res) => {
    const { password_actual, password_nueva } = req.body;
    try {
        const result = await pool.query('SELECT * FROM Usuarios WHERE id_usuario = $1', [req.usuario.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

        const usuario = result.rows[0];
        const isValid = await bcrypt.compare(password_actual, usuario.contraseña);
        if (!isValid) return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta.' });

        const salt = await bcrypt.genSalt(10);
        const hashedNueva = await bcrypt.hash(password_nueva, salt);

        await pool.query('UPDATE Usuarios SET contraseña = $1 WHERE id_usuario = $2', [hashedNueva, req.usuario.id]);
        res.json({ success: true, message: 'Contraseña actualizada.' });
    } catch (error) { res.status(500).json({ success: false }); }
});

<<<<<<< HEAD
=======
// ==========================================
// MÓDULO DE VOLUNTARIADO Y DONADORES
// ==========================================

// Separa el texto compuesto "<cantidad> <unidad>" (p. ej. "25 Lt") que manda el formulario de
// Donadores del panel (ver extraerCantidad() en voluntariado.html) en las dos partes reales que
// alimentan Usuarios.cantidad_donada_valor (NUMERIC) y Usuarios.cantidad_donada_unidad (VARCHAR)
// -- ver migracion_usuarios_cantidad_donada_split_v1.sql. Nunca lanza: si el texto no trae un
// número reconocible al inicio, valor queda en null y el resto del guardado sigue su curso
// normal (Usuarios.cantidad_donada, la columna de texto original, se sigue llenando igual que
// siempre como caché de compatibilidad).
function parsearCantidadDonada(cantidadStr) {
    const texto = (cantidadStr || '').trim();
    if (!texto) return { valor: null, unidad: null };
    const partes = texto.split(/\s+/);
    const numero = parseFloat(partes[0]);
    return {
        valor: Number.isFinite(numero) ? numero : null,
        unidad: partes[1] || null
    };
}

// 1. REGISTRAR NUEVO USUARIO (Con correo de confirmación de recibido)
// Ruta publica (autorregistro de voluntarios/donadores desde como_ayudar), tambien usada por
// el panel de Admin para dar de alta Coordinadores/Especialistas (voluntariado). Solo un
// Admin/Coordinador con sesion valida puede pedir un rol de staff (2=Especialista,
// 3=Coordinador); cualquier otro caso (publico, anonimo, o rol invalido) siempre cae a
// Voluntario (4), salvo que pida explicitamente Donador (5). Nunca se permite crear un Admin
// (1) por esta via, ni siquiera autenticado.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.post('/api/usuarios', async (req, res) => {
    const { nombre_completo, correo, telefono, especialidad, material, cantidad } = req.body;
    const usuarioSolicitante = usuarioOpcionalDesdeToken(req);
    const esStaffPrivilegiado = !!usuarioSolicitante && (usuarioSolicitante.rol === ROL_ADMIN || usuarioSolicitante.rol === ROL_COORDINADOR);
    const rolPedido = parseInt(req.body.id_rol, 10);
    const rolesPermitidosStaff = [ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO, 5];
    const rolesPermitidosPublico = [ROL_VOLUNTARIO, 5];
    let id_rol;
    if (esStaffPrivilegiado && rolesPermitidosStaff.includes(rolPedido)) id_rol = rolPedido;
    else if (rolesPermitidosPublico.includes(rolPedido)) id_rol = rolPedido;
    else id_rol = ROL_VOLUNTARIO;
    try {
        const userExist = await pool.query('SELECT * FROM Usuarios WHERE correo = $1', [correo]);
        if (userExist.rows.length > 0) return res.status(400).json({ success: false, message: 'Este correo ya está registrado.' });

        const placeholderHash = await bcrypt.hash('pendiente_aprobacion', 10);
        const donacionInicial = parsearCantidadDonada(cantidad);
        await pool.query(
            `INSERT INTO Usuarios (nombre_completo, correo, telefono, especialidad, contraseña, id_rol, estatus, material_donado, cantidad_donada, cantidad_donada_valor, cantidad_donada_unidad, documento_profesional_estatus)
             VALUES ($1, $2, $3, $4, $5, $6, 'Nuevo', $7, $8, $9, $10, $11)`,
            [nombre_completo, correo, telefono, especialidad, placeholderHash, id_rol, material, cantidad, donacionInicial.valor, donacionInicial.unidad, estatusDocPorRol(id_rol)]
        );

        const contenidoRegistro = `
            <p style="margin-top: 0; font-size: 15px;">Hola <strong style="color: #b50062;">${escapeHtmlServidor(nombre_completo)}</strong>,</p>
            <p>Hemos recibido con entusiasmo tu solicitud para formar parte de <strong>Sumando Voluntades Sanctórum</strong>. Nos alegra profundamente contar con personas comprometidas y dispuestas a aportar su energía a nuestras causas sociales.</p>
            
            <div style="margin: 20px 0; padding: 16px; border-radius: 16px; background-color: #fffbeb; border: 1px solid #fde68a;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="42" valign="top">
                    <div style="width: 36px; height: 36px; background-color: #f59e0b; border-radius: 10px; text-align: center; line-height: 36px; color: #ffffff; font-size: 18px;">
                      ⏱
                    </div>
                  </td>
                  <td style="padding-left: 12px;" valign="top">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Estatus de Solicitud</span>
                      <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background-color: #fde68a; color: #78350f; font-size: 10px; font-weight: 700;">En Revisión</span>
                    </div>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #78350f; line-height: 1.4;">
                      Actualmente tu perfil y documentación se encuentran en evaluación por nuestro equipo de coordinación.
                    </p>
                  </td>
                </tr>
              </table>
            </div>

            <p style="margin-bottom: 12px;">Nos pondremos en contacto contigo muy pronto a través de este medio o vía telefónica para darte seguimiento personalizado.</p>
            
            <div style="padding: 12px 16px; border-radius: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
              📅 Tiempo estimado de respuesta: <strong style="color: #0f172a;">24 a 48 horas hábiles</strong>.
            </div>
        `;

        res.status(201).json({ success: true });
        enviarCorreoAsync({
            from: `"Sumando Voluntades Sanctórum" <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Solicitud Recibida - Sumando Voluntades Sanctórum',
            html: emailTemplate('¡Gracias por tu interés!', contenidoRegistro, 'Construyendo comunidad paso a paso')
        }, 'confirmación de registro de voluntario');
    } catch (error) { 
        console.error("ERROR DE GMAIL AL REGISTRAR:", error);
        res.status(500).json({ success: false }); 
    }
});

app.get('/api/voluntarios', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const incluirCoordinadores = req.usuario.rol === ROL_ADMIN;
        const filtroRoles = incluirCoordinadores ? '(u.id_rol = 4 OR u.id_rol = 2 OR u.id_rol = 5 OR u.id_rol = 3)' : '(u.id_rol = 4 OR u.id_rol = 2 OR u.id_rol = 5)';
        const query = `
            SELECT u.id_usuario, u.nombre_completo, u.correo, u.telefono, u.id_rol, u.especialidad, COALESCE(u.estatus, 'Nuevo') as estatus,
            u.fecha_registro, u.material_donado, u.cantidad_donada, u.foto_perfil_url,
            u.documento_profesional_url, COALESCE(u.documento_profesional_estatus, 'Pendiente') as documento_profesional_estatus,
            COALESCE((SELECT string_agg(e.titulo_evento, ', ') FROM Participacion p JOIN Eventos e ON p.id_evento = e.id_evento WHERE p.id_usuario = u.id_usuario), '') as proyectos
            FROM Usuarios u WHERE ${filtroRoles} ORDER BY u.id_usuario DESC
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/proyectos', async (req, res) => {
    try {
        const result = await pool.query("SELECT id_evento, titulo_evento FROM Eventos WHERE tipo_evento != 'Entrevista' ORDER BY fecha_realizacion DESC");
        res.json({ success: true, data: result.rows });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/beneficiarios', verificarToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT id_beneficiario, nombre_completo FROM Beneficiarios ORDER BY nombre_completo ASC");
        res.json({ success: true, data: result.rows });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/entrevistas', async (req, res) => {
    const { id_usuario, correo, nombre, fecha, hora, link } = req.body;
    try {
        const userRes = await pool.query('SELECT estatus FROM Usuarios WHERE id_usuario = $1', [id_usuario]);
        const estatusActual = userRes.rows.length > 0 ? userRes.rows[0].estatus : 'Nuevo';
        const esReagendada = (estatusActual === 'Entrevista');

        const fecha_timestamp = `${fecha} ${hora}:00`;
        await pool.query("INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion) VALUES ($1, 'Entrevista', $2)", [`Entrevista - ${nombre}`, fecha_timestamp]);
        await pool.query("UPDATE Usuarios SET estatus = 'Entrevista' WHERE id_usuario = $1", [id_usuario]);

        const tituloCorreo = esReagendada ? 'Actualización de Entrevista' : 'Entrevista Programada';
        const textoIntro = esReagendada 
            ? `<p>Hola <b>${nombre}</b>,</p><p>Tu entrevista para unirte a Sanctorum A.C. ha sido <b>reagendada</b> exitosamente.</p>`
            : `<p>Hola <b>${nombre}</b>,</p><p>¡Avanzamos al siguiente paso! Hemos agendado una entrevista para conocerte mejor y platicar sobre tu integración a Sanctorum A.C.</p>`;

        const contenidoCorreo = `
            ${textoIntro}
            <div style="background-color: #f9f2f6; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #b50062;">
                <h4 style="margin-top: 0; color: #b50062;">Detalles de la videollamada:</h4>
                <p style="margin-bottom: 5px;"><b>Fecha:</b> ${fecha}</p>
                <p style="margin-bottom: 5px;"><b>Hora:</b> ${hora} hrs</p>
                <p style="margin: 0;"><b>Enlace:</b> <a href="${link}" style="color: #b50062; font-weight: bold; text-decoration: underline;">Unirse a la Entrevista</a></p>
            </div>
            <p>Por favor, sé puntual y asegúrate de tener una conexión estable a internet.</p>
            <p style="font-style: italic; color: #877362; text-align: center; margin-top: 30px;">"Sumando Voluntades"</p>
        `;

<<<<<<< HEAD
        await transporter.sendMail({
=======
        // 4. Respondemos ya (lo importante — el evento y el estatus del usuario — quedó
        // guardado) y el correo se envía después, sin bloquear al botón que disparó esto.
        res.json({ success: true });
        enviarCorreoAsync({
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: tituloCorreo + ' - Sanctorum A.C.',
            html: emailTemplate(tituloCorreo, contenidoCorreo)
        }, 'entrevista agendada');
    } catch (err) {
        console.error("ERROR AL AGENDAR ENTREVISTA:", err);
        res.status(500).json({ success: false });
    }
});

app.put('/api/voluntarios/:id/asignar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { id_proyecto, id_rol, especialidad, material, cantidad } = req.body;
    const { id } = req.params;
    try {
        const userRes = await pool.query("SELECT nombre_completo, correo FROM Usuarios WHERE id_usuario = $1", [id]);
        const voluntario = userRes.rows[0];

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10));

        const donacionAsignar = parsearCantidadDonada(cantidad);
        await pool.query(
            "UPDATE Usuarios SET estatus = 'Activo', contraseña = $1, id_rol = $2, especialidad = $3, material_donado = $4, cantidad_donada = $5, cantidad_donada_valor = $6, cantidad_donada_unidad = $7, documento_profesional_estatus = $8 WHERE id_usuario = $9",
            [hashedPassword, id_rol, especialidad, material, cantidad, donacionAsignar.valor, donacionAsignar.unidad, estatusDocPorRol(id_rol), id]
        );
        
        if (id_proyecto && id_proyecto !== "0" && id_rol !== 5) {
            await pool.query("INSERT INTO Participacion (id_evento, id_usuario, horas_invertidas) VALUES ($1, $2, 0)", [id_proyecto, id]);
        }

        const contenidoCorreo = `
            <p>Hola <b>${voluntario.nombre_completo}</b>,</p>
            <p>Nos emociona informarte que tu perfil ha sido aprobado. Oficialmente eres parte de la familia Sanctorum.</p>
            <div style="background-color: #f9f2f6; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #b50062;">
                <h4 style="margin-top: 0; color: #b50062;">Tus Credenciales Institucionales:</h4>
                <p style="margin-bottom: 5px;"><b>Correo:</b> ${voluntario.correo}</p>
                <p style="margin: 0;"><b>Contraseña temporal:</b> <span style="background: #ffd9e2; padding: 3px 8px; border-radius: 5px; font-family: monospace; font-size: 16px;">${tempPassword}</span></p>
            </div>
            <p style="font-style: italic; color: #877362; text-align: center;">"Tus habilidades y tu tiempo tienen el poder de transformar realidades."</p>
            <div style="text-align: center; margin-top: 30px;">
                <a href="https://sanctorum-sitio.vercel.app/login" style="background-color: #b50062; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block;">Ingresar a mi Perfil</a>
            </div>
        `;

        // El perfil ya quedó activado y guardado; respondemos de inmediato para que el
        // botón "Aprobar" no se quede esperando al envío del correo con las credenciales
        // (Gmail puede tardar varios segundos). El correo se manda justo después, en segundo plano.
        res.json({ success: true });
        enviarCorreoAsync({
            from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
            to: voluntario.correo,
            subject: '¡Felicidades! Eres oficialmente parte de Sanctorum A.C.',
            html: emailTemplate('¡Bienvenido al Equipo!', contenidoCorreo)
        }, 'credenciales de voluntario aprobado');
    } catch(err) {
        console.error("Error al aprobar:", err);
        res.status(500).json({ success: false });
    }
});

app.put('/api/usuarios/:id/modificar', verificarToken, requiereRol(ROL_ADMIN), async (req, res) => {
    const { id_rol, especialidad, material, cantidad } = req.body;
    try {
        const donacionModificada = parsearCantidadDonada(cantidad);
        await pool.query(
            "UPDATE Usuarios SET id_rol = $1, especialidad = $2, material_donado = $3, cantidad_donada = $4, cantidad_donada_valor = $5, cantidad_donada_unidad = $6, documento_profesional_estatus = $7 WHERE id_usuario = $8",
            [id_rol, especialidad, material, cantidad, donacionModificada.valor, donacionModificada.unidad, estatusDocPorRol(id_rol), req.params.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/usuarios/:id/donaciones', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM Donaciones_Registro WHERE id_usuario = $1 ORDER BY fecha_donacion DESC',
            [req.params.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar donaciones del usuario:", error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/usuarios/:id/donaciones', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { material, cantidad, unidad } = req.body;
    if (!material || !cantidad) return res.status(400).json({ success: false, message: 'Material y cantidad son obligatorios.' });
    try {
        await pool.query(
            'INSERT INTO Donaciones_Registro (id_usuario, material, cantidad, unidad) VALUES ($1, $2, $3, $4)',
            [req.params.id, material, cantidad, unidad || null]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        console.error("Error al registrar donación:", error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/usuarios/:id/participacion', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        await pool.query("INSERT INTO Participacion (id_evento, id_usuario, horas_invertidas) VALUES ($1, $2, 0)", [req.body.id_evento, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.delete('/api/usuarios/:id', verificarToken, requiereRol(ROL_ADMIN), async (req, res) => {
    try {
        await pool.query("DELETE FROM Usuarios WHERE id_usuario = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.put('/api/usuarios/:id/inactivo', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        await pool.query("UPDATE Usuarios SET estatus = 'Inactivo' WHERE id_usuario = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.put('/api/usuarios/:id/reactivar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        await pool.query("UPDATE Usuarios SET estatus = 'Activo' WHERE id_usuario = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/usuarios/pendientes_revision', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id_usuario, u.nombre_completo, u.correo, u.especialidad, r.nombre_rol, u.documento_profesional_url
            FROM Usuarios u LEFT JOIN Roles r ON u.id_rol = r.id_rol
            WHERE u.documento_profesional_estatus = 'Pendiente' AND u.documento_profesional_url IS NOT NULL
            ORDER BY u.id_usuario DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar documentos pendientes:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/usuarios/:id', verificarToken, async (req, res) => {
    const idNum = parseInt(req.params.id, 10);
    if (isNaN(idNum)) return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
    try {
        const result = await pool.query(`
            SELECT u.id_usuario, u.nombre_completo, u.correo, u.telefono, u.especialidad,
                   u.edad, u.genero,
                   COALESCE(u.estatus, 'Activo') AS estatus, u.fecha_registro,
                   u.id_rol, r.nombre_rol,
                   u.foto_perfil_url, u.documento_profesional_url, u.biografia,
                   COALESCE(u.documento_profesional_estatus, 'Pendiente') AS documento_profesional_estatus,
                   u.documento_fecha_revision
            FROM Usuarios u
            LEFT JOIN Roles r ON u.id_rol = r.id_rol
            WHERE u.id_usuario = $1
        `, [idNum]);

        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Error al obtener perfil de usuario:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.put('/api/usuarios/:id/perfil', verificarToken, async (req, res) => {
    const idObjetivo = parseInt(req.params.id, 10);
    if (req.usuario.rol !== ROL_ADMIN && req.usuario.id !== idObjetivo) {
        return res.status(403).json({ success: false, message: 'No puedes editar el perfil de otro usuario.' });
    }
    const { telefono, biografia, nombre_completo, edad, genero } = req.body;
    // Auditoría de seguridad: especialidad y correo NO se aceptan de un usuario editando su
    // propio perfil. especialidad determina permisos reales (si contiene "psic" da acceso a
    // Expedientes y Citas Clínicas vía esPsicologo()), así que cualquiera podía auto-asignarse
    // ese acceso con solo escribir "Psicología" en su perfil. correo es el identificador de
    // login y lo asigna la organización, no debe poder cambiarlo el propio usuario. Solo un
    // Admin puede tocar estos dos campos (aquí mismo, editando el perfil de otro usuario, o
    // desde Gestión de Voluntariado vía /api/usuarios/:id/modificar).
    const especialidad = req.usuario.rol === ROL_ADMIN ? req.body.especialidad : undefined;
    const correo = req.usuario.rol === ROL_ADMIN ? req.body.correo : undefined;
    try {
        let correoCambiado = false;
        if (correo) {
            const actual = await pool.query('SELECT correo FROM Usuarios WHERE id_usuario = $1', [req.params.id]);
            if (actual.rows.length > 0 && actual.rows[0].correo !== correo) {
                correoCambiado = true;
            }
        }
        await pool.query(
            `UPDATE Usuarios SET nombre_completo = COALESCE($1, nombre_completo), correo = COALESCE($2, correo),
                telefono = COALESCE($3, telefono), especialidad = COALESCE($4, especialidad), biografia = COALESCE($5, biografia),
                edad = COALESCE($6, edad), genero = COALESCE($7, genero)
             WHERE id_usuario = $8`,
            [nombre_completo || null, correo || null, telefono || null, especialidad || null, biografia || null, edad || null, genero || null, req.params.id]
        );
        res.json({ success: true, correo_cambiado: correoCambiado });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Ese correo ya está en uso por otro usuario.' });
        }
        console.error("Error al actualizar perfil:", error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/usuarios/:id/foto', verificarToken, async (req, res) => {
    const idObjetivoFoto = parseInt(req.params.id, 10);
    if (req.usuario.rol !== ROL_ADMIN && req.usuario.id !== idObjetivoFoto) {
        return res.status(403).json({ success: false, message: 'No puedes cambiar la foto de otro usuario.' });
    }
    const { foto_perfil_url } = req.body;
    if (!foto_perfil_url) return res.status(400).json({ success: false, message: 'Falta la URL de la foto.' });
    const chkFoto = validarUrlCloudinaria(foto_perfil_url, 'foto_perfil_url');
    if (!chkFoto.ok) return res.status(400).json({ success: false, message: chkFoto.mensaje });
    try {
        await pool.query('UPDATE Usuarios SET foto_perfil_url = $1 WHERE id_usuario = $2', [chkFoto.valor, req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Error al guardar foto de perfil:", error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/usuarios/:id/documento_profesional', verificarToken, async (req, res) => {
    const idObjetivoDoc = parseInt(req.params.id, 10);
    if (req.usuario.rol !== ROL_ADMIN && req.usuario.id !== idObjetivoDoc) {
        return res.status(403).json({ success: false, message: 'No puedes subir el documento profesional de otro usuario.' });
    }
    const { documento_profesional_url } = req.body;
    if (!documento_profesional_url) return res.status(400).json({ success: false, message: 'Falta la URL del documento.' });
    const chkDoc = validarUrlCloudinaria(documento_profesional_url, 'documento_profesional_url');
    if (!chkDoc.ok) return res.status(400).json({ success: false, message: chkDoc.mensaje });
    try {
        const userRes = await pool.query('SELECT id_rol, nombre_completo FROM Usuarios WHERE id_usuario = $1', [req.params.id]);
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        const usuarioDoc = userRes.rows[0];
        if (usuarioDoc.id_rol !== 2 && usuarioDoc.id_rol !== 3) {
            return res.status(403).json({ success: false, message: 'Solo Especialistas y Coordinadores necesitan subir documento profesional.' });
        }
        await pool.query(
            `UPDATE Usuarios SET documento_profesional_url = $1, documento_profesional_estatus = 'Pendiente',
                documento_revisado_por = NULL, documento_fecha_revision = NULL WHERE id_usuario = $2`,
            [chkDoc.valor, req.params.id]
        );

        try {
            const revisores = await pool.query(
                "SELECT correo FROM Usuarios WHERE id_rol IN (1, 3) AND correo IS NOT NULL AND COALESCE(estatus,'Activo') != 'Inactivo'"
            );
            const correos = revisores.rows.map(r => r.correo).filter(Boolean);
            if (correos.length > 0) {
                const contenidoAviso = `
                    <p>Hola,</p>
                    <p><b>${usuarioDoc.nombre_completo}</b> subió su documento profesional y está esperando revisión.</p>
                    <p>Entra a tu Perfil dentro de la plataforma para aprobarlo o rechazarlo.</p>
                `;
                console.log(`Aviso de documento pendiente enviado a: ${correos.join(', ')}`);
                enviarCorreoAsync({
                    from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
                    to: correos.join(','),
                    subject: 'Documento profesional pendiente de revisión - Sanctorum A.C.',
                    html: emailTemplate('Nuevo documento por revisar', contenidoAviso)
<<<<<<< HEAD
                });
=======
                }, 'aviso de documento pendiente');
            } else {
                console.log('Aviso de documento pendiente: no hay ningún Admin/Coordinador con correo registrado, no se envió nada.');
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            }
        } catch (mailErr) {
            console.error("No se pudo preparar el aviso de documento pendiente:", mailErr);
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error al guardar documento profesional:", error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/usuarios/:id/documento_profesional/revisar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { estatus } = req.body;
    if (!['Aprobado', 'Rechazado'].includes(estatus)) {
        return res.status(400).json({ success: false, message: 'Estatus inválido.' });
    }
    try {
        const userRes = await pool.query('SELECT nombre_completo, correo FROM Usuarios WHERE id_usuario = $1', [req.params.id]);
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        await pool.query(
            `UPDATE Usuarios SET documento_profesional_estatus = $1, documento_revisado_por = $2, documento_fecha_revision = CURRENT_TIMESTAMP WHERE id_usuario = $3`,
            [estatus, req.usuario.id, req.params.id]
        );

        try {
            const u = userRes.rows[0];
            const contenidoResultado = estatus === 'Aprobado'
                ? `<p>Hola <b>${u.nombre_completo}</b>,</p><p>Tu documento profesional fue <b>aprobado</b>. Ya tienes acceso completo a la plataforma.</p>`
                : `<p>Hola <b>${u.nombre_completo}</b>,</p><p>Tu documento profesional fue <b>rechazado</b>. Por favor sube uno nuevo desde tu Perfil.</p>`;
            enviarCorreoAsync({
                from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
                to: u.correo,
                subject: 'Resultado de revisión de documento - Sanctorum A.C.',
                html: emailTemplate('Documento profesional revisado', contenidoResultado)
            }, 'resultado de revisión de documento');
        } catch (mailErr) {
            console.error("No se pudo preparar el resultado de revisión:", mailErr);
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error al revisar documento profesional:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/galeria/:tipo/:id', async (req, res) => {
    const { tipo, id } = req.params;
    if (tipo !== 'noticia' && tipo !== 'evento') return res.status(400).json({ success: false, message: 'Tipo inválido.' });
    try {
        const result = await pool.query(
            'SELECT * FROM Galeria_Imagenes WHERE tipo_entidad = $1 AND id_entidad = $2 ORDER BY orden ASC, id_imagen ASC',
            [tipo, id]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar galería:", error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/galeria', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    const { tipo_entidad, id_entidad, url_imagen, orden } = req.body;
    if (!tipo_entidad || !id_entidad || !url_imagen) return res.status(400).json({ success: false, message: 'Faltan datos.' });
    const chkGaleria = validarUrlCloudinaria(url_imagen, 'url_imagen');
    if (!chkGaleria.ok) return res.status(400).json({ success: false, message: chkGaleria.mensaje });
    try {
        const result = await pool.query(
            'INSERT INTO Galeria_Imagenes (tipo_entidad, id_entidad, url_imagen, orden) VALUES ($1, $2, $3, $4) RETURNING id_imagen',
            [tipo_entidad, id_entidad, chkGaleria.valor, orden || 0]
        );
        res.status(201).json({ success: true, id: result.rows[0].id_imagen });
    } catch (error) {
        console.error("Error al agregar imagen a la galería:", error);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/galeria/:id_imagen', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM Galeria_Imagenes WHERE id_imagen = $1', [req.params.id_imagen]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Imagen no encontrada.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar imagen de la galería:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/config/cloudinary', (req, res) => {
    res.json({
        success: true,
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || null,
        upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || null
    });
});

app.get('/api/insumos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Insumos ORDER BY id_insumo DESC');
        res.json({ success: true, data: result.rows });
    } catch (error) { 
        console.error("Error al obtener insumos:", error);
        res.status(500).json({ success: false }); 
    }
});

app.post('/api/insumos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto } = req.body;
    try {
        await pool.query(
            `INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto]
        );
        res.status(201).json({ success: true });
    } catch (error) { 
        console.error("Error al registrar insumo:", error);
        res.status(500).json({ success: false }); 
    }
});

app.put('/api/insumos/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto } = req.body;
    try {
        const result = await pool.query(
            `UPDATE Insumos SET nombre_insumo=$1, unidad_medida=$2, stock_actual=$3, punto_reorden=$4, costo_unitario=$5, area_proyecto=$6 
             WHERE id_insumo=$7`,
            [nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Insumo no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar insumo:", error);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/insumos/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM Insumos WHERE id_insumo = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Insumo no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar insumo:", error);
        res.status(409).json({ success: false, message: 'No se puede eliminar: el insumo ya tiene movimientos registrados en eventos.' });
    }
});

app.get('/api/activos_fijos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id_activo, a.nombre_equipo, a.estado_actual, a.ubicacion, a.id_responsable,
                   COALESCE(u.nombre_completo, 'Sin asignar') AS responsable
            FROM Activos_Fijos a
            LEFT JOIN Usuarios u ON a.id_responsable = u.id_usuario
            ORDER BY a.id_activo DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar activos fijos:", error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/activos_fijos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_equipo, estado_actual, ubicacion, id_responsable } = req.body;
    if (!nombre_equipo) return res.status(400).json({ success: false, message: 'El nombre del equipo es obligatorio.' });
    try {
        await pool.query(
            'INSERT INTO Activos_Fijos (nombre_equipo, estado_actual, ubicacion, id_responsable) VALUES ($1, $2, $3, $4)',
            [nombre_equipo, estado_actual || 'Funcional', ubicacion || null, id_responsable || null]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        console.error("Error al registrar activo fijo:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.put('/api/activos_fijos/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_equipo, estado_actual, ubicacion, id_responsable } = req.body;
    try {
        const result = await pool.query(
            'UPDATE Activos_Fijos SET nombre_equipo=$1, estado_actual=$2, ubicacion=$3, id_responsable=$4 WHERE id_activo=$5',
            [nombre_equipo, estado_actual, ubicacion || null, id_responsable || null, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Activo no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar activo fijo:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.delete('/api/activos_fijos/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM Activos_Fijos WHERE id_activo = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Activo no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar activo fijo:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
=======
// ==========================================
// MÓDULO DE ALIADOS Y DONATIVOS (Contactos_Externos + Donaciones monetarias/en especie
// ligadas a un aliado externo — alimenta /api/transparencia en el sitio público)
// ==========================================
// Por default solo muestra aliados activos (?activo=false para solo archivados,
// ?activo=todas para ambos) — mismo criterio que /api/agenda/directorio_escuelas. Si la
// migración que agrega Contactos_Externos.activo todavía no corrió, se degrada a la
// consulta original (sin esa columna) en vez de tumbar el módulo.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.get('/api/aliados', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    let filtroActivo = true;
    if (req.query.activo === 'false') filtroActivo = false;
    else if (req.query.activo === 'todas') filtroActivo = null;
    try {
        const result = await pool.query(`
            SELECT c.id_contacto, c.nombre_aliado, c.tipo_aliado, c.especialidad, c.id_usuario_enlace,
                   u.nombre_completo AS usuario_enlace, COALESCE(c.activo, TRUE) AS activo
            FROM Contactos_Externos c
            LEFT JOIN Usuarios u ON c.id_usuario_enlace = u.id_usuario
            WHERE ($1::boolean IS NULL OR COALESCE(c.activo, TRUE) = $1)
            ORDER BY c.nombre_aliado ASC
        `, [filtroActivo]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        try {
            const result = await pool.query(`
                SELECT c.id_contacto, c.nombre_aliado, c.tipo_aliado, c.especialidad, c.id_usuario_enlace,
                       u.nombre_completo AS usuario_enlace, TRUE AS activo
                FROM Contactos_Externos c
                LEFT JOIN Usuarios u ON c.id_usuario_enlace = u.id_usuario
                ORDER BY c.nombre_aliado ASC
            `);
            res.json({ success: true, data: result.rows });
        } catch (error2) {
            console.error("Error al listar aliados:", error2);
            res.status(500).json({ success: false });
        }
    }
});

app.post('/api/aliados', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_aliado, tipo_aliado, especialidad, id_usuario_enlace } = req.body;
    if (!nombre_aliado) return res.status(400).json({ success: false, message: 'El nombre del aliado es obligatorio.' });
    try {
        const result = await pool.query(
            'INSERT INTO Contactos_Externos (nombre_aliado, tipo_aliado, especialidad, id_usuario_enlace) VALUES ($1, $2, $3, $4) RETURNING id_contacto',
            [nombre_aliado, tipo_aliado || null, especialidad || null, id_usuario_enlace || null]
        );
        res.status(201).json({ success: true, id: result.rows[0].id_contacto });
    } catch (error) {
        console.error("Error al registrar aliado:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.put('/api/aliados/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_aliado, tipo_aliado, especialidad, id_usuario_enlace } = req.body;
    try {
        const result = await pool.query(
            'UPDATE Contactos_Externos SET nombre_aliado=$1, tipo_aliado=$2, especialidad=$3, id_usuario_enlace=$4 WHERE id_contacto=$5',
            [nombre_aliado, tipo_aliado || null, especialidad || null, id_usuario_enlace || null, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Aliado no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar aliado:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

<<<<<<< HEAD
=======
// Elimina un aliado. Falla con 409 si ya tiene donativos ligados (restricción de FK) — para
// ese caso existe la opción de Archivar, que sí conserva el registro y su historial.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.delete('/api/aliados/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM Contactos_Externos WHERE id_contacto = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Aliado no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar aliado:", error);
        res.status(409).json({ success: false, message: 'No se puede eliminar: el aliado ya tiene donativos registrados. Usa "Archivar" en su lugar.' });
    }
});

// Archiva o reactiva un aliado. Nunca se borra de la base cuando ya tiene historial ligado
// (donativos, etc.): así se conserva ese registro pero deja de ofrecerse como opción activa
// en el selector de "Aliado / Donante" al capturar un donativo nuevo. Mismo patrón que
// /api/escuelas/:id/archivar.
app.put('/api/aliados/:id/archivar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query('UPDATE Contactos_Externos SET activo=$1 WHERE id_contacto=$2', [!!req.body.activo, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Aliado no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al archivar/reactivar aliado:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde. ¿Ya se corrió la migración de aliados?' });
    }
});

<<<<<<< HEAD
=======
// Lista todos los donativos (monetarios o en especie) con el nombre del aliado y, si aplica,
// del insumo relacionado y de quién lo registró.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.get('/api/donativos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        // Con try/catch degradado: si todavía no se corrió la migración que agrega
        // id_usuario_registro, se sirve la lista igual pero sin esa columna (en vez de
        // tumbar el módulo completo).
        try {
            const result = await pool.query(`
                SELECT d.id_donacion, d.monto, d.metodo_pago, d.categoria_gasto, d.comprobante_url, d.fecha_donacion,
                       d.id_contacto, c.nombre_aliado, d.id_insumo, i.nombre_insumo,
                       ur.nombre_completo AS registrado_por
                FROM Donaciones d
                JOIN Contactos_Externos c ON d.id_contacto = c.id_contacto
                LEFT JOIN Insumos i ON d.id_insumo = i.id_insumo
                LEFT JOIN Usuarios ur ON d.id_usuario_registro = ur.id_usuario
                ORDER BY d.fecha_donacion DESC
            `);
            return res.json({ success: true, data: result.rows });
        } catch (colErr) {
            const result = await pool.query(`
                SELECT d.id_donacion, d.monto, d.metodo_pago, d.categoria_gasto, d.comprobante_url, d.fecha_donacion,
                       d.id_contacto, c.nombre_aliado, d.id_insumo, i.nombre_insumo
                FROM Donaciones d
                JOIN Contactos_Externos c ON d.id_contacto = c.id_contacto
                LEFT JOIN Insumos i ON d.id_insumo = i.id_insumo
                ORDER BY d.fecha_donacion DESC
            `);
            return res.json({ success: true, data: result.rows });
        }
    } catch (error) {
        console.error("Error al listar donativos:", error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/donativos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { id_contacto, contacto_nuevo, id_insumo, insumo_nuevo, monto, metodo_pago, categoria_gasto, comprobante_url, fecha_donacion } = req.body;
    if ((!id_contacto && !(contacto_nuevo && contacto_nuevo.trim())) || !monto) {
        return res.status(400).json({ success: false, message: 'El aliado (o su nombre, si es nuevo) y el monto son obligatorios.' });
    }
    const chkComprobante = validarUrlCloudinaria(comprobante_url, 'comprobante_url');
    if (!chkComprobante.ok) return res.status(400).json({ success: false, message: chkComprobante.mensaje });
    try {
        let idContactoFinal = id_contacto || null;
        if (!idContactoFinal && contacto_nuevo && contacto_nuevo.trim()) {
            const nuevoContacto = await pool.query(
                `INSERT INTO Contactos_Externos (nombre_aliado, tipo_aliado) VALUES ($1, 'Donante Individual') RETURNING id_contacto`,
                [contacto_nuevo.trim()]
            );
            idContactoFinal = nuevoContacto.rows[0].id_contacto;
        }
        let idInsumoFinal = id_insumo || null;
        if (!idInsumoFinal && insumo_nuevo && insumo_nuevo.trim()) {
            const nuevo = await pool.query(
                `INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
                 VALUES ($1, 'Unidad', 0, 0, NULL, 'Donativo') RETURNING id_insumo`,
                [insumo_nuevo.trim()]
            );
            idInsumoFinal = nuevo.rows[0].id_insumo;
        }
        // Igual que arriba: si id_usuario_registro todavía no existe (falta la migración),
        // se degrada a insertar sin esa columna en vez de fallar el registro del donativo.
        try {
            await pool.query(
                `INSERT INTO Donaciones (id_contacto, id_insumo, monto, metodo_pago, categoria_gasto, comprobante_url, fecha_donacion, id_usuario_registro)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [idContactoFinal, idInsumoFinal, monto, metodo_pago || null, categoria_gasto || null, chkComprobante.valor, fecha_donacion || new Date().toISOString().slice(0, 10), req.usuario.id]
            );
        } catch (colErr) {
            await pool.query(
                `INSERT INTO Donaciones (id_contacto, id_insumo, monto, metodo_pago, categoria_gasto, comprobante_url, fecha_donacion)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [idContactoFinal, idInsumoFinal, monto, metodo_pago || null, categoria_gasto || null, chkComprobante.valor, fecha_donacion || new Date().toISOString().slice(0, 10)]
            );
        }
        res.status(201).json({ success: true });
    } catch (error) {
        console.error("Error al registrar donativo:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

<<<<<<< HEAD
=======
// Corrige los datos de un donativo ya registrado (por ejemplo, un error de dedo en el
// monto o la fecha). No cambia quién lo registró originalmente (id_usuario_registro se
// conserva): esta ruta es para arreglar errores tipográficos, no para reasignar autoría.
app.put('/api/donativos/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { id_contacto, contacto_nuevo, id_insumo, insumo_nuevo, monto, metodo_pago, categoria_gasto, comprobante_url, fecha_donacion } = req.body;
    if ((!id_contacto && !(contacto_nuevo && contacto_nuevo.trim())) || !monto) {
        return res.status(400).json({ success: false, message: 'El aliado (o su nombre, si es nuevo) y el monto son obligatorios.' });
    }
    const chkComprobante = validarUrlCloudinaria(comprobante_url, 'comprobante_url');
    if (!chkComprobante.ok) return res.status(400).json({ success: false, message: chkComprobante.mensaje });
    try {
        let idContactoFinal = id_contacto || null;
        if (!idContactoFinal && contacto_nuevo && contacto_nuevo.trim()) {
            const nuevoContacto = await pool.query(
                `INSERT INTO Contactos_Externos (nombre_aliado, tipo_aliado) VALUES ($1, 'Donante Individual') RETURNING id_contacto`,
                [contacto_nuevo.trim()]
            );
            idContactoFinal = nuevoContacto.rows[0].id_contacto;
        }
        let idInsumoFinal = id_insumo || null;
        if (!idInsumoFinal && insumo_nuevo && insumo_nuevo.trim()) {
            const nuevo = await pool.query(
                `INSERT INTO Insumos (nombre_insumo, unidad_medida, stock_actual, punto_reorden, costo_unitario, area_proyecto)
                 VALUES ($1, 'Unidad', 0, 0, NULL, 'Donativo') RETURNING id_insumo`,
                [insumo_nuevo.trim()]
            );
            idInsumoFinal = nuevo.rows[0].id_insumo;
        }
        const result = await pool.query(
            `UPDATE Donaciones SET id_contacto=$1, id_insumo=$2, monto=$3, metodo_pago=$4, categoria_gasto=$5, comprobante_url=$6, fecha_donacion=$7
             WHERE id_donacion=$8`,
            [idContactoFinal, idInsumoFinal, monto, metodo_pago || null, categoria_gasto || null, chkComprobante.valor, fecha_donacion || new Date().toISOString().slice(0, 10), req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Donativo no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar donativo:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Elimina un donativo por id.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.delete('/api/donativos/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM Donaciones WHERE id_donacion = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Donativo no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar donativo:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/catalogos_agenda', verificarToken, async (req, res) => {
    try {
        const escuelas = await pool.query('SELECT * FROM Escuelas ORDER BY nombre_escuela ASC');
        const insumos = await pool.query('SELECT * FROM Insumos WHERE stock_actual > 0 ORDER BY nombre_insumo ASC');
        const voluntarios = await pool.query("SELECT id_usuario, nombre_completo, especialidad, id_rol FROM Usuarios WHERE estatus != 'Inactivo' ORDER BY nombre_completo ASC");
<<<<<<< HEAD
        const beneficiarios = await pool.query('SELECT id_beneficiario, nombre_completo, id_especialista FROM Beneficiarios ORDER BY nombre_completo ASC');
        
=======
        // Un psicólogo solo debe ver, para agendar, a los beneficiarios que tiene asignados a
        // su cargo (mismo criterio que /api/agenda/directorio_pacientes). Admin y Coordinador
        // siguen viendo el catálogo completo.
        const beneficiarios = esPsicologo(req.usuario)
            ? await pool.query('SELECT id_beneficiario, nombre_completo FROM Beneficiarios WHERE id_especialista = $1 ORDER BY nombre_completo ASC', [req.usuario.id])
            : await pool.query('SELECT id_beneficiario, nombre_completo FROM Beneficiarios ORDER BY nombre_completo ASC');

>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
        res.json({ success: true, escuelas: escuelas.rows, insumos: insumos.rows, voluntarios: voluntarios.rows, beneficiarios: beneficiarios.rows });
    } catch (error) { console.error("Error catalogos:", error); res.status(500).json({ success: false }); }
});

<<<<<<< HEAD
=======
// ==========================================
// AGENDA: DIRECTORIO DE ESCUELAS Y PACIENTES (Misión 1.5 - restructura según Figma)
// No se crean tablas nuevas: se reutilizan Escuelas, Beneficiarios, Agenda_Visitas y Eventos.
// ==========================================

// Directorio de escuelas (panel lateral izquierdo). Por default solo muestra escuelas
// activas (?activo=false para solo archivadas, ?activo=todas para ambas) — así Agenda,
// que no manda este parámetro, nunca ofrece una escuela archivada para agendar una visita
// nueva.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.get('/api/agenda/directorio_escuelas', async (req, res) => {
    try {
        let filtroActivo = true;
        if (req.query.activo === 'false') filtroActivo = false;
        else if (req.query.activo === 'todas') filtroActivo = null;
        const result = await pool.query(`
            SELECT e.id_escuela, e.nombre_escuela, e.contacto_nombre, e.puesto_contacto, e.telefono_escuela, e.ubicacion,
                   COALESCE(e.activo, TRUE) AS activo, MAX(av.fecha_cita) AS ultima_visita
            FROM Escuelas e
            LEFT JOIN Agenda_Visitas av ON av.id_escuela = e.id_escuela
            WHERE ($1::boolean IS NULL OR COALESCE(e.activo, TRUE) = $1)
            GROUP BY e.id_escuela
            ORDER BY e.nombre_escuela ASC
        `, [filtroActivo]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al obtener directorio de escuelas:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
=======
// Registra una escuela nueva SOLO con sus datos de contacto, sin programar ninguna visita —
// para el registro formal que se hace una vez que la alianza con la escuela ya se concretó
// (a diferencia de Agenda > "Visita de Prospección", que agenda la primera reunión pero no
// sirve para capturar los datos de contacto con calma).
app.post('/api/escuelas', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_escuela, contacto_nombre, puesto_contacto, telefono_escuela, ubicacion } = req.body;
    if (!nombre_escuela || !nombre_escuela.trim()) return res.status(400).json({ success: false, message: 'El nombre de la escuela es obligatorio.' });
    try {
        const existente = await pool.query('SELECT id_escuela FROM Escuelas WHERE LOWER(nombre_escuela) = LOWER($1)', [nombre_escuela.trim()]);
        if (existente.rows.length > 0) return res.status(409).json({ success: false, message: 'Ya existe una escuela registrada con ese nombre.' });
        const result = await pool.query(
            `INSERT INTO Escuelas (nombre_escuela, contacto_nombre, puesto_contacto, telefono_escuela, ubicacion) VALUES ($1, $2, $3, $4, $5) RETURNING id_escuela`,
            [nombre_escuela.trim(), contacto_nombre || null, puesto_contacto || null, telefono_escuela || null, ubicacion || null]
        );
        res.status(201).json({ success: true, id: result.rows[0].id_escuela });
    } catch (error) {
        console.error("Error al registrar escuela:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Actualiza los datos de contacto de una escuela ya registrada.
app.put('/api/escuelas/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { nombre_escuela, contacto_nombre, puesto_contacto, telefono_escuela, ubicacion } = req.body;
    if (!nombre_escuela || !nombre_escuela.trim()) return res.status(400).json({ success: false, message: 'El nombre de la escuela es obligatorio.' });
    try {
        const result = await pool.query(
            `UPDATE Escuelas SET nombre_escuela=$1, contacto_nombre=$2, puesto_contacto=$3, telefono_escuela=$4, ubicacion=$5 WHERE id_escuela=$6`,
            [nombre_escuela.trim(), contacto_nombre || null, puesto_contacto || null, telefono_escuela || null, ubicacion || null, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Escuela no encontrada.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar escuela:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Archiva o reactiva una escuela. Nunca se borra de la base: así se conserva intacto su
// historial de visitas, eventos y beneficiarios ligados. Archivada, deja de aparecer en el
// directorio activo (incluyendo el selector de Agenda para agendar visitas nuevas).
app.put('/api/escuelas/:id/archivar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query('UPDATE Escuelas SET activo=$1 WHERE id_escuela=$2', [!!req.body.activo, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Escuela no encontrada.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al archivar/reactivar escuela:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Fusiona dos escuelas duplicadas (mismo lugar, capturado con escritura distinta) en una
// sola: reasigna Beneficiarios, Eventos y Agenda_Visitas de la escuela duplicada hacia la
// escuela que se conserva, y archiva la duplicada (nunca se borra, igual que /archivar, para
// no perder su nombre del historial). Solo Admin puede fusionar — reescribe varias tablas a
// la vez y no tiene deshacer, así que se deja fuera del alcance normal de Coordinador.
app.post('/api/escuelas/fusionar', verificarToken, requiereRol(ROL_ADMIN), async (req, res) => {
    const id_conservar = parseInt(req.body.id_conservar, 10);
    const id_duplicada = parseInt(req.body.id_duplicada, 10);
    if (!id_conservar || !id_duplicada) {
        return res.status(400).json({ success: false, message: 'Selecciona la escuela que se conserva y la escuela duplicada.' });
    }
    if (id_conservar === id_duplicada) {
        return res.status(400).json({ success: false, message: 'Selecciona dos escuelas distintas.' });
    }
    try {
        await pool.query('BEGIN');
        const existentes = await pool.query('SELECT id_escuela FROM Escuelas WHERE id_escuela IN ($1, $2)', [id_conservar, id_duplicada]);
        if (existentes.rows.length !== 2) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Una de las dos escuelas no existe.' });
        }
        const benef = await pool.query('UPDATE Beneficiarios SET id_escuela=$1 WHERE id_escuela=$2', [id_conservar, id_duplicada]);
        const ev = await pool.query('UPDATE Eventos SET id_escuela=$1 WHERE id_escuela=$2', [id_conservar, id_duplicada]);
        const vis = await pool.query('UPDATE Agenda_Visitas SET id_escuela=$1 WHERE id_escuela=$2', [id_conservar, id_duplicada]);
        await pool.query('UPDATE Escuelas SET activo=FALSE WHERE id_escuela=$1', [id_duplicada]);
        await pool.query('COMMIT');
        res.json({
            success: true,
            resumen: { beneficiarios: benef.rowCount, eventos: ev.rowCount, visitas: vis.rowCount }
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al fusionar escuelas:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Directorio de pacientes/beneficiarios (panel lateral izquierdo)
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.get('/api/agenda/directorio_pacientes', verificarToken, async (req, res) => {
    try {
        const filtrarPropios = esPsicologo(req.usuario);
        const params = [];
        let filtroWhere = '';
        if (filtrarPropios) {
            params.push(req.usuario.id);
            filtroWhere = 'WHERE b.id_especialista = $1';
        }

        const result = await pool.query(`
            SELECT b.id_beneficiario, b.nombre_completo, COALESCE(b.estatus, 'ACTIVO') AS estatus,
                   u.nombre_completo AS especialista, b.id_especialista
            FROM Beneficiarios b
            LEFT JOIN Usuarios u ON b.id_especialista = u.id_usuario
            ${filtroWhere}
            ORDER BY b.nombre_completo ASC
        `, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al obtener directorio de pacientes:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/agenda/escuela/:id/eventos', async (req, res) => {
    try {
        const escuela = await pool.query('SELECT * FROM Escuelas WHERE id_escuela = $1', [req.params.id]);
        if (escuela.rows.length === 0) return res.status(404).json({ success: false, message: 'Escuela no encontrada.' });

        const visitas = await pool.query(`
            SELECT id_visita AS id, 'visita' AS categoria, 'Visita de Prospección' AS titulo,
                   fecha_cita AS fecha, estatus_alerta AS estatus
            FROM Agenda_Visitas WHERE id_escuela = $1
            ORDER BY fecha_cita DESC
        `, [req.params.id]);

        const eventos = await pool.query(`
            SELECT id_evento AS id, 'evento' AS categoria, titulo_evento AS titulo,
                   fecha_realizacion AS fecha, tipo_evento AS estatus
            FROM Eventos WHERE id_escuela = $1 AND tipo_evento NOT IN ('Entrevista', 'Cita Clínica')
            ORDER BY fecha_realizacion DESC
        `, [req.params.id]);

        res.json({
            success: true,
            escuela: escuela.rows[0],
            actividades: [...visitas.rows, ...eventos.rows].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        });
    } catch (error) {
        console.error("Error al obtener eventos de la escuela:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/agenda/paciente/:id/citas', verificarToken, async (req, res) => {
    try {
        const paciente = await pool.query(`
            SELECT b.*, u.nombre_completo AS especialista
            FROM Beneficiarios b
            LEFT JOIN Usuarios u ON b.id_especialista = u.id_usuario
            WHERE b.id_beneficiario = $1
        `, [req.params.id]);
        if (paciente.rows.length === 0) return res.status(404).json({ success: false, message: 'Paciente no encontrado.' });

        const citas = await pool.query(`
            SELECT e.id_evento AS id, e.titulo_evento AS titulo, e.fecha_realizacion AS fecha, e.tipo_evento
            FROM Asistencia_Beneficiarios ab
            JOIN Eventos e ON ab.id_evento = e.id_evento
            WHERE ab.id_beneficiario = $1
            ORDER BY e.fecha_realizacion DESC
        `, [req.params.id]);

        res.json({ success: true, paciente: paciente.rows[0], citas: citas.rows });
    } catch (error) {
        console.error("Error al obtener citas del paciente:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/agenda', verificarToken, async (req, res) => {
    try {
        const u = req.usuario;
        let eventosQuery = `
            SELECT e.id_evento as id, e.titulo_evento as titulo, e.tipo_evento as tipo, e.fecha_realizacion as fecha,
                   COALESCE(esc.nombre_escuela, b.nombre_completo, 'Sede S.A.C.') as lugar, 'evento' as categoria,
                   (SELECT COUNT(*) FROM Participacion p WHERE p.id_evento = e.id_evento) as num_asistentes,
                   (SELECT COUNT(*) FROM Consumo_Insumos ci WHERE ci.id_evento = e.id_evento) as num_insumos,
                   EXISTS(SELECT 1 FROM Participacion p2 WHERE p2.id_evento = e.id_evento AND p2.id_usuario = $1) as ya_asignado
            FROM Eventos e
            LEFT JOIN Escuelas esc ON e.id_escuela = esc.id_escuela
            LEFT JOIN Asistencia_Beneficiarios ab ON e.id_evento = ab.id_evento
            LEFT JOIN Beneficiarios b ON ab.id_beneficiario = b.id_beneficiario
            WHERE e.tipo_evento != 'Entrevista'
        `;
        const eventosParams = [u.id];
        let incluirVisitas = false;
        let filtroVisitas = '';
        const visitasParams = [];

        if (u.rol === ROL_ADMIN) {
            incluirVisitas = true;
        } else if (u.rol === ROL_COORDINADOR) {
<<<<<<< HEAD
            eventosQuery += ` AND e.tipo_evento != 'Cita Clínica'`;
=======
            // Coordinador: NUNCA citas clínicas. Ve los eventos operativos de especialistas,
            // voluntarios, sin responsable capturado (eventos de antes de esta migración), y
            // los suyos propios — pero NO los eventos a cargo de OTRO Coordinador (un
            // coordinador no supervisa a otro coordinador). Solo SUS visitas de prospección.
            eventosQuery += ` AND e.tipo_evento != 'Cita Clínica'
                AND (e.id_responsable IS NULL OR e.id_responsable = $1
                     OR e.id_responsable NOT IN (SELECT id_usuario FROM Usuarios WHERE id_rol = ${ROL_COORDINADOR}))`;
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            incluirVisitas = true;
            filtroVisitas = 'WHERE av.id_usuario_creador = $1';
            visitasParams.push(u.id);
        } else if (esPsicologo(u)) {
            eventosQuery = `
                SELECT e.id_evento as id, e.titulo_evento as titulo, e.tipo_evento as tipo, e.fecha_realizacion as fecha,
                       COALESCE(b.nombre_completo, 'Sede S.A.C.') as lugar, 'evento' as categoria,
                       (SELECT COUNT(*) FROM Participacion p WHERE p.id_evento = e.id_evento) as num_asistentes,
                       0 as num_insumos
                FROM Eventos e
                JOIN Participacion part ON part.id_evento = e.id_evento AND part.id_usuario = $1
                LEFT JOIN Asistencia_Beneficiarios ab ON e.id_evento = ab.id_evento
                LEFT JOIN Beneficiarios b ON ab.id_beneficiario = b.id_beneficiario
                WHERE e.tipo_evento = 'Cita Clínica'
            `;
            incluirVisitas = false;
        } else if (u.rol === ROL_ESPECIALISTA) {
            eventosQuery += ` AND e.tipo_evento != 'Cita Clínica'`;
            incluirVisitas = false;
        } else if (u.rol === ROL_VOLUNTARIO) {
            eventosQuery = `
                SELECT e.id_evento as id, e.titulo_evento as titulo, e.tipo_evento as tipo, e.fecha_realizacion as fecha,
                       COALESCE(esc.nombre_escuela, 'Sede S.A.C.') as lugar, 'evento' as categoria,
                       (SELECT COUNT(*) FROM Participacion p WHERE p.id_evento = e.id_evento) as num_asistentes,
                       (SELECT COUNT(*) FROM Consumo_Insumos ci WHERE ci.id_evento = e.id_evento) as num_insumos,
                       EXISTS(SELECT 1 FROM Participacion p2 WHERE p2.id_evento = e.id_evento AND p2.id_usuario = $1) as ya_asignado
                FROM Eventos e
                LEFT JOIN Escuelas esc ON e.id_escuela = esc.id_escuela
                WHERE e.tipo_evento NOT IN ('Entrevista', 'Cita Clínica')
            `;
            eventosParams.length = 0;
            eventosParams.push(u.id);
            incluirVisitas = false;
        } else {
            return res.json({ success: true, data: [] });
        }

        const ev = await pool.query(eventosQuery, eventosParams);

        let vi = { rows: [] };
        if (incluirVisitas) {
            vi = await pool.query(`
                SELECT av.id_visita as id, 'Visita de Prospección' as titulo, 'Reunión Escolar' as tipo, av.fecha_cita as fecha,
                       esc.nombre_escuela as lugar, esc.id_escuela, 'visita' as categoria, av.estatus_alerta as estatus,
                       av.asistentes_plan, av.asistentes_reales, av.id_evento_ejecucion, 0 as num_asistentes, 0 as num_insumos
                FROM Agenda_Visitas av
                JOIN Escuelas esc ON av.id_escuela = esc.id_escuela
                ${filtroVisitas}
            `, visitasParams);
        }

        const todos = [...ev.rows, ...vi.rows].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
        res.json({ success: true, data: todos });
    } catch (error) { console.error("Error agenda lista:", error); res.status(500).json({ success: false }); }
});

app.post('/api/agenda', verificarToken, async (req, res) => {
    const { tipo_registro, datos } = req.body;
    if (esPsicologo(req.usuario) && tipo_registro !== 'clinica') {
        return res.status(403).json({ success: false, message: 'Como Psicólogo(a) solo puedes agendar Citas Clínicas.' });
    }
<<<<<<< HEAD
=======
    // El especialista de una cita clínica agendada por un psicólogo siempre es él mismo —
    // se ignora cualquier otro id_especialista que venga en el cuerpo — y el beneficiario
    // debe estar asignado a su cargo (mismo criterio que el catálogo del modal).
    if (esPsicologo(req.usuario) && tipo_registro === 'clinica' && datos) {
        datos.id_especialista = req.usuario.id;
        const asignado = await pool.query('SELECT id_especialista FROM Beneficiarios WHERE id_beneficiario = $1', [datos.id_beneficiario]);
        if (asignado.rows.length === 0 || asignado.rows[0].id_especialista !== req.usuario.id) {
            return res.status(403).json({ success: false, message: 'Ese beneficiario no está asignado a tu cargo.' });
        }
    }
    // Valida url_imagen antes de abrir la transaccion.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const chkUrlImagenAgendaPost = validarUrlCloudinaria(datos?.url_imagen, 'url_imagen');
    if (!chkUrlImagenAgendaPost.ok) return res.status(400).json({ success: false, message: chkUrlImagenAgendaPost.mensaje });
    try {
        await pool.query('BEGIN');

        if (tipo_registro === 'visita') {
            const esc = await pool.query(
                "INSERT INTO Escuelas (nombre_escuela, contacto_nombre, puesto_contacto, telefono_escuela, ubicacion) VALUES ($1, $2, $3, $4, $5) RETURNING id_escuela",
                [datos.escuela, datos.contacto, datos.puesto, datos.telefono, datos.ubicacion]
            );
            await pool.query("INSERT INTO Agenda_Visitas (id_escuela, fecha_cita, estatus_alerta, id_usuario_creador, es_prospeccion, asistentes_plan) VALUES ($1, $2, 'Pendiente', $3, TRUE, $4)", 
                [esc.rows[0].id_escuela, `${datos.fecha} ${datos.hora}:00`, req.usuario.id, datos.asistentes_plan || null]);
        } 
        else if (tipo_registro === 'clinica') {
            const modalidadCita = datos.modalidad === 'En línea' ? 'En línea' : 'Presencial';
            const ubicacionCita = modalidadCita === 'Presencial' ? (datos.ubicacion || null) : null;
            const linkCita = modalidadCita === 'En línea' ? (datos.link_reunion || null) : null;
            const e = await pool.query(
                "INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion, modalidad, direccion_mapa, link_reunion) VALUES ($1, 'Cita Clínica', $2, $3, $4, $5) RETURNING id_evento",
                [datos.titulo, `${datos.fecha} ${datos.hora}:00`, modalidadCita, ubicacionCita, linkCita]
            );
            await pool.query("INSERT INTO Asistencia_Beneficiarios (id_evento, id_beneficiario) VALUES ($1, $2)", [e.rows[0].id_evento, datos.id_beneficiario]);
            await pool.query("INSERT INTO Participacion (id_evento, id_usuario, horas_invertidas) VALUES ($1, $2, 0)", [e.rows[0].id_evento, datos.id_especialista]);

            try {
                const benRes = await pool.query('SELECT nombre_completo, nombre_tutor, correo_tutor FROM Beneficiarios WHERE id_beneficiario = $1', [datos.id_beneficiario]);
                const ben = benRes.rows[0];
                if (ben && ben.correo_tutor) {
                    const detalleModalidad = modalidadCita === 'En línea'
                        ? `<p style="margin:0;"><b>Modalidad:</b> En línea</p><p style="margin:0;"><b>Enlace:</b> <a href="${linkCita}" style="color:#b50062;font-weight:bold;">${linkCita || 'Se compartirá antes de la cita'}</a></p>`
                        : `<p style="margin:0;"><b>Modalidad:</b> Presencial</p><p style="margin:0;"><b>Ubicación:</b> ${ubicacionCita || 'Sede S.A.C.'}</p>`;
                    const fechaObjCita = new Date(`${datos.fecha}T${datos.hora}:00`);
                    const fechaTextoCita = fechaObjCita.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
                    const contenidoCitaCorreo = `
                        <p>Hola <b>${ben.nombre_tutor || 'tutor(a)'}</b>,</p>
                        <p>Te confirmamos que se ha agendado una cita clínica para <b>${ben.nombre_completo}</b>.</p>
                        <div style="background-color:#f9f2f6;padding:20px;border-radius:8px;margin:25px 0;border-left:4px solid #b50062;">
                            <p style="margin:0;"><b>Fecha:</b> ${fechaTextoCita}</p>
                            <p style="margin:0;"><b>Hora:</b> ${datos.hora} hrs</p>
                            ${detalleModalidad}
                        </div>
                        <p style="font-style:italic;color:#877362;text-align:center;">"Sumando Voluntades"</p>
                    `;
                    enviarCorreoAsync({
                        from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
                        to: ben.correo_tutor,
                        subject: 'Cita Clínica Agendada - Sanctorum A.C.',
                        html: emailTemplate('Cita Clínica Confirmada', contenidoCitaCorreo)
                    }, 'cita clínica agendada');
                }
            } catch (mailErr) {
                console.error("No se pudo preparar el correo de cita clínica al tutor:", mailErr);
            }
        } 
        else if (tipo_registro === 'evento') {
            // id_responsable (quién está a cargo del evento) se guarda para que, en Agenda,
            // un Coordinador deje de ver los eventos a cargo de OTRO Coordinador — ver
            // migracion_eventos_responsable_v1.sql. Eventos creados antes de esa migración
            // simplemente quedan con id_responsable en NULL (visibles para todos, como hoy).
            const e = await pool.query(
                "INSERT INTO Eventos (titulo_evento, tipo_evento, fecha_realizacion, id_escuela, url_imagen, direccion_mapa, link_reunion, descripcion, categoria, id_responsable) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id_evento",
                [datos.titulo, datos.tipo, `${datos.fecha} ${datos.hora}:00`, datos.id_escuela == "0" ? null : datos.id_escuela, chkUrlImagenAgendaPost.valor, datos.direccion_mapa || null, datos.link_reunion || null, datos.descripcion || null, datos.categoria || null, datos.responsable || null]
            );
            const id_evento = e.rows[0].id_evento;
            // "categoria" se sigue guardando también como texto arriba (caché de lectura /
            // compatibilidad con datos_demo_sanctorum.sql), pero Eventos_Categorias es ahora la
            // fuente real de verdad para consultas y filtros (ver migracion_normalizacion_categorias_v1.sql).
            await registrarCategorias(datos.categoria, { tipo: 'evento', id: id_evento });

            const equipo = [datos.responsable, ...datos.voluntarios];
            for (let v of equipo) {
                if(v) await pool.query("INSERT INTO Participacion (id_evento, id_usuario, horas_invertidas) VALUES ($1, $2, 0)", [id_evento, v]);
            }
            for (let i of datos.insumos) {
                const idInsumoResuelto = await resolverIdInsumoParaEvento(pool, i);
                if (!idInsumoResuelto) continue;
                await pool.query("INSERT INTO Consumo_Insumos (id_evento, id_insumo, cantidad_usada) VALUES ($1, $2, $3)", [id_evento, idInsumoResuelto, i.cant]);
                await pool.query("UPDATE Insumos SET stock_actual = stock_actual - $1 WHERE id_insumo = $2", [i.cant, idInsumoResuelto]);
            }
        }
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error("Error post agenda:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.get('/api/agenda/:categoria/:id', verificarToken, async (req, res) => {
    try {
        const { categoria, id } = req.params;
        let data = {};
        if (categoria === 'visita') {
            const vis = await pool.query(`SELECT av.fecha_cita, av.asistentes_plan, av.asistentes_reales, av.estatus_alerta, av.id_evento_ejecucion, e.nombre_escuela, e.contacto_nombre, e.puesto_contacto, e.telefono_escuela, e.ubicacion FROM Agenda_Visitas av JOIN Escuelas e ON av.id_escuela = e.id_escuela WHERE av.id_visita = $1`, [id]);
            data = { ...vis.rows[0], tipo_registro: 'visita' };
        } else {
            // "categoria" aquí se recalcula desde Eventos_Categorias (fuente real de verdad) en vez
            // de leer la columna de texto tal cual -- al llevar el mismo alias que la columna real
            // de Eventos, la sobreescribe en el objeto de resultado (pg asigna las propiedades en
            // el orden de las columnas devueltas, así que la última con ese nombre gana).
            const ev = await pool.query(
                `SELECT e.*,
                        (SELECT string_agg(c.nombre_categoria, ', ' ORDER BY c.nombre_categoria)
                           FROM Eventos_Categorias ec JOIN Categorias c ON c.id_categoria = ec.id_categoria
                          WHERE ec.id_evento = e.id_evento) AS categoria
                   FROM Eventos e WHERE e.id_evento = $1`,
                [id]
            );
            const evento = ev.rows[0];
            if (evento.tipo_evento === 'Cita Clínica') {
                const ben = await pool.query("SELECT id_beneficiario FROM Asistencia_Beneficiarios WHERE id_evento = $1", [id]);
                const part = await pool.query("SELECT id_usuario FROM Participacion WHERE id_evento = $1", [id]);
                data = { ...evento, id_beneficiario: ben.rows[0]?.id_beneficiario, id_especialista: part.rows[0]?.id_usuario, tipo_registro: 'clinica' };
            } else {
                const parts = await pool.query("SELECT id_usuario FROM Participacion WHERE id_evento = $1", [id]);
                const ins = await pool.query("SELECT id_insumo, cantidad_usada FROM Consumo_Insumos WHERE id_evento = $1", [id]);
                data = { ...evento, voluntarios: parts.rows.map(p => p.id_usuario), insumos: ins.rows, tipo_registro: 'evento' };
            }
        }
        res.json({ success: true, data });
    } catch (e) { console.error("Error GET por ID:", e); res.status(500).json({ success: false }); }
});

app.put('/api/agenda/:categoria/:id', verificarToken, async (req, res) => {
    const { categoria, id } = req.params;
    const { tipo_registro, datos } = req.body;
    if (esPsicologo(req.usuario) && tipo_registro !== 'clinica') {
        return res.status(403).json({ success: false, message: 'Como Psicólogo(a) solo puedes modificar Citas Clínicas.' });
    }
<<<<<<< HEAD
=======
    // Mismo criterio que al crear: el especialista siempre es él mismo, y el beneficiario
    // debe seguir asignado a su cargo.
    if (esPsicologo(req.usuario) && tipo_registro === 'clinica' && datos) {
        datos.id_especialista = req.usuario.id;
        const asignado = await pool.query('SELECT id_especialista FROM Beneficiarios WHERE id_beneficiario = $1', [datos.id_beneficiario]);
        if (asignado.rows.length === 0 || asignado.rows[0].id_especialista !== req.usuario.id) {
            return res.status(403).json({ success: false, message: 'Ese beneficiario no está asignado a tu cargo.' });
        }
    }
    // Valida url_imagen antes de abrir la transaccion.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const chkUrlImagenAgendaPut = validarUrlCloudinaria(datos?.url_imagen, 'url_imagen');
    if (!chkUrlImagenAgendaPut.ok) return res.status(400).json({ success: false, message: chkUrlImagenAgendaPut.mensaje });
    try {
        await pool.query('BEGIN');

        if (categoria === 'visita') {
            const vis = await pool.query("SELECT id_escuela FROM Agenda_Visitas WHERE id_visita = $1", [id]);
            await pool.query(
                "UPDATE Escuelas SET nombre_escuela=$1, contacto_nombre=$2, puesto_contacto=$3, telefono_escuela=$4, ubicacion=$5 WHERE id_escuela=$6",
                [datos.escuela, datos.contacto, datos.puesto, datos.telefono, datos.ubicacion, vis.rows[0].id_escuela]
            );
            await pool.query("UPDATE Agenda_Visitas SET fecha_cita=$1, asistentes_plan=$2 WHERE id_visita=$3", [`${datos.fecha} ${datos.hora}:00`, datos.asistentes_plan || null, id]);
        } 
        else if (tipo_registro === 'clinica') {
            const modalidadCitaEdit = datos.modalidad === 'En línea' ? 'En línea' : 'Presencial';
            const ubicacionCitaEdit = modalidadCitaEdit === 'Presencial' ? (datos.ubicacion || null) : null;
            const linkCitaEdit = modalidadCitaEdit === 'En línea' ? (datos.link_reunion || null) : null;
            await pool.query("UPDATE Eventos SET titulo_evento=$1, fecha_realizacion=$2, modalidad=$3, direccion_mapa=$4, link_reunion=$5 WHERE id_evento=$6",
                [datos.titulo, `${datos.fecha} ${datos.hora}:00`, modalidadCitaEdit, ubicacionCitaEdit, linkCitaEdit, id]);
            await pool.query("UPDATE Asistencia_Beneficiarios SET id_beneficiario=$1 WHERE id_evento=$2", [datos.id_beneficiario, id]);
            await pool.query("UPDATE Participacion SET id_usuario=$1 WHERE id_evento=$2", [datos.id_especialista, id]);
        } 
        else if (tipo_registro === 'evento') {
            await pool.query("UPDATE Eventos SET titulo_evento=$1, tipo_evento=$2, fecha_realizacion=$3, id_escuela=$4, url_imagen=$5, direccion_mapa=$6, link_reunion=$7, descripcion=$8, categoria=$9, id_responsable=$10 WHERE id_evento=$11",
                [datos.titulo, datos.tipo, `${datos.fecha} ${datos.hora}:00`, datos.id_escuela == "0" ? null : datos.id_escuela, chkUrlImagenAgendaPut.valor, datos.direccion_mapa || null, datos.link_reunion || null, datos.descripcion || null, datos.categoria || null, datos.responsable || null, id]);
            await registrarCategorias(datos.categoria, { tipo: 'evento', id: Number(id) });

            await pool.query("DELETE FROM Participacion WHERE id_evento=$1", [id]);
            const equipo = [datos.responsable, ...datos.voluntarios];
            for (let v of equipo) {
                if(v) await pool.query("INSERT INTO Participacion (id_evento, id_usuario, horas_invertidas) VALUES ($1, $2, 0)", [id, v]);
            }

            const oldIns = await pool.query("SELECT id_insumo, cantidad_usada FROM Consumo_Insumos WHERE id_evento=$1", [id]);
            for (let old of oldIns.rows) {
                await pool.query("UPDATE Insumos SET stock_actual = stock_actual + $1 WHERE id_insumo = $2", [old.cantidad_usada, old.id_insumo]);
            }
            await pool.query("DELETE FROM Consumo_Insumos WHERE id_evento=$1", [id]);
            
            for (let i of datos.insumos) {
                const idInsumoResuelto = await resolverIdInsumoParaEvento(pool, i);
                if (!idInsumoResuelto) continue;
                await pool.query("INSERT INTO Consumo_Insumos (id_evento, id_insumo, cantidad_usada) VALUES ($1, $2, $3)", [id, idInsumoResuelto, i.cant]);
                await pool.query("UPDATE Insumos SET stock_actual = stock_actual - $1 WHERE id_insumo = $2", [i.cant, idInsumoResuelto]);
            }
        }
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (e) { await pool.query('ROLLBACK'); console.error("Error PUT:", e); res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/agenda/visita/:id/completar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { asistentes_reales, id_evento_ejecucion } = req.body;
    try {
        const result = await pool.query(
            "UPDATE Agenda_Visitas SET estatus_alerta = 'Realizado', asistentes_reales = $1, id_evento_ejecucion = $2 WHERE id_visita = $3",
            [asistentes_reales != null ? asistentes_reales : null, id_evento_ejecucion || null, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Visita no encontrada.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al marcar visita como realizada:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.post('/api/agenda/evento/:id/unirse', verificarToken, async (req, res) => {
    try {
        const existe = await pool.query('SELECT 1 FROM Participacion WHERE id_evento = $1 AND id_usuario = $2', [req.params.id, req.usuario.id]);
        if (existe.rows.length > 0) return res.json({ success: true, ya_estaba: true });
        await pool.query('INSERT INTO Participacion (id_evento, id_usuario, horas_invertidas) VALUES ($1, $2, 0)', [req.params.id, req.usuario.id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Error al unirse al evento:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.delete('/api/agenda/:categoria/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        if (req.params.categoria === 'visita') await pool.query("DELETE FROM Agenda_Visitas WHERE id_visita = $1", [req.params.id]);
        else await pool.query("DELETE FROM Eventos WHERE id_evento = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) { console.error("Error DELETE:", e); res.status(500).json({ success: false }); }
});

app.get('/api/catalogos_expedientes', async (req, res) => {
    try {
        // Solo Especialistas cuya especialidad sea Psicología pueden quedar como
        // "Especialista Asignado" de un expediente clínico — antes esta lista incluía
        // a cualquier Especialista (ej. Pedagogía), que es un área fuera de su competencia.
        const especialistas = await pool.query(
            "SELECT id_usuario, nombre_completo FROM Usuarios WHERE id_rol = 2 AND especialidad ILIKE '%psic%' AND COALESCE(estatus,'Activo') != 'Inactivo' ORDER BY nombre_completo ASC"
        );
        const escuelas = await pool.query('SELECT id_escuela, nombre_escuela FROM Escuelas ORDER BY nombre_escuela ASC');
        res.json({ success: true, especialistas: especialistas.rows, escuelas: escuelas.rows });
    } catch (error) {
        console.error("Error catalogos_expedientes:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.get('/api/expedientes', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
    try {
        const filtrarPorEspecialista = esPsicologo(req.usuario);
=======
// 2. Listado de expedientes (tabla principal)
app.get('/api/expedientes', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), async (req, res) => {
    try {
        // Un psicólogo (Especialista con especialidad "Psicología") solo ve SUS pacientes.
        // Admin y Coordinador ven todos. Un Especialista que NO es psicólogo (ej. Pedagogía)
        // no tiene ningún expediente clínico que le corresponda — antes, al no ser psicólogo,
        // simplemente no se aplicaba ningún filtro y terminaba viendo TODOS los expedientes
        // sin querer (bug), así que aquí se le niega el acceso explícitamente.
        const esCoordOAdmin = req.usuario.rol === ROL_ADMIN || req.usuario.rol === ROL_COORDINADOR;
        if (!esCoordOAdmin && !esPsicologo(req.usuario)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para ver expedientes clínicos.' });
        }
        const filtrarPorEspecialista = !esCoordOAdmin && esPsicologo(req.usuario);
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
        const params = [];
        let filtroWhere = '';
        if (filtrarPorEspecialista) {
            params.push(req.usuario.id);
            filtroWhere = 'WHERE b.id_especialista = $1';
        }

        const result = await pool.query(`
            SELECT b.id_beneficiario AS id, b.nombre_completo AS paciente, b.nombre_tutor AS tutor,
                   b.telefono_tutor, b.correo_tutor, b.fecha_nacimiento, b.genero, b.colonia_puebla,
                   COALESCE(esc.nombre_escuela, 'N/A') AS escuela,
                   b.id_especialista,
                   COALESCE(u.nombre_completo, 'Sin asignar') AS especialista,
                   COALESCE(b.estatus, 'ACTIVO') AS estatus,
                   b.fecha_registro AS ingreso
            FROM Beneficiarios b
            LEFT JOIN Escuelas esc ON b.id_escuela = esc.id_escuela
            LEFT JOIN Usuarios u ON b.id_especialista = u.id_usuario
            ${filtroWhere}
            ORDER BY b.id_beneficiario DESC
        `, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar expedientes:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.post('/api/expedientes', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 3. Crear nuevo expediente (beneficiario) — permite crear escuela nueva "al vuelo"
// Solo Admin/Coordinador pueden dar de alta expedientes clínicos; los Especialistas
// (incluidos los psicólogos) ya no pueden crear expedientes por su cuenta.
app.post('/api/expedientes', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const { nombre, fecha_nacimiento, genero, colonia_puebla, id_escuela, escuela_nueva, tutor, telefono_tutor, correo_tutor, id_especialista } = req.body;
    try {
        await pool.query('BEGIN');

        let idEscuelaFinal = null;
        if (id_escuela && id_escuela !== '0' && id_escuela !== 'otra') {
            idEscuelaFinal = id_escuela;
        } else if (id_escuela === 'otra' && escuela_nueva) {
            const nueva = await pool.query(
                'INSERT INTO Escuelas (nombre_escuela) VALUES ($1) RETURNING id_escuela',
                [escuela_nueva]
            );
            idEscuelaFinal = nueva.rows[0].id_escuela;
        }

        const nuevoBeneficiario = await pool.query(
            `INSERT INTO Beneficiarios (nombre_completo, fecha_nacimiento, genero, colonia_puebla, nombre_tutor, telefono_tutor, correo_tutor, id_escuela, id_especialista, estatus, fecha_registro)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVO', CURRENT_TIMESTAMP) RETURNING id_beneficiario`,
            [nombre, fecha_nacimiento, genero || null, colonia_puebla || null, tutor, telefono_tutor, correo_tutor || null, idEscuelaFinal, id_especialista || null]
        );

        await pool.query('COMMIT');
        res.status(201).json({ success: true, id_beneficiario: nuevoBeneficiario.rows[0].id_beneficiario });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al crear expediente:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.put('/api/expedientes/:id/estatus', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 4. Cambiar estatus clínico (ACTIVO / EN PAUSA / ALTA)
app.put('/api/expedientes/:id/estatus', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const { estatus } = req.body;
    try {
        await pool.query('UPDATE Beneficiarios SET estatus = $1 WHERE id_beneficiario = $2', [estatus, req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar estatus del expediente:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.get('/api/expedientes/:id/notas', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 5. Notas de evolución — listar
app.get('/api/expedientes/:id/notas', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    try {
        const result = await pool.query(`
            SELECT n.id_nota, n.fecha_atencion, n.contenido_nota, n.tipo_intervencion,
                   n.tipo_sesion, n.modalidad, n.nivel_riesgo, n.asistencia, n.duracion_minutos,
                   COALESCE(u.nombre_completo, 'Especialista') AS especialista
            FROM Expedientes_Notas n
            LEFT JOIN Usuarios u ON n.id_especialista = u.id_usuario
            WHERE n.id_beneficiario = $1
            ORDER BY n.fecha_atencion DESC
        `, [req.params.id]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar notas:", error);
        res.status(500).json({ success: false });
    }
});

const MAPA_TIPO_INTERVENCION = {
    'Ordinaria': 'Seguimiento',
    'Evaluación': 'Diagnóstico',
    'Intervención': 'Crisis',
    'Cierre': 'Cierre'
};
<<<<<<< HEAD
app.post('/api/expedientes/:id/notas', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
app.post('/api/expedientes/:id/notas', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const { id_especialista, nota, tipo_sesion, modalidad, asistencia, nivel_riesgo } = req.body;
    const tipoIntervencion = MAPA_TIPO_INTERVENCION[tipo_sesion] || 'Seguimiento';
    try {
        await pool.query(
            `INSERT INTO Expedientes_Notas 
                (id_beneficiario, id_especialista, contenido_nota, tipo_intervencion, tipo_sesion, modalidad, nivel_riesgo, asistencia)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [req.params.id, id_especialista || null, nota, tipoIntervencion, tipo_sesion || null, modalidad || null, nivel_riesgo || null, asistencia || null]
        );
        res.status(201).json({ success: true });

        // Si el beneficiario asistió a la sesión, se le envía la encuesta de satisfacción
        // (RF-15). Va después de responder y en segundo plano: nunca debe hacer más lento
        // ni hacer fallar el guardado de la nota clínica.
        if (asistencia === 'Asistió') {
            enviarEncuestaSatisfaccion(req.params.id, id_especialista || req.usuario.id).catch(err => {
                console.error("No se pudo preparar/enviar la encuesta de satisfacción:", err);
            });
        }
    } catch (error) {
        console.error("Error al guardar nota:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.get('/api/expedientes/:id/documentos', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 7. Documentos del expediente — listar
app.get('/api/expedientes/:id/documentos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    try {
        const result = await pool.query(
            "SELECT id_doc, nombre_archivo, url_archivo, fecha_subida, 'archivo' AS origen, NULL::int AS calificacion, NULL::text AS comentarios FROM Expedientes_Documentos WHERE id_beneficiario = $1",
            [req.params.id]
        );
        let data = result.rows;

        // Las encuestas de satisfacción ya respondidas (RF-15) también viven en la sección
        // de Documentos. Si Encuestas_Satisfaccion todavía no existe (falta correr la
        // migración), simplemente no se incluyen — nunca debe tumbar el listado real. Se
        // intenta primero con las columnas de la migración v2 (trato del especialista,
        // puntualidad, utilidad de la sesión, NPS) y se degrada si aún no existen.
        try {
            const enc = await pool.query(
                `SELECT en.id_encuesta AS id_doc, 'Encuesta de Satisfacción' AS nombre_archivo, NULL AS url_archivo,
                        en.fecha_respuesta AS fecha_subida, 'encuesta' AS origen, en.calificacion, en.comentarios,
                        en.calificacion_especialista, en.calificacion_puntualidad, en.utilidad_sesion, en.probabilidad_recomendar,
                        COALESCE(u.nombre_completo, 'N/A') AS especialista
                 FROM Encuestas_Satisfaccion en
                 LEFT JOIN Usuarios u ON en.id_especialista = u.id_usuario
                 WHERE en.id_beneficiario = $1 AND en.respondida = TRUE`,
                [req.params.id]
            );
            data = [...data, ...enc.rows];
        } catch (encErr) {
            try {
                const enc = await pool.query(
                    `SELECT en.id_encuesta AS id_doc, 'Encuesta de Satisfacción' AS nombre_archivo, NULL AS url_archivo,
                            en.fecha_respuesta AS fecha_subida, 'encuesta' AS origen, en.calificacion, en.comentarios,
                            COALESCE(u.nombre_completo, 'N/A') AS especialista
                     FROM Encuestas_Satisfaccion en
                     LEFT JOIN Usuarios u ON en.id_especialista = u.id_usuario
                     WHERE en.id_beneficiario = $1 AND en.respondida = TRUE`,
                    [req.params.id]
                );
                data = [...data, ...enc.rows];
            } catch (encErr2) {
                console.error("No se pudieron incluir encuestas de satisfacción (¿falta la migración?):", encErr2.message);
            }
        }

        data.sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al listar documentos:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.post('/api/expedientes/:id/documentos', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 8. Documentos del expediente — registrar (la subida física ya ocurrió vía Cloudinary desde el frontend)
app.post('/api/expedientes/:id/documentos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const { nombre_archivo, url_archivo } = req.body;
    try {
        await pool.query(
            'INSERT INTO Expedientes_Documentos (id_beneficiario, nombre_archivo, url_archivo) VALUES ($1, $2, $3)',
            [req.params.id, nombre_archivo, url_archivo]
        );
        res.status(201).json({ success: true });
    } catch (error) {
        console.error("Error al registrar documento:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.delete('/api/expedientes/:id/documentos/:id_doc', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 8b. Documentos del expediente — eliminar
app.delete('/api/expedientes/:id/documentos/:id_doc', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    try {
        const result = await pool.query('DELETE FROM Expedientes_Documentos WHERE id_doc = $1 AND id_beneficiario = $2', [req.params.id_doc, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Documento no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar documento:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.put('/api/expedientes/:id/tutor', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 8c. Editar datos de contacto del tutor (nombre, teléfono, correo) y del beneficiario
// (género, colonia) — necesario para emergencias y para completar el expediente.
app.put('/api/expedientes/:id/tutor', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const { tutor, telefono_tutor, correo_tutor, genero, colonia_puebla } = req.body;
    try {
        await pool.query(
            'UPDATE Beneficiarios SET nombre_tutor = $1, telefono_tutor = $2, correo_tutor = $3, genero = COALESCE($4, genero), colonia_puebla = COALESCE($5, colonia_puebla) WHERE id_beneficiario = $6',
            [tutor || null, telefono_tutor || null, correo_tutor || null, genero || null, colonia_puebla || null, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar datos del tutor:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.put('/api/expedientes/:id/especialista', verificarToken, requiereRol(ROL_ADMIN), async (req, res) => {
=======
// 4a-bis. Reasignar el especialista responsable de un expediente (Admin/Coordinador). Antes
// de este endpoint no existia forma de cambiar el especialista de un expediente ya creado.
app.put('/api/expedientes/:id/especialista', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const { id_especialista } = req.body;
    try {
        const result = await pool.query(
            'UPDATE Beneficiarios SET id_especialista = $1 WHERE id_beneficiario = $2',
            [id_especialista || null, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Expediente no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al reasignar especialista del expediente:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.put('/api/expedientes/:id/datos', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA), async (req, res) => {
=======
// 4b. Editar los datos propios del beneficiario (nombre, fecha de nacimiento, escuela, género, colonia).
//     La escuela se recibe como texto libre: si coincide (sin importar mayúsculas) con una escuela
//     ya registrada se reutiliza esa fila; si no existe, se crea una nueva — igual que al abrir expediente.
app.put('/api/expedientes/:id/datos', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR, ROL_ESPECIALISTA), verificarOwnershipExpediente, async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    const { nombre, fecha_nacimiento, genero, colonia_puebla, escuela_texto } = req.body;
    try {
        let idEscuelaFinal = null;
        if (escuela_texto && escuela_texto.trim()) {
            const existente = await pool.query('SELECT id_escuela FROM Escuelas WHERE LOWER(nombre_escuela) = LOWER($1)', [escuela_texto.trim()]);
            if (existente.rows.length > 0) {
                idEscuelaFinal = existente.rows[0].id_escuela;
            } else {
                const nueva = await pool.query('INSERT INTO Escuelas (nombre_escuela) VALUES ($1) RETURNING id_escuela', [escuela_texto.trim()]);
                idEscuelaFinal = nueva.rows[0].id_escuela;
            }
        }
        await pool.query(
            `UPDATE Beneficiarios SET nombre_completo = COALESCE($1, nombre_completo), fecha_nacimiento = COALESCE($2, fecha_nacimiento),
                genero = COALESCE($3, genero), colonia_puebla = COALESCE($4, colonia_puebla),
                id_escuela = COALESCE($5, id_escuela) WHERE id_beneficiario = $6`,
            [nombre || null, fecha_nacimiento || null, genero || null, colonia_puebla || null, idEscuelaFinal, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar datos del beneficiario:", error);
        res.status(500).json({ success: false });
    }
});

let _columnaPkSolicitudes = null;
async function obtenerColumnaPkSolicitudes() {
    if (_columnaPkSolicitudes) return _columnaPkSolicitudes;
    try {
        const r = await pool.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name ILIKE 'solicitudes_web' AND column_name ILIKE ANY(ARRAY['id_solicitud','id'])
             ORDER BY (column_name ILIKE 'id_solicitud') DESC LIMIT 1`
        );
        _columnaPkSolicitudes = r.rows[0]?.column_name || 'id_solicitud';
    } catch (e) {
        console.error('No se pudo detectar la columna PK de Solicitudes_Web, se asume id_solicitud:', e);
        _columnaPkSolicitudes = 'id_solicitud';
    }
    return _columnaPkSolicitudes;
}

// ==========================================
// ENCUESTA DE SATISFACCIÓN — endpoints públicos (RF-15)
// El "token" (generado con crypto.randomBytes en enviarEncuestaSatisfaccion) es la única
// credencial: no requieren login, igual que el formulario público de solicitudes.
// ==========================================

// Lista de encuestas insatisfactorias (calificación general 1-2) aún no revisadas, para la
// sección "Encuestas por revisar" del Perfil de Admin/Coordinador. Si la migración v2 no ha
// corrido (faltan las columnas revisada/calificacion_especialista, etc.), se responde con una
// lista vacía en vez de tronar.
app.get('/api/encuestas/pendientes_revision', (req, res, next) => {
    console.log('[DIAG pendientes_revision] llegó la petición. Authorization:', req.headers['authorization'] ? 'presente' : 'AUSENTE');
    next();
}, verificarToken, (req, res, next) => {
    console.log('[DIAG pendientes_revision] verificarToken OK. usuario:', JSON.stringify(req.usuario));
    next();
}, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    console.log('[DIAG pendientes_revision] requiereRol OK, ejecutando query...');
    try {
        const result = await pool.query(`
            SELECT en.id_encuesta, en.calificacion, en.calificacion_especialista, en.calificacion_puntualidad,
                   en.utilidad_sesion, en.probabilidad_recomendar, en.comentarios, en.fecha_respuesta,
                   b.nombre_completo AS beneficiario, COALESCE(u.nombre_completo, 'N/A') AS especialista
            FROM Encuestas_Satisfaccion en
            JOIN Beneficiarios b ON en.id_beneficiario = b.id_beneficiario
            LEFT JOIN Usuarios u ON en.id_especialista = u.id_usuario
            WHERE en.respondida = TRUE AND en.calificacion <= 2 AND COALESCE(en.revisada, FALSE) = FALSE
            ORDER BY en.fecha_respuesta DESC
        `);
        console.log('[DIAG pendientes_revision] query OK, filas:', result.rows.length);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('[DIAG pendientes_revision] ERROR EN QUERY:', error.message);
        res.json({ success: true, data: [] });
    }
});

// 1. Consultar (para precargar el formulario / bloquear un enlace ya usado).
app.get('/api/encuestas/:token', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.respondida, b.nombre_completo AS beneficiario
             FROM Encuestas_Satisfaccion e JOIN Beneficiarios b ON e.id_beneficiario = b.id_beneficiario
             WHERE e.token = $1`,
            [req.params.token]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Enlace no válido.' });
        const fila = result.rows[0];
        res.json({ success: true, respondida: fila.respondida, beneficiario: (fila.beneficiario || '').split(' ')[0] });
    } catch (error) {
        console.error("Error al consultar encuesta de satisfacción:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// 2. Responder. Calificación de 1 a 5; una calificación de 1 o 2 dispara el aviso a
// Coordinadores/Administradores. Un token ya respondido no se puede volver a usar.
// Preguntas ampliadas (RF-15 v2): además de la calificación general y los comentarios,
// la encuesta pide trato del especialista, puntualidad, utilidad percibida de la sesión y
// probabilidad de recomendar (NPS 0-10) — para que el resultado se pueda analizar con más
// detalle en Reportes, no solo como un número suelto. Las 4 preguntas nuevas son columnas
// opcionales a nivel de base de datos (por si la migración v2 aún no corrió), pero el
// frontend las pide todas para maximizar qué tan completa queda cada respuesta.
app.post('/api/encuestas/:token', async (req, res) => {
    const { comentarios, utilidad_sesion } = req.body;
    const calNum = parseInt(req.body.calificacion, 10);
    const calEspecialista = parseInt(req.body.calificacion_especialista, 10);
    const calPuntualidad = parseInt(req.body.calificacion_puntualidad, 10);
    const npsNum = parseInt(req.body.probabilidad_recomendar, 10);

    if (isNaN(calNum) || calNum < 1 || calNum > 5) {
        return res.status(400).json({ success: false, message: 'Selecciona una calificación general de 1 a 5.' });
    }
    if (isNaN(calEspecialista) || calEspecialista < 1 || calEspecialista > 5) {
        return res.status(400).json({ success: false, message: 'Selecciona una calificación de 1 a 5 para el trato del especialista.' });
    }
    if (isNaN(calPuntualidad) || calPuntualidad < 1 || calPuntualidad > 5) {
        return res.status(400).json({ success: false, message: 'Selecciona una calificación de 1 a 5 para la puntualidad.' });
    }
    if (!['Si', 'Parcialmente', 'No'].includes(utilidad_sesion)) {
        return res.status(400).json({ success: false, message: 'Indica si la sesión te ayudó.' });
    }
    if (isNaN(npsNum) || npsNum < 0 || npsNum > 10) {
        return res.status(400).json({ success: false, message: 'Selecciona qué tan probable es que recomiendes el servicio, de 0 a 10.' });
    }

    try {
        const actual = await pool.query('SELECT respondida, id_beneficiario FROM Encuestas_Satisfaccion WHERE token = $1', [req.params.token]);
        if (actual.rows.length === 0) return res.status(404).json({ success: false, message: 'Enlace no válido.' });
        if (actual.rows[0].respondida) return res.status(409).json({ success: false, message: 'Esta encuesta ya fue respondida. ¡Gracias!' });

        await pool.query(
            `UPDATE Encuestas_Satisfaccion
             SET calificacion = $1, comentarios = $2, respondida = TRUE, fecha_respuesta = CURRENT_TIMESTAMP,
                 calificacion_especialista = $3, calificacion_puntualidad = $4, utilidad_sesion = $5, probabilidad_recomendar = $6
             WHERE token = $7`,
            [calNum, (comentarios || '').slice(0, 2000), calEspecialista, calPuntualidad, utilidad_sesion, npsNum, req.params.token]
        );
        res.json({ success: true, message: '¡Gracias por tu respuesta!' });

        if (calNum <= 2) {
            avisarEncuestaInsatisfactoria(actual.rows[0].id_beneficiario, calNum, comentarios, {
                calificacionEspecialista: calEspecialista,
                calificacionPuntualidad: calPuntualidad,
                utilidadSesion: utilidad_sesion,
                probabilidadRecomendar: npsNum,
            }).catch(err => {
                console.error("No se pudo preparar el aviso de encuesta insatisfactoria:", err);
            });
        }
    } catch (error) {
        // Si la migración v2 (columnas nuevas) todavía no corrió, el UPDATE de arriba falla
        // por columna inexistente — degradamos guardando solo lo que la tabla original soporta,
        // en vez de perder la respuesta por completo.
        if (error.code === '42703') {
            try {
                const actual2 = await pool.query('SELECT id_beneficiario FROM Encuestas_Satisfaccion WHERE token = $1', [req.params.token]);
                await pool.query(
                    `UPDATE Encuestas_Satisfaccion SET calificacion = $1, comentarios = $2, respondida = TRUE, fecha_respuesta = CURRENT_TIMESTAMP WHERE token = $3`,
                    [calNum, (comentarios || '').slice(0, 2000), req.params.token]
                );
                if (!res.headersSent) res.json({ success: true, message: '¡Gracias por tu respuesta!' });
                if (calNum <= 2 && actual2.rows[0]) {
                    avisarEncuestaInsatisfactoria(actual2.rows[0].id_beneficiario, calNum, comentarios).catch(() => {});
                }
                return;
            } catch (error2) {
                console.error("Error al guardar respuesta de encuesta (fallback sin columnas nuevas):", error2);
            }
        }
        console.error("Error al guardar respuesta de encuesta de satisfacción:", error);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Marca una encuesta insatisfactoria como revisada (deja de aparecer en Perfil y en la
// campana de notificaciones). Guarda quién y cuándo la revisó.
app.put('/api/encuestas/:id/revisar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE Encuestas_Satisfaccion SET revisada = TRUE, fecha_revision = CURRENT_TIMESTAMP, id_usuario_revisor = $1
             WHERE id_encuesta = $2 RETURNING id_encuesta`,
            [req.usuario.id, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Encuesta no encontrada.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al marcar encuesta como revisada:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Historial completo de encuestas de satisfacción respondidas para UN especialista, más su
// promedio general — usado por el botón "Ver historial de encuestas" en Voluntariado
// (solo visible ahí para Admin/Coordinador).
app.get('/api/encuestas/especialista/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    try {
        const historial = await pool.query(`
            SELECT en.id_encuesta, en.fecha_respuesta, en.calificacion, en.calificacion_especialista,
                   en.calificacion_puntualidad, en.utilidad_sesion, en.probabilidad_recomendar,
                   en.comentarios, b.nombre_completo AS beneficiario
            FROM Encuestas_Satisfaccion en
            JOIN Beneficiarios b ON en.id_beneficiario = b.id_beneficiario
            WHERE en.id_especialista = $1 AND en.respondida = TRUE
            ORDER BY en.fecha_respuesta DESC
        `, [req.params.id]);

        // Los promedios se calculan aquí (no en SQL) para que sea trivial ignorar los NULL
        // de encuestas viejas (antes de la migración v2) sin complicar la query.
        const filas = historial.rows;
        const promedio = (campo) => {
            const valores = filas.map((f) => f[campo]).filter((v) => v !== null && v !== undefined);
            if (valores.length === 0) return null;
            return Math.round((valores.reduce((a, b) => a + Number(b), 0) / valores.length) * 100) / 100;
        };
        res.json({
            success: true,
            resumen: {
                total_respondidas: filas.length,
                promedio_general: promedio('calificacion'),
                promedio_trato: promedio('calificacion_especialista'),
                promedio_puntualidad: promedio('calificacion_puntualidad'),
                promedio_nps: promedio('probabilidad_recomendar'),
                respuestas_negativas: filas.filter((f) => f.calificacion <= 2).length,
            },
            historial: filas,
        });
    } catch (error) {
        console.error("Error al obtener historial de encuestas del especialista:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.post('/api/solicitudes', async (req, res) => {
    const { nombre_contacto, telefono, correo, tipo_solicitud, mensaje } = req.body;
    if (!nombre_contacto || !correo || !tipo_solicitud || !mensaje) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
    }
    if (!validarFormatoCorreo(correo)) {
        return res.status(400).json({ success: false, message: 'El correo no tiene un formato válido.' });
    }
    try {
        await pool.query(
            `INSERT INTO Solicitudes_Web (nombre_contacto, telefono, correo, tipo_solicitud, mensaje, estatus, fecha_envio)
             VALUES ($1, $2, $3, $4, $5, 'Pendiente', CURRENT_TIMESTAMP)`,
            [nombre_contacto, telefono || null, correo, tipo_solicitud, mensaje]
        );

<<<<<<< HEAD
        try {
            const contenido = `
                <p>Hola <b>${escapeHtmlServidor(nombre_contacto)}</b>,</p>
                <p>Hemos recibido tu solicitud de <b>${escapeHtmlServidor(tipo_solicitud)}</b>. Nuestro equipo la revisará y se pondrá en contacto contigo muy pronto.</p>
                <p style="font-style: italic; color: #877362; text-align: center;">"Sumando Voluntades"</p>
            `;
            await transporter.sendMail({
                from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
                to: correo,
                subject: 'Hemos recibido tu solicitud - Sanctorum A.C.',
                html: emailTemplate('Solicitud Recibida', contenido)
            });
        } catch (mailErr) {
            console.error("No se pudo enviar el correo de confirmación de solicitud:", mailErr);
        }

        try {
            const esHistoria = tipo_solicitud === 'Compartir Historia de Éxito';
            const filtroRol = esHistoria
                ? "id_rol IN (1, 2, 3)"
                : "id_rol IN (1, 3)";
=======
        // La solicitud ya quedó guardada — respondemos de inmediato. Este endpoint lo usa
        // enviarSolicitudWeb() desde varios formularios públicos del sitio, así que esperar
        // aquí a que salgan dos correos por SMTP (confirmación + aviso al staff) es lo que
        // hacía sentir "trabados" esos botones. Ambos correos se disparan después, en
        // segundo plano, sin bloquear la respuesta.
        res.status(201).json({ success: true, message: 'Solicitud enviada correctamente.' });

        // Correo de confirmación automático al remitente.
        const contenido = `
            <p>Hola <b>${escapeHtmlServidor(nombre_contacto)}</b>,</p>
            <p>Hemos recibido tu solicitud de <b>${escapeHtmlServidor(tipo_solicitud)}</b>. Nuestro equipo la revisará y se pondrá en contacto contigo muy pronto.</p>
            <p style="font-style: italic; color: #877362; text-align: center;">"Sumando Voluntades"</p>
        `;
        enviarCorreoAsync({
            from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Hemos recibido tu solicitud - Sanctorum A.C.',
            html: emailTemplate('Solicitud Recibida', contenido)
        }, 'confirmación de solicitud web');

        // Aviso al staff correspondiente: la bandeja de "Solicitudes de la Comunidad" es
        // exclusiva de Admin/Coordinador (ver GET/PUT /api/solicitudes más abajo) — los
        // Psicólogos ya no le dan seguimiento ahí, así que tampoco tiene sentido avisarles
        // por correo de una solicitud que no van a poder ver ni atender dentro del sistema.
        try {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            const staff = await pool.query(
                `SELECT correo FROM Usuarios
                 WHERE id_rol IN (1, 3) AND correo IS NOT NULL AND COALESCE(estatus,'Activo') != 'Inactivo'`
            );
<<<<<<< HEAD
            const correosStaff = staff.rows
                .filter(u => u.rol !== ROL_ESPECIALISTA || esPsicologo(u))
                .map(u => u.correo)
                .filter(Boolean);
=======
            const correosStaff = staff.rows.map(u => u.correo).filter(Boolean);
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            if (correosStaff.length > 0) {
                const contenidoAvisoStaff = `
                    <p>Hola,</p>
                    <p>Se recibió una nueva solicitud de <b>${escapeHtmlServidor(tipo_solicitud)}</b> a través del sitio público.</p>
                    <p><b>Contacto:</b> ${escapeHtmlServidor(nombre_contacto)} — ${escapeHtmlServidor(correo)}${telefono ? ' — ' + escapeHtmlServidor(telefono) : ''}</p>
                    <p><b>Mensaje:</b> ${escapeHtmlServidor(mensaje)}</p>
                    <p>Entra a tu Perfil dentro de la plataforma para darle seguimiento.</p>
                `;
                enviarCorreoAsync({
                    from: `"Sanctorum A.C." <${process.env.EMAIL_USER}>`,
                    to: correosStaff.join(','),
                    subject: `Nueva solicitud: ${tipo_solicitud} - Sanctorum A.C.`,
                    html: emailTemplate('Nueva solicitud recibida', contenidoAvisoStaff)
<<<<<<< HEAD
                });
=======
                }, 'aviso de nueva solicitud al staff');
            } else {
                console.log(`Aviso de nueva solicitud (${tipo_solicitud}): no hay staff con correo registrado para este tipo, no se envió nada.`);
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            }
        } catch (mailErr) {
            console.error("No se pudo preparar el aviso de nueva solicitud al staff:", mailErr);
        }
    } catch (error) {
        console.error("Error al registrar solicitud web:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.get('/api/solicitudes', verificarToken, async (req, res) => {
    const esStaffCompleto = req.usuario.rol === ROL_ADMIN || req.usuario.rol === ROL_COORDINADOR;
    if (!esStaffCompleto && !esPsicologo(req.usuario)) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para ver las solicitudes.' });
    }
=======
// Bandeja de solicitudes para el panel administrativo (tarjeta "Solicitudes de la
// Comunidad" en Perfil). Exclusiva de Admin/Coordinador. Antes un Psicólogo también
// veía aquí las de "Compartir Historia de Éxito" (para redactarlas/publicarlas), pero
// se retiró ese acceso: si Admin/Coordinador reciben una así, coordinan directamente
// con el psicólogo fuera del sistema; él sigue pudiendo publicar la historia desde
// Publicaciones, solo ya no a través de esta bandeja.
app.get('/api/solicitudes', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    try {
        const result = await pool.query('SELECT * FROM Solicitudes_Web ORDER BY fecha_envio DESC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar solicitudes:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.put('/api/solicitudes/:id', verificarToken, async (req, res) => {
    const esStaffCompleto = req.usuario.rol === ROL_ADMIN || req.usuario.rol === ROL_COORDINADOR;
    if (!esStaffCompleto && !esPsicologo(req.usuario)) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar solicitudes.' });
    }
    const { estatus } = req.body;
=======
// Marca una solicitud como atendida/descartada. Mismo alcance que el listado: exclusivo
// de Admin/Coordinador.
app.put('/api/solicitudes/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { estatus } = req.body; // 'Atendida' | 'Descartada'
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    if (!['Atendida', 'Descartada'].includes(estatus)) {
        return res.status(400).json({ success: false, message: 'Estatus inválido.' });
    }
    const idNum = parseInt(req.params.id, 10);
    if (isNaN(idNum)) return res.status(400).json({ success: false, message: 'ID de solicitud inválido.' });
    try {
        const columnaId = await obtenerColumnaPkSolicitudes();
        const actual = await pool.query(`SELECT * FROM Solicitudes_Web WHERE ${columnaId} = $1`, [idNum]);
        if (actual.rows.length === 0) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
<<<<<<< HEAD
        const solicitud = actual.rows[0];
        if (!esStaffCompleto && solicitud.tipo_solicitud !== 'Compartir Historia de Éxito') {
            return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar esta solicitud.' });
        }
=======
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
        await pool.query(`UPDATE Solicitudes_Web SET estatus = $1 WHERE ${columnaId} = $2`, [estatus, idNum]);
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar solicitud:", error);
        res.status(500).json({ success: false });
    }
});

function usuarioOpcionalDesdeToken(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try { return jwt.verify(token, process.env.JWT_SECRET); } catch (e) { return null; }
}

app.get('/api/reportes/exportar', verificarToken, requiereRol(ROL_ADMIN, ROL_COORDINADOR), async (req, res) => {
    const { tipo, anio, mes } = req.query;
    const construirFiltroFecha = (columna) => {
        const condiciones = [];
        const params = [];
        if (anio && anio !== 'todos') { params.push(parseInt(anio, 10)); condiciones.push(`EXTRACT(YEAR FROM ${columna}) = $${params.length}`); }
        if (mes && mes !== 'todos') { params.push(parseInt(mes, 10)); condiciones.push(`EXTRACT(MONTH FROM ${columna}) = $${params.length}`); }
        return { clausula: condiciones.length ? 'AND ' + condiciones.join(' AND ') : '', params };
    };
    try {
        if (tipo === 'voluntarios') {
            const f = construirFiltroFecha('u.fecha_registro');
            const result = await pool.query(`
                SELECT u.nombre_completo, u.correo, u.telefono, r.nombre_rol, u.especialidad,
                       COALESCE(u.estatus,'Activo') as estatus, u.fecha_registro
                FROM Usuarios u LEFT JOIN Roles r ON u.id_rol = r.id_rol
                WHERE u.id_rol IN (2,3,4,5) ${f.clausula}
                ORDER BY u.fecha_registro DESC
            `, f.params);
            return res.json({ success: true, data: result.rows });
        }
        if (tipo === 'eventos') {
            const fE = construirFiltroFecha('e.fecha_realizacion');
            const eventosRes = await pool.query(`
                SELECT e.titulo_evento as titulo, e.tipo_evento as tipo, 'Evento' as categoria, e.fecha_realizacion as fecha,
                       COALESCE(esc.nombre_escuela, 'Sede S.A.C.') as lugar,
                       (SELECT COUNT(*) FROM Participacion p WHERE p.id_evento = e.id_evento) as num_asistentes
                FROM Eventos e LEFT JOIN Escuelas esc ON e.id_escuela = esc.id_escuela
                WHERE e.tipo_evento != 'Entrevista' ${fE.clausula}
            `, fE.params);
            const fV = construirFiltroFecha('av.fecha_cita');
            const visitasRes = await pool.query(`
                SELECT 'Visita de Prospección' as titulo, 'Visita Escolar' as tipo, 'Visita' as categoria,
                       av.fecha_cita as fecha, esc.nombre_escuela as lugar, 0 as num_asistentes
                FROM Agenda_Visitas av JOIN Escuelas esc ON av.id_escuela = esc.id_escuela
                WHERE TRUE ${fV.clausula}
            `, fV.params);
            const todos = [...eventosRes.rows, ...visitasRes.rows].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            return res.json({ success: true, data: todos });
        }
        if (tipo === 'beneficiarios') {
            const f = construirFiltroFecha('b.fecha_registro');
            const result = await pool.query(`
                SELECT b.nombre_completo, b.genero, b.colonia_puebla, COALESCE(esc.nombre_escuela,'N/A') as escuela,
                       COALESCE(u.nombre_completo,'Sin asignar') as especialista, COALESCE(b.estatus,'ACTIVO') as estatus, b.fecha_registro
                FROM Beneficiarios b
                LEFT JOIN Escuelas esc ON b.id_escuela = esc.id_escuela
                LEFT JOIN Usuarios u ON b.id_especialista = u.id_usuario
                WHERE TRUE ${f.clausula}
                ORDER BY b.fecha_registro DESC
            `, f.params);
            return res.json({ success: true, data: result.rows });
        }
        if (tipo === 'donativos') {
            const f = construirFiltroFecha('d.fecha_donacion');
            // Degrada sin registrado_por si todavía no se corrió la migración que agrega
            // id_usuario_registro (mismo patrón que /api/donativos).
            try {
                const result = await pool.query(`
                    SELECT d.fecha_donacion, c.nombre_aliado, d.monto, d.metodo_pago, d.categoria_gasto, i.nombre_insumo,
                           ur.nombre_completo AS registrado_por
                    FROM Donaciones d JOIN Contactos_Externos c ON d.id_contacto = c.id_contacto
                    LEFT JOIN Insumos i ON d.id_insumo = i.id_insumo
                    LEFT JOIN Usuarios ur ON d.id_usuario_registro = ur.id_usuario
                    WHERE TRUE ${f.clausula}
                    ORDER BY d.fecha_donacion DESC
                `, f.params);
                return res.json({ success: true, data: result.rows });
            } catch (colErr) {
                const result = await pool.query(`
                    SELECT d.fecha_donacion, c.nombre_aliado, d.monto, d.metodo_pago, d.categoria_gasto, i.nombre_insumo
                    FROM Donaciones d JOIN Contactos_Externos c ON d.id_contacto = c.id_contacto
                    LEFT JOIN Insumos i ON d.id_insumo = i.id_insumo
                    WHERE TRUE ${f.clausula}
                    ORDER BY d.fecha_donacion DESC
                `, f.params);
                return res.json({ success: true, data: result.rows });
            }
        }
        if (tipo === 'satisfaccion') {
            const f = construirFiltroFecha('en.fecha_respuesta');
            // Primero se intenta con las columnas de la migración v2 (trato del especialista,
            // puntualidad, utilidad de la sesión, NPS); si esas columnas no existen todavía,
            // se degrada a solo calificación general + comentarios en vez de fallar.
            try {
                const result = await pool.query(`
                    SELECT en.fecha_respuesta, b.nombre_completo AS beneficiario,
                           COALESCE(u.nombre_completo, 'N/A') AS especialista, en.calificacion,
                           en.calificacion_especialista, en.calificacion_puntualidad,
                           en.utilidad_sesion, en.probabilidad_recomendar, en.comentarios
                    FROM Encuestas_Satisfaccion en
                    JOIN Beneficiarios b ON en.id_beneficiario = b.id_beneficiario
                    LEFT JOIN Usuarios u ON en.id_especialista = u.id_usuario
                    WHERE en.respondida = TRUE ${f.clausula}
                    ORDER BY en.fecha_respuesta DESC
                `, f.params);
                return res.json({ success: true, data: result.rows });
            } catch (encErr) {
                try {
                    const result = await pool.query(`
                        SELECT en.fecha_respuesta, b.nombre_completo AS beneficiario,
                               COALESCE(u.nombre_completo, 'N/A') AS especialista, en.calificacion, en.comentarios
                        FROM Encuestas_Satisfaccion en
                        JOIN Beneficiarios b ON en.id_beneficiario = b.id_beneficiario
                        LEFT JOIN Usuarios u ON en.id_especialista = u.id_usuario
                        WHERE en.respondida = TRUE ${f.clausula}
                        ORDER BY en.fecha_respuesta DESC
                    `, f.params);
                    return res.json({ success: true, data: result.rows });
                } catch (encErr2) {
                    // La tabla todavía no existe (falta correr la migración) — reportamos vacío
                    // en vez de tumbar el reporte completo.
                    console.error("No se pudo incluir satisfacción en el reporte (¿falta la migración?):", encErr2.message);
                    return res.json({ success: true, data: [] });
                }
            }
        }
        if (tipo === 'satisfaccion_especialistas') {
            // Igual que 'satisfaccion': si las columnas de la migración v2 no existen todavía,
            // degrada a solo el promedio general en vez de tumbar el reporte completo.
            const f = construirFiltroFecha('en.fecha_respuesta');
            try {
                const result = await pool.query(`
                    SELECT COALESCE(u.nombre_completo, 'N/A') AS especialista,
                           COUNT(*) AS total_encuestas,
                           ROUND(AVG(en.calificacion)::numeric, 2) AS promedio_general,
                           ROUND(AVG(en.calificacion_especialista)::numeric, 2) AS promedio_trato,
                           ROUND(AVG(en.calificacion_puntualidad)::numeric, 2) AS promedio_puntualidad,
                           ROUND(AVG(en.probabilidad_recomendar)::numeric, 2) AS promedio_nps,
                           COUNT(*) FILTER (WHERE en.calificacion <= 2) AS respuestas_negativas
                    FROM Encuestas_Satisfaccion en
                    LEFT JOIN Usuarios u ON en.id_especialista = u.id_usuario
                    WHERE en.respondida = TRUE ${f.clausula}
                    GROUP BY u.id_usuario, u.nombre_completo
                    ORDER BY promedio_general DESC NULLS LAST
                `, f.params);
                return res.json({ success: true, data: result.rows });
            } catch (encErr) {
                try {
                    const result = await pool.query(`
                        SELECT COALESCE(u.nombre_completo, 'N/A') AS especialista,
                               COUNT(*) AS total_encuestas,
                               ROUND(AVG(en.calificacion)::numeric, 2) AS promedio_general,
                               COUNT(*) FILTER (WHERE en.calificacion <= 2) AS respuestas_negativas
                        FROM Encuestas_Satisfaccion en
                        LEFT JOIN Usuarios u ON en.id_especialista = u.id_usuario
                        WHERE en.respondida = TRUE ${f.clausula}
                        GROUP BY u.id_usuario, u.nombre_completo
                        ORDER BY promedio_general DESC NULLS LAST
                    `, f.params);
                    return res.json({ success: true, data: result.rows });
                } catch (encErr2) {
                    console.error("No se pudo generar el reporte de satisfacción por especialista (¿falta la migración?):", encErr2.message);
                    return res.json({ success: true, data: [] });
                }
            }
        }
        if (tipo === 'escuelas') {
            // No se filtra por año/mes: una escuela no tiene una sola fecha representativa
            // (se registró en un momento pero puede tener visitas en varios períodos), así
            // que este reporte siempre trae el directorio completo.
            const result = await pool.query(`
                SELECT e.nombre_escuela AS escuela, COALESCE(e.contacto_nombre, 'N/A') AS contacto,
                       COALESCE(e.puesto_contacto, '-') AS puesto, COALESCE(e.telefono_escuela, '-') AS telefono,
                       COALESCE(e.ubicacion, '-') AS ubicacion,
                       CASE WHEN COALESCE(e.activo, TRUE) THEN 'Activa' ELSE 'Archivada' END AS estado,
                       MAX(av.fecha_cita) AS ultima_visita,
                       COUNT(DISTINCT b.id_beneficiario) AS beneficiarios_vinculados
                FROM Escuelas e
                LEFT JOIN Agenda_Visitas av ON av.id_escuela = e.id_escuela
                LEFT JOIN Beneficiarios b ON b.id_escuela = e.id_escuela
                GROUP BY e.id_escuela
                ORDER BY e.nombre_escuela ASC
            `);
            return res.json({ success: true, data: result.rows });
        }
        return res.status(400).json({ success: false, message: 'Tipo de reporte inválido.' });
    } catch (error) {
        console.error("Error al generar reporte de exportación:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.get('/api/dashboard/resumen', async (req, res) => {
    try {
        const usuario = usuarioOpcionalDesdeToken(req);
        const esCoordinadorPropio = usuario && usuario.rol === ROL_COORDINADOR;

        const [beneficiariosAtendidos, voluntarios, visitas, bajoStock, solicitudes, donacionesMes] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM Beneficiarios"),
            pool.query("SELECT COUNT(*) FROM Usuarios WHERE COALESCE(estatus,'Activo') = 'Activo' AND id_rol IN (2,4,5)"),
            esCoordinadorPropio
                ? pool.query("SELECT COUNT(*) FROM Agenda_Visitas WHERE estatus_alerta IN ('Pendiente', 'Confirmado (3 días)') AND id_usuario_creador = $1", [usuario.id])
                : pool.query("SELECT COUNT(*) FROM Agenda_Visitas WHERE estatus_alerta IN ('Pendiente', 'Confirmado (3 días)')"),
            pool.query("SELECT COUNT(*) FROM Insumos WHERE stock_actual <= punto_reorden"),
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM Solicitudes_Web WHERE estatus = 'Pendiente') +
                    (SELECT COUNT(*) FROM Usuarios WHERE estatus = 'Nuevo') AS count
            `),
            pool.query("SELECT COALESCE(SUM(monto),0) AS total FROM Donaciones WHERE date_trunc('month', fecha_donacion) = date_trunc('month', CURRENT_DATE)")
        ]);

        // Encuestas de satisfacción insatisfactorias (calificación 1-2) sin revisar todavía —
        // solo le interesa a Admin/Coordinador; para cualquier otro rol (o visitante anónimo)
        // se manda 0 para que no aparezca en su campana de notificaciones. Va en try/catch
        // aparte porque depende de columnas de la migración v2 que puede no haber corrido.
        let encuestasPorRevisar = 0;
        if (usuario && (usuario.rol === ROL_ADMIN || usuario.rol === ROL_COORDINADOR)) {
            try {
                const r = await pool.query(
                    "SELECT COUNT(*) FROM Encuestas_Satisfaccion WHERE respondida = TRUE AND calificacion <= 2 AND COALESCE(revisada, FALSE) = FALSE"
                );
                encuestasPorRevisar = parseInt(r.rows[0].count, 10);
            } catch (encErr) {
                console.error("No se pudo calcular encuestas por revisar (¿falta la migración?):", encErr.message);
            }
        }

        const actividad = esCoordinadorPropio
            ? await pool.query(`
                (SELECT 'Visita agendada' AS titulo, esc.nombre_escuela AS detalle, av.fecha_cita AS fecha
                 FROM Agenda_Visitas av JOIN Escuelas esc ON av.id_escuela = esc.id_escuela
                 WHERE av.id_usuario_creador = $1 ORDER BY av.fecha_cita DESC LIMIT 3)
                UNION ALL
                (SELECT 'Evento registrado' AS titulo, titulo_evento AS detalle, fecha_realizacion AS fecha
                 FROM Eventos WHERE tipo_evento NOT IN ('Entrevista', 'Cita Clínica') ORDER BY fecha_realizacion DESC LIMIT 3)
                ORDER BY fecha DESC LIMIT 6
              `, [usuario.id])
            : await pool.query(`
                (SELECT 'Nueva solicitud web' AS titulo, nombre_contacto || ' - ' || tipo_solicitud AS detalle, fecha_envio AS fecha FROM Solicitudes_Web ORDER BY fecha_envio DESC LIMIT 3)
                UNION ALL
                (SELECT 'Evento registrado' AS titulo, titulo_evento AS detalle, fecha_realizacion AS fecha FROM Eventos WHERE tipo_evento NOT IN ('Entrevista') ORDER BY fecha_realizacion DESC LIMIT 3)
                UNION ALL
                (SELECT 'Nuevo integrante' AS titulo, nombre_completo || ' se unió al equipo' AS detalle, fecha_registro AS fecha FROM Usuarios WHERE fecha_registro IS NOT NULL ORDER BY fecha_registro DESC LIMIT 3)
                ORDER BY fecha DESC LIMIT 6
              `);

        res.json({
            success: true,
            data: {
                beneficiarios_atendidos: parseInt(beneficiariosAtendidos.rows[0].count, 10),
                voluntarios_activos: parseInt(voluntarios.rows[0].count, 10),
                visitas_programadas: parseInt(visitas.rows[0].count, 10),
                insumos_bajo_stock: parseInt(bajoStock.rows[0].count, 10),
                solicitudes_pendientes: parseInt(solicitudes.rows[0].count, 10),
                donaciones_mes: parseFloat(donacionesMes.rows[0].total),
                actividad_reciente: actividad.rows,
                vista_filtrada_coordinador: !!esCoordinadorPropio,
                encuestas_por_revisar: encuestasPorRevisar
            }
        });
    } catch (error) {
        console.error("Error al generar el resumen del dashboard:", error);
        res.status(500).json({ success: false });
    }
});

const METRICAS_IMPACTO = {
    beneficiarios: {
        etiqueta: 'Beneficiarios recibidos por mes (nuevos registros)',
        sql: `SELECT date_trunc('month', fecha_registro) AS mes, COUNT(*) AS total
              FROM Beneficiarios WHERE date_part('year', fecha_registro) = $1 GROUP BY mes`,
        sqlAnios: `SELECT DISTINCT date_part('year', fecha_registro)::int AS anio FROM Beneficiarios ORDER BY anio DESC`,
        formato: 'entero'
    },
    voluntarios: {
        etiqueta: 'Voluntarios distintos que participaron por mes',
        sql: `SELECT date_trunc('month', e.fecha_realizacion) AS mes, COUNT(DISTINCT p.id_usuario) AS total
              FROM Participacion p JOIN Eventos e ON p.id_evento = e.id_evento
              WHERE date_part('year', e.fecha_realizacion) = $1 GROUP BY mes`,
        sqlAnios: `SELECT DISTINCT date_part('year', e.fecha_realizacion)::int AS anio FROM Participacion p JOIN Eventos e ON p.id_evento = e.id_evento ORDER BY anio DESC`,
        formato: 'entero'
    },
    donaciones: {
        etiqueta: 'Monto recibido en donaciones por mes ($)',
        sql: `SELECT date_trunc('month', fecha_donacion) AS mes, COALESCE(SUM(monto),0) AS total
              FROM Donaciones WHERE date_part('year', fecha_donacion) = $1 GROUP BY mes`,
        sqlAnios: `SELECT DISTINCT date_part('year', fecha_donacion)::int AS anio FROM Donaciones ORDER BY anio DESC`,
        formato: 'moneda'
    },
    eventos: {
        etiqueta: 'Eventos y actividades realizadas por mes',
        sql: `SELECT date_trunc('month', fecha_realizacion) AS mes, COUNT(*) AS total
              FROM Eventos WHERE tipo_evento != 'Entrevista' AND date_part('year', fecha_realizacion) = $1 GROUP BY mes`,
        sqlAnios: `SELECT DISTINCT date_part('year', fecha_realizacion)::int AS anio FROM Eventos WHERE tipo_evento != 'Entrevista' ORDER BY anio DESC`,
        formato: 'entero'
    },
    participacion: {
        etiqueta: 'Personas que participaron por mes (voluntarios + ciudadanos reportados)',
        sql: `SELECT date_trunc('month', e.fecha_realizacion) AS mes,
                     SUM(
                         COALESCE((SELECT COUNT(*) FROM Participacion p WHERE p.id_evento = e.id_evento), 0) +
                         COALESCE((SELECT COUNT(*) FROM Asistencia_Beneficiarios ab WHERE ab.id_evento = e.id_evento), 0) +
                         COALESCE((SELECT SUM(re.numero_asistentes) FROM Reportes_Evento re WHERE re.id_evento = e.id_evento), 0)
                     ) AS total
              FROM Eventos e
              WHERE e.tipo_evento != 'Entrevista' AND date_part('year', e.fecha_realizacion) = $1
              GROUP BY mes`,
        sqlAnios: `SELECT DISTINCT date_part('year', fecha_realizacion)::int AS anio FROM Eventos WHERE tipo_evento != 'Entrevista' ORDER BY anio DESC`,
        formato: 'entero'
    }
};

app.get('/api/dashboard/impacto_mensual', async (req, res) => {
    try {
        const metricaKey = METRICAS_IMPACTO[req.query.metrica] ? req.query.metrica : 'beneficiarios';
        const metrica = METRICAS_IMPACTO[metricaKey];
        const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();

        const result = await pool.query(metrica.sql, [anio]);

        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const porMes = new Array(12).fill(0);
        result.rows.forEach(r => {
            const idx = new Date(r.mes).getUTCMonth();
            porMes[idx] = metrica.formato === 'moneda' ? parseFloat(r.total) : parseInt(r.total, 10);
        });

        const aniosDisponibles = await pool.query(metrica.sqlAnios);
        let listaAnios = aniosDisponibles.rows.map(r => r.anio);
        if (listaAnios.length === 0) listaAnios = [new Date().getFullYear()];
        if (!listaAnios.includes(anio)) listaAnios.unshift(anio);

        res.json({
            success: true,
            data: meses.map((m, i) => ({ mes: m, total: porMes[i] })),
            anio_actual: anio,
            anios_disponibles: listaAnios,
            metrica_actual: metricaKey,
            etiqueta: metrica.etiqueta,
            formato: metrica.formato
        });
    } catch (error) {
        console.error("Error al calcular impacto mensual:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/dashboard/comparativa_beneficiarios', async (req, res) => {
    try {
        const anio = parseInt(req.query.anio, 10) || new Date().getFullYear();
        const result = await pool.query(`
            SELECT date_trunc('month', fecha_registro) AS mes,
                   COUNT(*) FILTER (WHERE estatus = 'ACTIVO') AS activos,
                   COUNT(*) FILTER (WHERE estatus = 'EN PAUSA') AS en_pausa,
                   COUNT(*) FILTER (WHERE estatus = 'ALTA') AS altas
            FROM Beneficiarios
            WHERE date_part('year', fecha_registro) = $1
            GROUP BY mes
        `, [anio]);

        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const activosPorMes = new Array(12).fill(0);
        const enPausaPorMes = new Array(12).fill(0);
        const altasPorMes = new Array(12).fill(0);
        result.rows.forEach(r => {
            const idx = new Date(r.mes).getUTCMonth();
            activosPorMes[idx] = parseInt(r.activos, 10);
            enPausaPorMes[idx] = parseInt(r.en_pausa, 10);
            altasPorMes[idx] = parseInt(r.altas, 10);
        });

        const aniosDisponibles = await pool.query(`SELECT DISTINCT date_part('year', fecha_registro)::int AS anio FROM Beneficiarios ORDER BY anio DESC`);
        let listaAnios = aniosDisponibles.rows.map(r => r.anio);
        if (listaAnios.length === 0) listaAnios = [new Date().getFullYear()];
        if (!listaAnios.includes(anio)) listaAnios.unshift(anio);

        res.json({
            success: true,
            data: meses.map((m, i) => ({ mes: m, activos: activosPorMes[i], en_pausa: enPausaPorMes[i], altas: altasPorMes[i] })),
            anio_actual: anio,
            anios_disponibles: listaAnios
        });
    } catch (error) {
        console.error("Error al calcular comparativa de beneficiarios:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/dashboard/top_eventos', async (req, res) => {
    try {
        const limite = parseInt(req.query.limite, 10) || 5;
        const result = await pool.query(`
            SELECT e.id_evento, e.titulo_evento, e.tipo_evento, e.fecha_realizacion,
                   COALESCE((SELECT COUNT(*) FROM Participacion p WHERE p.id_evento = e.id_evento), 0) AS num_staff,
                   COALESCE((SELECT COUNT(*) FROM Asistencia_Beneficiarios ab WHERE ab.id_evento = e.id_evento), 0) AS num_beneficiarios,
                   COALESCE((SELECT SUM(re.numero_asistentes) FROM Reportes_Evento re WHERE re.id_evento = e.id_evento), 0) AS asistentes_reportados
            FROM Eventos e
            WHERE e.tipo_evento != 'Entrevista'
            ORDER BY (
                COALESCE((SELECT SUM(re.numero_asistentes) FROM Reportes_Evento re WHERE re.id_evento = e.id_evento), 0) +
                COALESCE((SELECT COUNT(*) FROM Participacion p WHERE p.id_evento = e.id_evento), 0) +
                COALESCE((SELECT COUNT(*) FROM Asistencia_Beneficiarios ab WHERE ab.id_evento = e.id_evento), 0)
            ) DESC
            LIMIT $1
        `, [limite]);
        const data = result.rows.map(r => ({
            ...r,
            asistentes_reportados: parseInt(r.asistentes_reportados, 10),
            total_participantes: parseInt(r.num_staff, 10) + parseInt(r.num_beneficiarios, 10) + parseInt(r.asistentes_reportados, 10)
        }));
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al calcular top eventos:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/dashboard/top_voluntarios', async (req, res) => {
    try {
        const limite = parseInt(req.query.limite, 10) || 5;
        const result = await pool.query(`
            SELECT u.id_usuario, u.nombre_completo, u.especialidad, r.nombre_rol,
                   COUNT(p.id_evento) AS num_eventos,
                   COALESCE(SUM(p.horas_invertidas), 0) AS horas_totales
            FROM Participacion p
            JOIN Usuarios u ON p.id_usuario = u.id_usuario
            LEFT JOIN Roles r ON u.id_rol = r.id_rol
            GROUP BY u.id_usuario, u.nombre_completo, u.especialidad, r.nombre_rol
            ORDER BY num_eventos DESC
            LIMIT $1
        `, [limite]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al calcular top voluntarios:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/dashboard/acuerdos_pendientes', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT av.id_visita, esc.nombre_escuela, av.fecha_cita, av.estatus_alerta
            FROM Agenda_Visitas av
            JOIN Escuelas esc ON av.id_escuela = esc.id_escuela
            WHERE av.estatus_alerta NOT IN ('Realizado', 'Cancelado')
            ORDER BY av.fecha_cita ASC
            LIMIT 6
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al obtener acuerdos pendientes:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/transparencia', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT categoria_gasto, COALESCE(SUM(monto),0) AS total
            FROM Donaciones
            WHERE categoria_gasto IS NOT NULL
            GROUP BY categoria_gasto
            ORDER BY total DESC
        `);
        const granTotal = result.rows.reduce((acc, r) => acc + parseFloat(r.total), 0);
        const data = result.rows.map(r => ({
            categoria: r.categoria_gasto,
            total: parseFloat(r.total),
            porcentaje: granTotal > 0 ? Math.round((parseFloat(r.total) / granTotal) * 100) : 0
        }));
        res.json({ success: true, data, gran_total: granTotal });
    } catch (error) {
        console.error("Error al calcular transparencia financiera:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/necesidades_donacion', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id_insumo, nombre_insumo, unidad_medida, stock_actual, punto_reorden, area_proyecto
            FROM Insumos
            WHERE stock_actual <= punto_reorden
            ORDER BY (stock_actual / NULLIF(punto_reorden, 0)) ASC NULLS FIRST, nombre_insumo ASC
        `);
        const data = result.rows.map(r => {
            const stock = parseFloat(r.stock_actual);
            const meta = parseFloat(r.punto_reorden);
            let porcentaje = 0;
            if (meta > 0) porcentaje = Math.min(100, Math.round((stock / meta) * 100));
            else porcentaje = stock > 0 ? 100 : 0;
            return { ...r, porcentaje };
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al calcular necesidades de donación:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/eventos_publicos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.id_evento, e.titulo_evento, e.tipo_evento, e.fecha_realizacion, e.url_imagen,
                   esc.nombre_escuela
            FROM Eventos e
            LEFT JOIN Escuelas esc ON e.id_escuela = esc.id_escuela
            WHERE e.tipo_evento NOT IN ('Entrevista', 'Cita Clínica')
              AND e.fecha_realizacion >= (NOW() AT TIME ZONE 'America/Mexico_City')
            ORDER BY e.fecha_realizacion ASC
            LIMIT 10
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar eventos públicos:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/eventos_anteriores', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.id_evento, e.titulo_evento, e.tipo_evento, e.fecha_realizacion, e.url_imagen,
                   esc.nombre_escuela
            FROM Eventos e
            LEFT JOIN Escuelas esc ON e.id_escuela = esc.id_escuela
            WHERE e.tipo_evento NOT IN ('Entrevista', 'Cita Clínica')
              AND e.fecha_realizacion < (NOW() AT TIME ZONE 'America/Mexico_City')
            ORDER BY e.fecha_realizacion DESC
            LIMIT 20
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar eventos anteriores:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/eventos_calendario_publico', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.id_evento, e.titulo_evento, e.tipo_evento, e.fecha_realizacion, e.url_imagen,
                   esc.nombre_escuela
            FROM Eventos e
            LEFT JOIN Escuelas esc ON e.id_escuela = esc.id_escuela
            WHERE e.tipo_evento NOT IN ('Entrevista', 'Cita Clínica')
            ORDER BY e.fecha_realizacion ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar eventos del calendario público:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/eventos/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.id_evento, e.titulo_evento, e.tipo_evento, e.fecha_realizacion, e.url_imagen,
                   e.direccion_mapa, e.link_reunion, e.descripcion,
                   esc.nombre_escuela
            FROM Eventos e
            LEFT JOIN Escuelas esc ON e.id_escuela = esc.id_escuela
            WHERE e.id_evento = $1 AND e.tipo_evento NOT IN ('Entrevista', 'Cita Clínica')
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Evento no encontrado.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Error al obtener evento:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.get('/api/publicaciones', async (req, res) => {
    const { tipo, categoria, limite, incluir_historias } = req.query;
    const usuario = usuarioOpcionalDesdeToken(req);
=======
// ==========================================
// MÓDULO CMS: PUBLICACIONES
// Tabla Publicaciones: id_publicacion, titulo, contenido, url_imagen,
// tipo ('Aviso'|'Evento'|'Historia de Éxito'|libre), categoria, fecha_post,
// url_documento_consentimiento, id_evento_relacionado, id_autor, id_editor.
// Alimenta: carrusel de "Nuestros Proyectos" en index, comunidad_blog y evento_detalle.
// Las Historias de Éxito se gestionan desde esta misma pantalla de administración pero, por
// requerir datos de un beneficiario (consentimiento, id_beneficiario), viven en la tabla
// Historias_Exito. Cada fila del listado trae "origen" ('publicacion' | 'historia') para que
// el frontend sepa a qué endpoint mandar la edición/borrado.
// ==========================================

// 0. Categorías — catálogo persistente para el selector de Publicaciones y Eventos (antes las
//    categorías "Otro" solo se guardaban como texto suelto y nunca se reutilizaban). Cualquier
//    categoría nueva se registra aquí automáticamente al guardar una publicación o evento (ver
//    registrarCategorias) y también puede registrarse al vuelo desde el mini-buscador del panel
//    (POST get-or-create), para que quede disponible de inmediato.
//
//    Desde migracion_normalizacion_categorias_v1.sql, la relación real entre una publicación/
//    evento y sus categorías vive en las tablas de unión Publicaciones_Categorias /
//    Eventos_Categorias (normalizadas, con integridad referencial real contra esta tabla) — las
//    columnas Publicaciones.categoria / Eventos.categoria (texto separado por comas) se conservan
//    solo como caché de lectura y por compatibilidad con datos_demo_sanctorum.sql, pero ya no son
//    la fuente de verdad para consultas ni filtros.
app.get('/api/categorias', async (req, res) => {
    try {
        const result = await pool.query('SELECT id_categoria, nombre_categoria FROM Categorias ORDER BY nombre_categoria ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar categorías:", error);
        res.status(500).json({ success: false, data: [] });
    }
});

app.post('/api/categorias', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    const nombre = (req.body?.nombre || '').trim();
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio.' });
    try {
        // "Get or create" en una sola consulta: si ya existe (choca con el UNIQUE de
        // nombre_categoria) el DO UPDATE la deja igual pero permite devolverla con RETURNING.
        const result = await pool.query(
            `INSERT INTO Categorias (nombre_categoria) VALUES ($1)
             ON CONFLICT (nombre_categoria) DO UPDATE SET nombre_categoria = EXCLUDED.nombre_categoria
             RETURNING id_categoria, nombre_categoria`,
            [nombre]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Error al registrar categoría:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

// Registra en el catálogo Categorias cualquier categoría nueva que llegue en una publicación o
// evento (string separado por comas, p.ej. "Infancia, Mi categoría nueva") y, si se le pasa a qué
// entidad pertenece (segundo parámetro "entidad"), sincroniza también la tabla de unión
// normalizada correspondiente (Publicaciones_Categorias / Eventos_Categorias) -- se hace con un
// DELETE + INSERT del conjunto completo en cada guardado, porque es más simple y seguro que
// calcular un diff, y el volumen de categorías por publicación/evento es siempre pequeño.
// Nunca lanza: que falle el registro en el catálogo o la sincronización no debe tumbar el
// guardado de la publicación/evento en sí (igual que antes).
async function registrarCategorias(categoriaStr, entidad) {
    const nombres = (categoriaStr || '').split(',').map((s) => s.trim()).filter(Boolean);
    const idsCategoria = [];
    for (const nombre of nombres) {
        try {
            const r = await pool.query(
                `INSERT INTO Categorias (nombre_categoria) VALUES ($1)
                 ON CONFLICT (nombre_categoria) DO UPDATE SET nombre_categoria = EXCLUDED.nombre_categoria
                 RETURNING id_categoria`,
                [nombre]
            );
            idsCategoria.push(r.rows[0].id_categoria);
        } catch (error) {
            console.error("Error al registrar categoría en catálogo:", nombre, error);
        }
    }
    if (!entidad) return;
    try {
        if (entidad.tipo === 'publicacion') {
            await pool.query('DELETE FROM Publicaciones_Categorias WHERE id_publicacion = $1', [entidad.id]);
            for (const idCat of idsCategoria) {
                await pool.query('INSERT INTO Publicaciones_Categorias (id_publicacion, id_categoria) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entidad.id, idCat]);
            }
        } else if (entidad.tipo === 'evento') {
            await pool.query('DELETE FROM Eventos_Categorias WHERE id_evento = $1', [entidad.id]);
            for (const idCat of idsCategoria) {
                await pool.query('INSERT INTO Eventos_Categorias (id_evento, id_categoria) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entidad.id, idCat]);
            }
        }
    } catch (error) {
        console.error("Error al sincronizar tabla de unión de categorías:", entidad, error);
    }
}

// 1. Listar (público). Por defecto solo Publicaciones; con ?incluir_historias=1 (usado por el
//    panel de administración) también trae las Historias de Éxito para gestionarlas juntas.
app.get('/api/publicaciones', async (req, res) => {
    const { tipo, categoria, limite, incluir_historias } = req.query;
    // incluir_historias=1 solo lo manda el panel de administración (la página pública jamás lo
    // envía). En ese caso, si quien pregunta está identificado y es Voluntario o Especialista,
    // limitamos el listado a lo que él mismo creó — Coordinador/Admin y la vista pública ven todo.
    const usuarioReq = incluir_historias ? usuarioOpcional(req) : null;
    const soloPropias = usuarioReq && (Number(usuarioReq.rol) === ROL_VOLUNTARIO || Number(usuarioReq.rol) === ROL_ESPECIALISTA);
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    try {
        // "categoria" se recalcula desde Publicaciones_Categorias (fuente real de verdad, ver
        // migracion_normalizacion_categorias_v1.sql) en vez de leerse tal cual de la columna de
        // texto -- al llevar el mismo alias que la columna real, la sobreescribe en cada fila del
        // resultado (pg asigna las propiedades en el orden de las columnas devueltas).
        let query = `SELECT p.*,
                            (SELECT string_agg(c.nombre_categoria, ', ' ORDER BY c.nombre_categoria)
                               FROM Publicaciones_Categorias pc JOIN Categorias c ON c.id_categoria = pc.id_categoria
                              WHERE pc.id_publicacion = p.id_publicacion) AS categoria,
                            'publicacion' AS origen
                       FROM Publicaciones p`;
        const condiciones = [];
        const params = [];
<<<<<<< HEAD

        if (usuario && (Number(usuario.rol) === ROL_VOLUNTARIO || Number(usuario.rol) === ROL_ESPECIALISTA)) {
            params.push(usuario.id);
            condiciones.push(`id_autor = $${params.length}`);
        }

        if (tipo) { params.push(tipo); condiciones.push(`tipo = $${params.length}`); }
        if (categoria) { params.push(`%${categoria}%`); condiciones.push(`categoria ILIKE $${params.length}`); }
=======
        if (tipo) { params.push(tipo); condiciones.push(`p.tipo = $${params.length}`); }
        // Antes esto buscaba coincidencia parcial (ILIKE) sobre el texto separado por comas, lo
        // que podía dar falsos positivos entre categorías que se contienen entre sí. Con la tabla
        // de unión ya se puede filtrar por igualdad exacta contra el nombre real de la categoría.
        if (categoria) {
            params.push(categoria);
            condiciones.push(`EXISTS (
                SELECT 1 FROM Publicaciones_Categorias pc2 JOIN Categorias c2 ON c2.id_categoria = pc2.id_categoria
                 WHERE pc2.id_publicacion = p.id_publicacion AND c2.nombre_categoria = $${params.length}
            )`);
        }
        if (soloPropias) { params.push(usuarioReq.id); condiciones.push(`p.id_autor = $${params.length}`); }
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
        if (condiciones.length > 0) query += ' WHERE ' + condiciones.join(' AND ');
        query += ' ORDER BY fecha_post DESC';
        if (limite) {
            params.push(parseInt(limite, 10));
            query += ` LIMIT $${params.length}`;
        }
        const result = await pool.query(query, params);
        let data = result.rows;

        if (incluir_historias) {
<<<<<<< HEAD
=======
            const histParams = [];
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            let histQuery = `
                SELECT h.id_historia AS id_publicacion, h.titulo, h.contenido_postayuda AS contenido,
                       NULL::text AS url_imagen, 'Historia de Éxito' AS tipo, NULL::text AS categoria,
                       h.fecha_creacion AS fecha_post, h.url_documento_consentimiento,
                       NULL::int AS id_evento_relacionado, h.id_autor, NULL::int AS id_editor,
                       h.id_beneficiario, h.contenido_preayuda, h.contenido_postayuda, h.consentimiento,
                       'historia' AS origen
<<<<<<< HEAD
                FROM Historias_Exito h
            `;
            const histParams = [];
            if (usuario && (Number(usuario.rol) === ROL_VOLUNTARIO || Number(usuario.rol) === ROL_ESPECIALISTA)) {
                histParams.push(usuario.id);
                histQuery += ` WHERE h.id_autor = $1`;
            }
            histQuery += ` ORDER BY h.fecha_creacion DESC`;
=======
                FROM Historias_Exito h`;
            if (soloPropias) { histParams.push(usuarioReq.id); histQuery += ` WHERE h.id_autor = $${histParams.length}`; }
            histQuery += ' ORDER BY h.fecha_creacion DESC';
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            const hist = await pool.query(histQuery, histParams);
            data = [...data, ...hist.rows].sort((a, b) => new Date(b.fecha_post) - new Date(a.fecha_post));
        }
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al listar publicaciones:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/publicaciones/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*,
                    (SELECT string_agg(c.nombre_categoria, ', ' ORDER BY c.nombre_categoria)
                       FROM Publicaciones_Categorias pc JOIN Categorias c ON c.id_categoria = pc.id_categoria
                      WHERE pc.id_publicacion = p.id_publicacion) AS categoria,
                    'publicacion' AS origen
               FROM Publicaciones p WHERE p.id_publicacion = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Error al obtener publicación:", error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/publicaciones', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    const { titulo, contenido, url_imagen, url_video, tipo, categoria, url_documento_consentimiento, id_evento_relacionado,
            id_beneficiario, contenido_preayuda, contenido_postayuda } = req.body;
    if (!titulo || !tipo) return res.status(400).json({ success: false, message: 'Título y tipo son obligatorios.' });

    const chkImagenPub = validarUrlCloudinaria(url_imagen, 'url_imagen');
    if (!chkImagenPub.ok) return res.status(400).json({ success: false, message: chkImagenPub.mensaje });
    const chkVideoPub = validarUrlCloudinaria(url_video, 'url_video');
    if (!chkVideoPub.ok) return res.status(400).json({ success: false, message: chkVideoPub.mensaje });
    const chkDocConsentimientoPub = validarUrlCloudinaria(url_documento_consentimiento, 'url_documento_consentimiento');
    if (!chkDocConsentimientoPub.ok) return res.status(400).json({ success: false, message: chkDocConsentimientoPub.mensaje });

    if (tipo === 'Historia de Éxito') {
        if (!puedePublicarHistoria(req.usuario)) return res.status(403).json({ success: false, message: 'Solo un psicólogo, coordinador o administrador puede publicar una Historia de Éxito.' });
        if (!url_documento_consentimiento) return res.status(400).json({ success: false, message: 'Para publicar una Historia de Éxito debes subir el documento de consentimiento.' });
        if (!id_beneficiario) return res.status(400).json({ success: false, message: 'Selecciona a qué beneficiario pertenece esta historia.' });
        if (!contenido_preayuda || !contenido_postayuda) return res.status(400).json({ success: false, message: 'Completa el contenido de "antes" y "después".' });
        try {
            const result = await pool.query(
                `INSERT INTO Historias_Exito (id_beneficiario, id_autor, titulo, contenido_preayuda, contenido_postayuda, consentimiento, url_documento_consentimiento, fecha_creacion)
                 VALUES ($1, $2, $3, $4, $5, TRUE, $6, CURRENT_TIMESTAMP) RETURNING id_historia`,
                [id_beneficiario, req.usuario.id, titulo, contenido_preayuda, contenido_postayuda, chkDocConsentimientoPub.valor]
            );
            return res.status(201).json({ success: true, id: result.rows[0].id_historia, origen: 'historia' });
        } catch (error) {
            console.error("Error al crear historia de éxito:", error);
            return res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
        }
    }

    try {
        const result = await pool.query(
            `INSERT INTO Publicaciones (titulo, contenido, url_imagen, url_video, tipo, categoria, fecha_post, url_documento_consentimiento, id_evento_relacionado, id_autor)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9) RETURNING id_publicacion`,
            [titulo, contenido || null, chkImagenPub.valor, chkVideoPub.valor, tipo, categoria || null, chkDocConsentimientoPub.valor, id_evento_relacionado || null, req.usuario.id]
        );
        await registrarCategorias(categoria, { tipo: 'publicacion', id: result.rows[0].id_publicacion });
        res.status(201).json({ success: true, id: result.rows[0].id_publicacion, origen: 'publicacion' });
    } catch (error) {
        console.error("Error al crear publicación:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

<<<<<<< HEAD
=======
// 4. Actualizar — el body debe traer "origen" ('publicacion' | 'historia') para saber a qué
//    tabla debe quedar el registro, y "origen_original" para saber en cuál vive HOY. Ahora que
//    el <select> de Tipo ya no se bloquea al editar (ver publicaciones.html), origen puede venir
//    distinto de origen_original: eso significa que el usuario cruzó de "Publicación normal" a
//    "Historia de Éxito" (o viceversa), lo que implica mover el registro entre tablas —con IDs
//    de columnas distintas (id_publicacion / id_historia)— en vez de un UPDATE normal.
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
app.put('/api/publicaciones/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    const { titulo, contenido, url_imagen, url_video, tipo, categoria, url_documento_consentimiento, id_evento_relacionado,
            id_beneficiario, contenido_preayuda, contenido_postayuda, origen, origen_original } = req.body;
    // Clientes viejos (sin origen_original) no cruzan tipos: se asume que el origen no cambió.
    const origenActual = origen_original || origen;
    const cruzaTablas = origen !== origenActual;

    const chkImagenPubPut = validarUrlCloudinaria(url_imagen, 'url_imagen');
    if (!chkImagenPubPut.ok) return res.status(400).json({ success: false, message: chkImagenPubPut.mensaje });
    const chkVideoPubPut = validarUrlCloudinaria(url_video, 'url_video');
    if (!chkVideoPubPut.ok) return res.status(400).json({ success: false, message: chkVideoPubPut.mensaje });
    const chkDocConsentimientoPubPut = validarUrlCloudinaria(url_documento_consentimiento, 'url_documento_consentimiento');
    if (!chkDocConsentimientoPubPut.ok) return res.status(400).json({ success: false, message: chkDocConsentimientoPubPut.mensaje });

    // --- Sigue siendo Historia de Éxito: UPDATE normal sobre Historias_Exito. ---
    if (origen === 'historia' && !cruzaTablas) {
        if (!puedePublicarHistoria(req.usuario)) return res.status(403).json({ success: false, message: 'Solo un psicólogo, coordinador o administrador puede editar una Historia de Éxito.' });
        if (!url_documento_consentimiento) return res.status(400).json({ success: false, message: 'Para publicar una Historia de Éxito debes subir el documento de consentimiento.' });
        try {
            if (req.usuario.rol !== ROL_ADMIN) {
                const autorHistoria = await pool.query('SELECT id_autor FROM Historias_Exito WHERE id_historia = $1', [req.params.id]);
                if (autorHistoria.rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
                if (Number(autorHistoria.rows[0].id_autor) !== Number(req.usuario.id)) {
                    return res.status(403).json({ success: false, message: 'Solo el autor original o un Admin pueden modificar esta publicación.' });
                }
            }
            const result = await pool.query(
                `UPDATE Historias_Exito SET titulo=$1, contenido_preayuda=$2, contenido_postayuda=$3, url_documento_consentimiento=$4, id_beneficiario=$5, consentimiento=TRUE WHERE id_historia=$6`,
                [titulo, contenido_preayuda, contenido_postayuda, chkDocConsentimientoPubPut.valor, id_beneficiario, req.params.id]
            );
            if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
            return res.json({ success: true, origen: 'historia', id: Number(req.params.id) });
        } catch (error) {
            console.error("Error al actualizar historia de éxito:", error);
            return res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
        }
    }

    // --- Sigue siendo Publicación normal (el tipo puede cambiar libremente entre
    //     Aviso/Evento/Otro: es la misma tabla, no hay cruce). UPDATE normal. ---
    if (origen !== 'historia' && !cruzaTablas) {
        if (tipo === 'Historia de Éxito' && !url_documento_consentimiento) {
            return res.status(400).json({ success: false, message: 'Para publicar una Historia de Éxito debes subir el documento de consentimiento.' });
        }
        try {
            // Solo el autor original o un Admin pueden editar esta publicación.
            if (req.usuario.rol !== ROL_ADMIN) {
                const autorPub = await pool.query('SELECT id_autor FROM Publicaciones WHERE id_publicacion = $1', [req.params.id]);
                if (autorPub.rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
                if (Number(autorPub.rows[0].id_autor) !== Number(req.usuario.id)) {
                    return res.status(403).json({ success: false, message: 'Solo el autor original o un Admin pueden modificar esta publicación.' });
                }
            }
            const result = await pool.query(
                `UPDATE Publicaciones SET titulo=$1, contenido=$2, url_imagen=$3, url_video=$4, tipo=$5, categoria=$6, url_documento_consentimiento=$7, id_evento_relacionado=$8, id_editor=$9 WHERE id_publicacion=$10`,
                [titulo, contenido || null, chkImagenPubPut.valor, chkVideoPubPut.valor, tipo, categoria || null, chkDocConsentimientoPubPut.valor, id_evento_relacionado || null, req.usuario.id, req.params.id]
            );
            if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
            await registrarCategorias(categoria, { tipo: 'publicacion', id: Number(req.params.id) });
            return res.json({ success: true, origen: 'publicacion', id: Number(req.params.id) });
        } catch (error) {
            console.error("Error al actualizar publicación:", error);
            return res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
        }
    }

    // --- Cruce: de Publicación normal a Historia de Éxito. El registro cambia de tabla y de
    //     id (id_publicacion -> id_historia), así que se valida como un alta nueva de historia
    //     (mismos requisitos que POST) y se hace en una transacción: INSERT en Historias_Exito
    //     + DELETE de Publicaciones. Si algo falla, no queda ni a medias ni duplicado. ---
    if (origen === 'historia' && cruzaTablas) {
        if (!puedePublicarHistoria(req.usuario)) return res.status(403).json({ success: false, message: 'Solo un psicólogo, coordinador o administrador puede publicar una Historia de Éxito.' });
        if (!url_documento_consentimiento) return res.status(400).json({ success: false, message: 'Para publicar una Historia de Éxito debes subir el documento de consentimiento.' });
        if (!id_beneficiario) return res.status(400).json({ success: false, message: 'Selecciona a qué beneficiario pertenece esta historia.' });
        if (!contenido_preayuda || !contenido_postayuda) return res.status(400).json({ success: false, message: 'Completa el contenido de "antes" y "después".' });
        try {
            // La autoría a validar es la del registro ORIGINAL (todavía vive en Publicaciones).
            if (req.usuario.rol !== ROL_ADMIN) {
                const autorOriginal = await pool.query('SELECT id_autor FROM Publicaciones WHERE id_publicacion = $1', [req.params.id]);
                if (autorOriginal.rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
                if (Number(autorOriginal.rows[0].id_autor) !== Number(req.usuario.id)) {
                    return res.status(403).json({ success: false, message: 'Solo el autor original o un Admin pueden modificar esta publicación.' });
                }
            }
            await pool.query('BEGIN');
            const insertado = await pool.query(
                `INSERT INTO Historias_Exito (id_beneficiario, id_autor, titulo, contenido_preayuda, contenido_postayuda, consentimiento, url_documento_consentimiento, fecha_creacion)
                 VALUES ($1, $2, $3, $4, $5, TRUE, $6, CURRENT_TIMESTAMP) RETURNING id_historia`,
                [id_beneficiario, req.usuario.id, titulo, contenido_preayuda, contenido_postayuda, chkDocConsentimientoPubPut.valor]
            );
            await pool.query('DELETE FROM Publicaciones WHERE id_publicacion = $1', [req.params.id]);
            await pool.query('COMMIT');
            return res.json({ success: true, cruce: true, origen: 'historia', id: insertado.rows[0].id_historia });
        } catch (error) {
            await pool.query('ROLLBACK');
            console.error("Error al mover publicación a Historia de Éxito:", error);
            return res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
        }
    }

    // --- Cruce: de Historia de Éxito a Publicación normal. Mismo principio al revés:
    //     INSERT en Publicaciones + DELETE de Historias_Exito, en una transacción. ---
    if (!titulo || !tipo) return res.status(400).json({ success: false, message: 'Título y tipo son obligatorios.' });
    if (tipo === 'Historia de Éxito' && !url_documento_consentimiento) {
        return res.status(400).json({ success: false, message: 'Para publicar una Historia de Éxito debes subir el documento de consentimiento.' });
    }
    try {
<<<<<<< HEAD
=======
        // La autoría a validar es la del registro ORIGINAL (todavía vive en Historias_Exito).
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
        if (req.usuario.rol !== ROL_ADMIN) {
            const autorOriginal = await pool.query('SELECT id_autor FROM Historias_Exito WHERE id_historia = $1', [req.params.id]);
            if (autorOriginal.rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
            if (Number(autorOriginal.rows[0].id_autor) !== Number(req.usuario.id)) {
                return res.status(403).json({ success: false, message: 'Solo el autor original o un Admin pueden modificar esta publicación.' });
            }
        }
        await pool.query('BEGIN');
        const insertado = await pool.query(
            `INSERT INTO Publicaciones (titulo, contenido, url_imagen, url_video, tipo, categoria, fecha_post, url_documento_consentimiento, id_evento_relacionado, id_autor)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, $9) RETURNING id_publicacion`,
            [titulo, contenido || null, chkImagenPubPut.valor, chkVideoPubPut.valor, tipo, categoria || null, chkDocConsentimientoPubPut.valor, id_evento_relacionado || null, req.usuario.id]
        );
        await pool.query('DELETE FROM Historias_Exito WHERE id_historia = $1', [req.params.id]);
        await pool.query('COMMIT');
        await registrarCategorias(categoria, { tipo: 'publicacion', id: insertado.rows[0].id_publicacion });
        return res.json({ success: true, cruce: true, origen: 'publicacion', id: insertado.rows[0].id_publicacion });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al mover historia de éxito a publicación:", error);
        return res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

<<<<<<< HEAD
app.delete('/api/publicaciones/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR), async (req, res) => {
=======
// 5. Eliminar — ?origen=historia borra de Historias_Exito, si no de Publicaciones. Se incluye
//    ROL_VOLUNTARIO aquí porque un Voluntario sí puede publicar, y por lo tanto debe poder
//    borrar (solo) lo que él mismo publicó, por si se equivocó — el filtro real de "solo el
//    autor o un Admin" ocurre abajo.
app.delete('/api/publicaciones/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
    try {
        const esHistoria = req.query.origen === 'historia';
        const tablaPub = esHistoria ? 'Historias_Exito' : 'Publicaciones';
        const columnaIdPub = esHistoria ? 'id_historia' : 'id_publicacion';
        if (req.usuario.rol !== ROL_ADMIN) {
            const autorRes = await pool.query(`SELECT id_autor FROM ${tablaPub} WHERE ${columnaIdPub} = $1`, [req.params.id]);
            if (autorRes.rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
            if (Number(autorRes.rows[0].id_autor) !== Number(req.usuario.id)) {
                return res.status(403).json({ success: false, message: 'Solo el autor original o un Admin pueden eliminar esta publicación.' });
            }
        }
        const result = esHistoria
            ? await pool.query('DELETE FROM Historias_Exito WHERE id_historia = $1', [req.params.id])
            : await pool.query('DELETE FROM Publicaciones WHERE id_publicacion = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'No encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar publicación:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/historias_exito', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT h.id_historia, h.titulo, h.contenido_preayuda, h.contenido_postayuda,
                   b.nombre_completo AS nombre_completo_interno, b.fecha_nacimiento
            FROM Historias_Exito h
            JOIN Beneficiarios b ON h.id_beneficiario = b.id_beneficiario
            WHERE h.consentimiento = TRUE
            ORDER BY h.id_historia DESC
        `);
        const data = result.rows.map(r => {
            let edad = null;
            if (r.fecha_nacimiento) {
                const hoy = new Date();
                const nac = new Date(r.fecha_nacimiento);
                edad = hoy.getFullYear() - nac.getFullYear();
                const m = hoy.getMonth() - nac.getMonth();
                if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
            }
            return {
                id_historia: r.id_historia,
                titulo: r.titulo,
                contenido_preayuda: r.contenido_preayuda,
                contenido_postayuda: r.contenido_postayuda,
                protagonista: (r.nombre_completo_interno || '').trim().split(' ')[0] || 'Un beneficiario',
                edad
            };
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al listar historias de éxito:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/equipo', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id_usuario, u.nombre_completo, u.especialidad, u.foto_perfil_url, u.biografia,
                   r.nombre_rol
            FROM Usuarios u
            JOIN Roles r ON u.id_rol = r.id_rol
            WHERE u.id_rol IN (1, 2, 3) AND COALESCE(u.estatus, 'Activo') != 'Inactivo'
            ORDER BY u.id_rol ASC, u.nombre_completo ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar equipo:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/eventos_para_reporte', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id_evento, titulo_evento, tipo_evento, fecha_realizacion
            FROM Eventos
            WHERE tipo_evento NOT IN ('Entrevista', 'Cita Clínica')
              AND fecha_realizacion <= NOW()
            ORDER BY fecha_realizacion DESC
            LIMIT 100
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar eventos para reporte:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/eventos/:id/insumos_consumidos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT ci.id_insumo, i.nombre_insumo, i.unidad_medida, ci.cantidad_usada AS cantidad_planeada
            FROM Consumo_Insumos ci
            JOIN Insumos i ON ci.id_insumo = i.id_insumo
            WHERE ci.id_evento = $1
            ORDER BY i.nombre_insumo ASC
        `, [req.params.id]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar insumos consumidos del evento:", error);
        res.status(500).json({ success: false });
    }
});

<<<<<<< HEAD
app.get('/api/reportes_evento', verificarToken, async (req, res) => {
    try {
        const esStaffGeneral = req.usuario.rol === ROL_ADMIN || req.usuario.rol === ROL_COORDINADOR;
        let filtroAutor = '';
        const params = [];

        if (!esStaffGeneral) {
            params.push(req.usuario.id);
            filtroAutor = 'WHERE r.id_usuario = $1';
        }

=======
// Lista todos los reportes de evento con el título/fecha del evento, el nombre de quien
// reportó, y el equipo de participantes (Participacion) como JSON agregado.
app.get('/api/reportes_evento', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    // Voluntario/Especialista solo ven los reportes que ellos mismos generaron. Admin ve
    // todos. Coordinador ve todos MENOS los de otros Coordinadores (sí ve los de
    // especialistas, voluntarios, admin, y los suyos propios) — un coordinador no supervisa
    // a otro coordinador.
    const soloPropios = req.usuario.rol !== ROL_ADMIN && req.usuario.rol !== ROL_COORDINADOR;
    try {
        const params = [];
        let filtro = '';
        if (soloPropios) {
            params.push(req.usuario.id);
            filtro = `WHERE r.id_usuario = $${params.length}`;
        } else if (req.usuario.rol === ROL_COORDINADOR) {
            params.push(req.usuario.id, ROL_COORDINADOR);
            filtro = `WHERE (u.id_rol IS DISTINCT FROM $${params.length} OR r.id_usuario = $${params.length - 1})`;
        }
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
        const result = await pool.query(`
            SELECT r.*, e.titulo_evento, e.fecha_realizacion, u.nombre_completo AS autor,
                   COALESCE((
                       SELECT json_agg(json_build_object('id_usuario', up.id_usuario, 'nombre_completo', up.nombre_completo) ORDER BY up.nombre_completo)
                       FROM Participacion p JOIN Usuarios up ON p.id_usuario = up.id_usuario
                       WHERE p.id_evento = r.id_evento
                   ), '[]') AS participantes
            FROM Reportes_Evento r
            JOIN Eventos e ON r.id_evento = e.id_evento
            LEFT JOIN Usuarios u ON r.id_usuario = u.id_usuario
<<<<<<< HEAD
            ${filtroAutor}
=======
            ${filtro}
>>>>>>> a0cb2ef6def42bf87fb2cbcb8dd9ea544076d7a0
            ORDER BY r.fecha_reporte DESC
        `, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error al listar reportes de evento:", error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/reportes_evento/:id/participantes', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    const { ids_usuarios } = req.body;
    try {
        const rep = await pool.query('SELECT id_evento FROM Reportes_Evento WHERE id_reporte = $1', [req.params.id]);
        if (rep.rows.length === 0) return res.status(404).json({ success: false, message: 'Reporte no encontrado.' });
        const id_evento = rep.rows[0].id_evento;
        await pool.query('BEGIN');
        await pool.query('DELETE FROM Participacion WHERE id_evento = $1', [id_evento]);
        for (const idUsuario of (ids_usuarios || [])) {
            await pool.query('INSERT INTO Participacion (id_evento, id_usuario, horas_invertidas) VALUES ($1, $2, 0)', [id_evento, idUsuario]);
        }
        await pool.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al actualizar participantes del reporte:", error);
        res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
    }
});

app.post('/api/reportes_evento', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), async (req, res) => {
    const { id_evento, id_usuario, actividades_realizadas, materiales_reales, numero_asistentes, observaciones, url_adjuntos } = req.body;
    if (!id_evento || !id_usuario || !actividades_realizadas) {
        return res.status(400).json({ success: false, message: 'Evento, usuario y actividades realizadas son obligatorios.' });
    }
    const chkAdjuntos = validarUrlsCloudinariaArray(url_adjuntos, 'url_adjuntos');
    if (!chkAdjuntos.ok) return res.status(400).json({ success: false, message: chkAdjuntos.mensaje });
    try {
        await pool.query('BEGIN');

        let resumenMateriales = 'Este evento no tenía materiales planeados en Agenda.';
        if (Array.isArray(materiales_reales) && materiales_reales.length > 0) {
            const partesResumen = [];
            for (const m of materiales_reales) {
                const insumoRes = await pool.query('SELECT nombre_insumo, unidad_medida FROM Insumos WHERE id_insumo = $1', [m.id_insumo]);
                if (insumoRes.rows.length === 0) continue;
                const { nombre_insumo, unidad_medida } = insumoRes.rows[0];

                const planeadoRes = await pool.query('SELECT cantidad_usada FROM Consumo_Insumos WHERE id_evento = $1 AND id_insumo = $2', [id_evento, m.id_insumo]);
                const planeado = planeadoRes.rows.length > 0 ? parseFloat(planeadoRes.rows[0].cantidad_usada) : 0;
                const real = parseFloat(m.cantidad_real) || 0;
                const diferencia = planeado - real;

                if (diferencia !== 0) {
                    await pool.query('UPDATE Insumos SET stock_actual = stock_actual + $1 WHERE id_insumo = $2', [diferencia, m.id_insumo]);
                }
                if (planeadoRes.rows.length > 0) {
                    await pool.query('UPDATE Consumo_Insumos SET cantidad_usada = $1 WHERE id_evento = $2 AND id_insumo = $3', [real, id_evento, m.id_insumo]);
                }

                partesResumen.push(`${nombre_insumo}: ${real} ${unidad_medida} usados (de ${planeado} planeados)`);
            }
            if (partesResumen.length > 0) resumenMateriales = partesResumen.join('; ');
        }

        await pool.query(
            `INSERT INTO Reportes_Evento (id_evento, id_usuario, actividades_realizadas, materiales_utilizados, numero_asistentes, observaciones, url_adjuntos)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id_evento, id_usuario, actividades_realizadas, resumenMateriales, numero_asistentes || null, observaciones || null, chkAdjuntos.valor]
        );

        await pool.query('COMMIT');
        res.status(201).json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al crear reporte de evento:", error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/reportes_evento/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), verificarAutorORol('Reportes_Evento', 'id_reporte', 'id_usuario'), async (req, res) => {
    const { actividades_realizadas, materiales_utilizados, numero_asistentes, observaciones, url_adjuntos } = req.body;
    const chkAdjuntos = validarUrlsCloudinariaArray(url_adjuntos, 'url_adjuntos');
    if (!chkAdjuntos.ok) return res.status(400).json({ success: false, message: chkAdjuntos.mensaje });
    try {
        const result = await pool.query(
            `UPDATE Reportes_Evento SET actividades_realizadas=$1, materiales_utilizados=$2, numero_asistentes=$3, observaciones=$4, url_adjuntos=$5 WHERE id_reporte=$6`,
            [actividades_realizadas, materiales_utilizados || null, numero_asistentes || null, observaciones || null, chkAdjuntos.valor, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Reporte no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al actualizar reporte de evento:", error);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/reportes_evento/:id', verificarToken, requiereRol(ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO), verificarAutorORol('Reportes_Evento', 'id_reporte', 'id_usuario'), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM Reportes_Evento WHERE id_reporte = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Reporte no encontrado.' });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al eliminar reporte de evento:", error);
        res.status(500).json({ success: false });
    }
});

app.get('/api/estadisticas_psicologia', async (req, res) => {
    try {
        const [activos, exitosos] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM Beneficiarios WHERE estatus = 'ACTIVO'"),
            pool.query("SELECT COUNT(*) FROM Beneficiarios WHERE estatus = 'ALTA'")
        ]);
        res.json({
            success: true,
            data: {
                pacientes_activos: parseInt(activos.rows[0].count, 10),
                pacientes_exitosos: parseInt(exitosos.rows[0].count, 10)
            }
        });
    } catch (error) {
        console.error("Error al calcular estadísticas de psicología:", error);
        res.status(500).json({ success: false });
    }
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'Endpoint no encontrado.' });
    }

    if (req.method !== 'GET') return next();

    const publicFile = path.join(__dirname, 'public', `${req.path}.html`);
    const adminFile = path.join(__dirname, 'public', 'admin', `${req.path}.html`);

    res.sendFile(publicFile, (err) => {
        if (!err) return;
        res.sendFile(adminFile, (err2) => {
            if (!err2) return;
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        return res.status(400).json({ success: false, message: 'El cuerpo de la solicitud no es JSON válido.' });
    }
    console.error('Error no manejado:', err);
    res.status(500).json({ success: false, message: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});