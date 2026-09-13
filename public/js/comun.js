/*
 * comun.js — funciones y constantes compartidas por TODO el frontend de Sanctorum.
 */

// ================= ANTI-PARPADEO / SUAVIZADOR GLOBAL (FOUC FIX) =================
(function() {
    // 1. Inyecta el estilo que oculta la página antes de que el navegador empiece a pintar elementos sin formato
    const estiloFouc = document.createElement('style');
    estiloFouc.id = 'estilo-anti-fouc';
    estiloFouc.textContent = `
        body { 
            opacity: 0 !important; 
            transition: opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important; 
        }
        body.pagina-lista { 
            opacity: 1 !important; 
        }
    `;
    document.head.appendChild(estiloFouc);

    // 2. Muestra suavemente la página cuando el DOM y los componentes terminen de procesarse
    function revelarPagina() {
        if (!document.body.classList.contains('pagina-lista')) {
            requestAnimationFrame(() => {
                document.body.classList.add('pagina-lista');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(revelarPagina, 50));
    } else {
        setTimeout(revelarPagina, 50);
    }

    // Fallback de seguridad por si una petición fetch o recurso tarda demasiado
    window.addEventListener('load', revelarPagina);
})();

const API_URL = "";

// ================= ESCAPE DE HTML (H6, generalizado) =================
function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttrJs(valor) {
    return String(valor ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ================= CONTENIDO ENRIQUECIDO DE PUBLICACIONES =================
// El campo "Contenido" de una Publicación se escribe con un editor de texto con formato
// (negritas, listas, enlaces...) en el panel de admin (ver Quill en admin/publicaciones.html),
// así que puede traer HTML real. Las publicaciones guardadas ANTES de agregar ese editor siguen
// teniendo texto plano con saltos de línea reales (un "\n" por línea). Estas funciones son
// compartidas por todas las páginas públicas que leen ese campo, para que ambos casos se vean
// bien sin duplicar esta lógica en cada archivo.

// true si "texto" trae HTML real (viene del editor con formato); false si es texto plano
// "clásico". No es un parser completo, solo un indicio suficiente para decidir cómo pintarlo.
function esContenidoHtml(texto) {
    return /<\/?[a-z][\s\S]*>/i.test(String(texto ?? ''));
}

// Quita etiquetas HTML y decodifica las entidades más comunes que deja el editor, dejando solo
// texto plano legible (para extractos/resúmenes en tarjetas y carruseles -- nunca para pintar
// contenido completo, para eso usa sanitizarContenidoEnriquecido). Los cierres de bloque se
// cambian por un espacio para que dos párrafos pegados no queden como "palabra1palabra2".
function quitarEtiquetasHtml(html) {
    return String(html ?? '')
        .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

// Recorta un texto plano a "longitud" caracteres con "…" al final si hizo falta.
function recortarTexto(texto, longitud) {
    const limpio = String(texto ?? '').trim();
    if (limpio.length <= longitud) return limpio;
    return limpio.substring(0, longitud).trim() + '…';
}

// Sanea el HTML del editor antes de inyectarlo con innerHTML en la página pública, permitiendo
// solo las etiquetas que el editor realmente puede generar (ver el toolbar de Quill en
// admin/publicaciones.html y admin/agenda.html): títulos/subtítulos (h2/h3), negritas, cursiva,
// subrayado, listas y enlaces. Usa DOMPurify (cargado por CDN en las páginas que lo necesitan).
// Si por lo que sea la librería no cargó, no se arriesga a inyectar HTML sin filtrar -- se cae a
// texto plano escapado, igual que se hacía antes de tener el editor.
function sanitizarContenidoEnriquecido(html) {
    if (typeof DOMPurify === 'undefined') {
        return escapeHtml(quitarEtiquetasHtml(html)).replace(/\n/g, '<br>');
    }
    return DOMPurify.sanitize(String(html ?? ''), {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ol', 'ul', 'li', 'a', 'h2', 'h3'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
}

// ================= CONTENIDO ENRIQUECIDO DE PUBLICACIONES =================
// El campo "Contenido" de una Publicación se escribe con un editor de texto con formato
// (negritas, listas, enlaces...) en el panel de admin (ver Quill en admin/publicaciones.html),
// así que puede traer HTML real. Las publicaciones guardadas ANTES de agregar ese editor siguen
// teniendo texto plano con saltos de línea reales (un "\n" por línea). Estas funciones son
// compartidas por todas las páginas públicas que leen ese campo, para que ambos casos se vean
// bien sin duplicar esta lógica en cada archivo.

// true si "texto" trae HTML real (viene del editor con formato); false si es texto plano
// "clásico". No es un parser completo, solo un indicio suficiente para decidir cómo pintarlo.
function esContenidoHtml(texto) {
    return /<\/?[a-z][\s\S]*>/i.test(String(texto ?? ''));
}

// Quita etiquetas HTML y decodifica las entidades más comunes que deja el editor, dejando solo
// texto plano legible (para extractos/resúmenes en tarjetas y carruseles -- nunca para pintar
// contenido completo, para eso usa sanitizarContenidoEnriquecido). Los cierres de bloque se
// cambian por un espacio para que dos párrafos pegados no queden como "palabra1palabra2".
function quitarEtiquetasHtml(html) {
    return String(html ?? '')
        .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

// Recorta un texto plano a "longitud" caracteres con "…" al final si hizo falta.
function recortarTexto(texto, longitud) {
    const limpio = String(texto ?? '').trim();
    if (limpio.length <= longitud) return limpio;
    return limpio.substring(0, longitud).trim() + '…';
}

// Sanea el HTML del editor antes de inyectarlo con innerHTML en la página pública, permitiendo
// solo las etiquetas que el editor realmente puede generar (ver el toolbar de Quill en
// admin/publicaciones.html y admin/agenda.html): títulos/subtítulos (h2/h3), negritas, cursiva,
// subrayado, listas y enlaces. Usa DOMPurify (cargado por CDN en las páginas que lo necesitan).
// Si por lo que sea la librería no cargó, no se arriesga a inyectar HTML sin filtrar -- se cae a
// texto plano escapado, igual que se hacía antes de tener el editor.
function sanitizarContenidoEnriquecido(html) {
    if (typeof DOMPurify === 'undefined') {
        return escapeHtml(quitarEtiquetasHtml(html)).replace(/\n/g, '<br>');
    }
    return DOMPurify.sanitize(String(html ?? ''), {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ol', 'ul', 'li', 'a', 'h2', 'h3'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
}

// ================= AUTENTICACIÓN =================
function decodeJWT(token) {
    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const binario = atob(base64);
    const jsonPayload = decodeURIComponent(
        binario.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
}

function authHeaders() {
    const token = localStorage.getItem('token_sanctorum');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function cerrarSesion() {
    localStorage.removeItem('token_sanctorum');
    window.location.replace('login');
}

// ================= PANEL DE ADMINISTRACIÓN: ROLES Y ACCESOS =================
const ROL_ADMIN = 1, ROL_ESPECIALISTA = 2, ROL_COORDINADOR = 3, ROL_VOLUNTARIO = 4;

function permisosPorPagina(rol, especialidad) {
    return {
        dashboard: [ROL_ADMIN, ROL_COORDINADOR],
        voluntariado: [ROL_ADMIN, ROL_COORDINADOR],
        inventario: [ROL_ADMIN, ROL_COORDINADOR],
        agenda: [ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO],
        publicaciones: [ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO],
        reportes: [ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO],
        aliados_donativos: [ROL_ADMIN, ROL_COORDINADOR],
    };
}

function aplicarRestriccionesNav(rol, especialidad) {
    const permisos = permisosPorPagina(rol, especialidad);
    document.querySelectorAll('aside nav a[data-pagina]').forEach(a => {
        const permitido = permisos[a.dataset.pagina];
        if (permitido && !permitido.includes(Number(rol))) {
            a.remove();
        }
    });
    const actual = obtenerPaginaActual();
    const permitidoActual = permisos[actual];
    if (permitidoActual && !permitidoActual.includes(Number(rol))) {
        window.location.replace('agenda');
    }

    // Cargar automáticamente el avatar en el header compartido
    try {
        const token = localStorage.getItem('token_sanctorum');
        if (token) {
            const payload = decodeJWT(token);
            cargarAvatarHeader(payload.id);
        }
    } catch (e) {}
}

async function verificarAccesoDocumento(payload) {
    if (Number(payload.rol) !== ROL_ESPECIALISTA && Number(payload.rol) !== ROL_COORDINADOR) return;
    try {
        const res = await fetch(`${API_URL}/api/usuarios/${payload.id}`, { headers: authHeaders() });
        const json = await res.json();
        const estatusDoc = (json.success && json.data && json.data.documento_profesional_estatus) || 'Pendiente';
        if (!['Aprobado', 'No Aplica'].includes(estatusDoc) && obtenerPaginaActual() !== 'perfil') {
            window.location.replace('perfil');
        }
    } catch (e) {
        console.error('Error al verificar acceso por documento:', e);
    }
}

// ================= RESALTAR LA PÁGINA ACTIVA EN EL MENÚ =================
function obtenerPaginaActual() {
    let pagina = location.pathname.split('/').pop().replace(/\.html$/i, '');
    return pagina || 'index';
}

function marcarLinkActivoAdmin(selector) {
    const actual = obtenerPaginaActual();
    document.querySelectorAll(selector).forEach(a => {
        const icono = a.querySelector('.material-symbols-outlined');
        if (a.dataset.pagina === actual) {
            a.classList.remove('text-slate-500', 'hover:bg-slate-50');
            a.classList.add('text-primary', 'font-bold', 'bg-[#f8ecdb]');
            if (icono) icono.style.fontVariationSettings = "'FILL' 1";
        } else {
            a.classList.add('text-slate-500', 'hover:bg-slate-50');
            a.classList.remove('text-primary', 'font-bold', 'bg-[#f8ecdb]');
            if (icono) icono.style.fontVariationSettings = '';
        }
    });
}

function marcarLinkActivoPublico(selector) {
    const actual = obtenerPaginaActual();
    document.querySelectorAll(selector).forEach(a => {
        if (a.dataset.pagina === actual) {
            a.classList.add('text-orange-700', 'font-bold', 'border-b-2', 'border-orange-500');
            a.classList.remove('text-slate-600');
        } else {
            a.classList.remove('text-orange-700', 'font-bold', 'border-b-2', 'border-orange-500');
            a.classList.add('text-slate-600');
        }
    });
}

// ================= MENÚ LATERAL Y MÓVIL =================
function toggleSidebarMovil() {
    const sidebar = document.getElementById('sidebar_admin');
    const backdrop = document.getElementById('backdrop_sidebar_movil');
    if (!sidebar || !backdrop) return;
    const estaAbierta = sidebar.classList.contains('translate-x-0');
    if (estaAbierta) {
        cerrarSidebarMovil();
    } else {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        backdrop.classList.remove('hidden');
    }
}

function cerrarSidebarMovil() {
    const sidebar = document.getElementById('sidebar_admin');
    const backdrop = document.getElementById('backdrop_sidebar_movil');
    if (!sidebar || !backdrop) return;
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    backdrop.classList.add('hidden');
}

function inicializarMenuMovil() {
    const btn = document.getElementById('btn_menu_movil');
    const menu = document.getElementById('menu_publico_movil');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
        const estaAbierto = menu.classList.contains('flex');
        menu.classList.toggle('hidden', estaAbierto);
        menu.classList.toggle('flex', !estaAbierto);
        btn.setAttribute('aria-expanded', String(!estaAbierto));
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
        btn.setAttribute('aria-expanded', 'false');
    }));
}

// ================= FORMULARIOS PÚBLICOS DE SOLICITUD =================
async function enviarSolicitudWeb(data, idFormulario, opciones) {
    opciones = opciones || {};
    const form = document.getElementById(idFormulario);
    const btn = form ? form.querySelector('button[type="submit"]') : null;
    const textoOriginal = btn ? btn.innerText : '';
    if (btn) { btn.innerText = 'Enviando...'; btn.disabled = true; }

    try {
        const response = await fetch(`${API_URL}/api/solicitudes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok && result.success) {
            if (form) form.reset();
            if (typeof opciones.onExito === 'function') opciones.onExito(result);
        } else {
            if (typeof opciones.onError === 'function') opciones.onError(result.message || 'No pudimos enviar tu solicitud. Verifica tus datos.');
        }
    } catch (error) {
        console.error('Error de conexión al enviar solicitud web:', error);
        if (typeof opciones.onError === 'function') opciones.onError('Error de conexión con el servidor. Intenta más tarde.');
    } finally {
        if (btn) { btn.innerText = textoOriginal; btn.disabled = false; }
    }
}

function mostrarModalSolicitud(titulo, mensaje, colorFondo, icono) {
    const elTitulo = document.getElementById('modalTitulo');
    const elMensaje = document.getElementById('modalMensaje');
    const elIcono = document.getElementById('modalIcono');
    const elModal = document.getElementById('modalSolicitud');
    if (!elTitulo || !elMensaje || !elIcono || !elModal) return;
    elTitulo.innerText = titulo;
    elMensaje.innerText = mensaje;
    elIcono.style.backgroundColor = colorFondo;
    elIcono.innerText = icono;
    elModal.classList.remove('hidden');
}

function cerrarModalSolicitud() {
    const elModal = document.getElementById('modalSolicitud');
    if (elModal) elModal.classList.add('hidden');
}

// ================= TRASPASO DE SOLICITUDES =================
const SOLICITUD_HANDOFF_KEY = 'sanctorum_handoff_solicitud';

function leerYLimpiarHandoffSolicitud() {
    try {
        const crudo = sessionStorage.getItem(SOLICITUD_HANDOFF_KEY);
        if (!crudo) return null;
        sessionStorage.removeItem(SOLICITUD_HANDOFF_KEY);
        return JSON.parse(crudo);
    } catch (e) {
        console.error('No se pudo leer el traspaso de solicitud:', e);
        sessionStorage.removeItem(SOLICITUD_HANDOFF_KEY);
        return null;
    }
}

// ================= TRASPASO: VISITA DE PROSPECCIÓN -> COMPLETAR ESCUELA =================
// Cuando se marca una Visita de Prospección como realizada (ver completarVisita() en
// agenda.html), se manda a quien captura a Aliados y Donativos > Escuelas con el modal de
// esa escuela ya abierto en modo edición (ver manejarHandoffVisitaEscuela() en
// aliados_donativos.html), para que complemente/confirme sus datos ahí mismo, en vez de que
// el registro se quede incompleto sin que nadie lo note.
const ESCUELA_HANDOFF_KEY = 'sanctorum_handoff_escuela';

function guardarHandoffEscuela(datos) {
    try {
        sessionStorage.setItem(ESCUELA_HANDOFF_KEY, JSON.stringify(datos));
    } catch (e) {
        console.error('No se pudo guardar el traspaso de escuela:', e);
    }
}

function leerYLimpiarHandoffEscuela() {
    try {
        const crudo = sessionStorage.getItem(ESCUELA_HANDOFF_KEY);
        if (!crudo) return null;
        sessionStorage.removeItem(ESCUELA_HANDOFF_KEY);
        return JSON.parse(crudo);
    } catch (e) {
        console.error('No se pudo leer el traspaso de escuela:', e);
        sessionStorage.removeItem(ESCUELA_HANDOFF_KEY);
        return null;
    }
}

async function marcarSolicitudAtendidaSilenciosa(idSolicitud) {
    if (!idSolicitud) return;
    try {
        await fetch(`${API_URL}/api/solicitudes/${idSolicitud}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ estatus: 'Atendida' })
        });
    } catch (e) {
        console.error('No se pudo marcar automáticamente la solicitud como atendida:', e);
    }
}

// ================= CARGA DINÁMICA DEL AVATAR EN EL HEADER =================
async function cargarAvatarHeader(userId) {
    if (!userId) return;

    // 1. Usar caché en sesión para evitar peticiones redundantes
    const cacheKey = `sanctorum_avatar_${userId}`;
    const fotoCache = sessionStorage.getItem(cacheKey);
    const wrap = document.getElementById('nav_user_avatar_wrap');

    if (fotoCache && wrap) {
        wrap.innerHTML = `<img src="${fotoCache}" class="w-full h-full object-cover" alt="Foto de perfil">`;
        return;
    }

    // 2. Si no está en caché, consultarla a la API
    try {
        const res = await fetch(`${API_URL}/api/usuarios/${userId}`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success && json.data && json.data.foto_perfil_url) {
            sessionStorage.setItem(cacheKey, json.data.foto_perfil_url);
            const avatarWrap = document.getElementById('nav_user_avatar_wrap');
            if (avatarWrap) {
                avatarWrap.innerHTML = `<img src="${json.data.foto_perfil_url}" class="w-full h-full object-cover" alt="Foto de perfil">`;
            }
        }
    } catch (e) {
        console.error('No se pudo cargar la foto del header:', e);
    }
}