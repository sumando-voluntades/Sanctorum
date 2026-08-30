/*
 * comun.js — funciones y constantes compartidas por TODO el frontend de Sanctorum.
 *
 * Antes de este archivo, cada página HTML tenía su propia copia pegada de estas mismas
 * funciones (API_URL, decodeJWT, authHeaders, cerrarSesion, aplicarRestriccionesNav,
 * verificarAccesoDocumento). Con el tiempo las copias se fueron desalineando entre sí
 * (algunas tenían errores que otras ya habían corregido). Ahora solo existe una versión
 * de cada función, así que corregir un bug aquí lo corrige en todas las páginas a la vez.
 *
 * IMPORTANTE para el despliegue: API_URL es la ÚNICA línea que hay que cambiar en TODO
 * el sitio al pasar de desarrollo local a producción (ver Manual_de_Despliegue_Tecnico.docx,
 * sección "Actualizar API_URL"). Antes había que cambiarla en 17 archivos distintos.
 */

// En desarrollo local el backend corre en localhost:3000. Al desplegar a producción,
// cambia esta línea a la URL real del backend en Render (ej. "https://sanctorum-backend.onrender.com").
const API_URL = "http://localhost:3000";

// ================= AUTENTICACIÓN =================

// Decodifica el payload de un JWT (sin verificar la firma — eso ya lo hizo el backend;
// aquí solo se lee para mostrar datos en pantalla, como el nombre o el rol del usuario).
function decodeJWT(token) {
    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const binario = atob(base64);
    const jsonPayload = decodeURIComponent(
        binario.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
}

// Header estándar para peticiones autenticadas. Todas las llamadas a rutas protegidas
// del backend deben incluir este header — antes, algunas copias de cargarNotificaciones()
// y verificarAccesoDocumento() lo olvidaban, causando que esas peticiones fallaran en
// silencio en el backend si la ruta llegaba a exigir sesión.
function authHeaders() {
    const token = localStorage.getItem('token_sanctorum');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Cierra sesión y regresa al login. Se usa replace() (no href) para que el botón "Atrás"
// del navegador no regrese a una página que ya requiere sesión iniciada.
function cerrarSesion() {
    localStorage.removeItem('token_sanctorum');
    window.location.replace('login');
}

// ================= PANEL DE ADMINISTRACIÓN: ROLES Y ACCESOS =================

// Roles (deben coincidir con los de server.js): 1=Admin, 2=Especialista, 3=Coordinador,
// 4=Voluntario, 5=Donador.
const ROL_ADMIN = 1, ROL_ESPECIALISTA = 2, ROL_COORDINADOR = 3, ROL_VOLUNTARIO = 4;

// Qué roles pueden ver cada página del panel — se usa tanto para ocultar los enlaces del
// menú lateral que el usuario actual no puede usar, como para redirigirlo si intenta
// entrar directamente a una URL que su rol no tiene permitida. "esPsico" (Especialista
// cuyo campo "especialidad" contiene "psic") es lo único que puede ampliar el acceso a
// Expedientes más allá de Admin — coincide con la lógica de esPsicologo() en server.js.
function permisosPorPagina(rol, especialidad) {
    const esPsico = Number(rol) === ROL_ESPECIALISTA && typeof especialidad === 'string' && especialidad.toLowerCase().includes('psic');
    return {
        dashboard: [ROL_ADMIN, ROL_COORDINADOR],
        expedientes: esPsico ? [ROL_ADMIN, ROL_ESPECIALISTA] : [ROL_ADMIN],
        voluntariado: [ROL_ADMIN, ROL_COORDINADOR],
        inventario: [ROL_ADMIN, ROL_COORDINADOR],
        agenda: [ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO],
        publicaciones: [ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO],
        reportes: [ROL_ADMIN, ROL_ESPECIALISTA, ROL_COORDINADOR, ROL_VOLUNTARIO],
        aliados_donativos: [ROL_ADMIN, ROL_COORDINADOR],
    };
}

// Oculta del menú lateral las páginas que el rol actual no puede usar, y si la página en
// la que el usuario está parado ahora mismo no es una de las permitidas, lo saca de ahí
// (evita que alguien entre a una URL de administración solo por conocerla). Se manda a
// "agenda" porque es la única página del panel a la que los 4 roles tienen acceso.
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
}

// Antes de dejar operar a un Especialista o Coordinador, se confirma que su documento
// profesional ya esté aprobado (o marcado "No Aplica"); si sigue pendiente/rechazado, se
// le manda a su perfil a resolverlo. Admin y Voluntario nunca se bloquean con esto — la
// versión que tenía voluntariado.html hacía este mismo fetch sin authHeaders() (por lo
// que fallaba en silencio si la ruta llegaba a exigir sesión); esta versión, tomada de
// aliados_donativos.html, es la correcta y ahora es la única que existe.
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

// Convierte la URL actual en el nombre "corto" de página que usan los data-pagina de los
// parciales (ej. "/dashboard" o "/dashboard.html" → "dashboard"; "/" → "index").
function obtenerPaginaActual() {
    let pagina = location.pathname.split('/').pop().replace(/\.html$/i, '');
    return pagina || 'index';
}

// Menú lateral del panel de administración: resalta con fondo e ícono relleno.
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

// Menú superior del sitio público: resalta con color y subrayado.
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

// ================= MENÚ LATERAL DEL PANEL EN TELÉFONO =================

// La barra lateral del panel de administración (partials/navbar_admin.html) empieza oculta
// fuera de la pantalla en teléfono (-translate-x-full) y solo se muestra al tocar el botón
// de menú del header (partials/header_admin.html). Estas dos funciones la abren/cierran.
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

// ================= MENÚ MÓVIL DEL SITIO PÚBLICO =================

// Antes no existía ningún botón para desplegar el menú en pantallas de celular (el <nav>
// del sitio público es "hidden md:flex", así que en móvil el menú no aparecía en ningún
// lado). Este botón (agregado en partials/navbar_publico.html) lo muestra/oculta.
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
    // Si el usuario toca un enlace del menú móvil, ciérralo (evita que se quede abierto
    // tapando la página siguiente mientras esta navega).
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
        btn.setAttribute('aria-expanded', 'false');
    }));
}
