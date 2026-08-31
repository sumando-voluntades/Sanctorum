/*
 * notificaciones.js — campana de notificaciones del panel de administración.
 *
 * Esta pieza estaba duplicada en las 9 páginas del panel, casi idéntica, pero con una
 * diferencia real que se corrige aquí de una vez por todas: 6 de las 9 copias hacían el
 * fetch a /api/dashboard/resumen SIN el header de autorización (authHeaders()), solo
 * dashboard.html lo incluía correctamente. Esta es la única versión que existe ahora, y
 * ya incluye el header en todas las páginas que la usen.
 *
 * No existe una tabla de notificaciones en la base de datos: se arman "al vuelo" a partir
 * de /api/dashboard/resumen, y qué notificaciones fueron descartadas se guarda en
 * localStorage — así "eliminar" persiste en el navegador de quien la descartó, sin tocar
 * el backend ni afectar a otros usuarios.
 *
 * Depende de comun.js (API_URL, authHeaders) — inclúyelo primero en la página.
 */

const CLAVE_NOTIF_DESCARTADAS = 'notificaciones_descartadas_sanctorum';

function obtenerNotifDescartadas() {
    try { return JSON.parse(localStorage.getItem(CLAVE_NOTIF_DESCARTADAS) || '[]'); } catch (e) { return []; }
}
function guardarNotifDescartadas(lista) {
    localStorage.setItem(CLAVE_NOTIF_DESCARTADAS, JSON.stringify(lista));
}

function toggleNotificaciones() {
    const panel = document.getElementById('modalNotificaciones');
    const estabaOculto = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (estabaOculto) cargarNotificaciones();
}

async function cargarNotificaciones() {
    const cont = document.getElementById('lista_notificaciones');
    try {
        const res = await fetch(`${API_URL}/api/dashboard/resumen`, { headers: authHeaders() });
        const json = await res.json();
        if (!json.success) { cont.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">No se pudieron cargar.</p>'; return; }

        const descartadas = obtenerNotifDescartadas();
        let notificaciones = (json.data.actividad_reciente || []).map((a, i) => ({
            id: 'act_' + i + '_' + new Date(a.fecha).getTime(),
            icono: 'notifications', color: 'bg-pink-100 text-[#b50062]',
            titulo: a.titulo, detalle: a.detalle || ''
        }));

        if (json.data.solicitudes_pendientes > 0) {
            notificaciones.unshift({ id: 'solicitudes_pendientes', icono: 'mail', color: 'bg-purple-100 text-purple-600',
                titulo: 'Solicitudes pendientes', detalle: `${json.data.solicitudes_pendientes} solicitud(es) esperan revisión.` });
        }
        if (json.data.insumos_bajo_stock > 0) {
            notificaciones.unshift({ id: 'bajo_stock', icono: 'inventory_2', color: 'bg-amber-100 text-amber-700',
                titulo: 'Insumos en bajo stock', detalle: `${json.data.insumos_bajo_stock} insumo(s) necesitan reabastecerse.` });
        }

        notificaciones = notificaciones.filter(n => !descartadas.includes(n.id));
        actualizarPuntoNotificaciones(notificaciones.length);

        if (notificaciones.length === 0) {
            cont.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">No tienes notificaciones nuevas.</p>';
            return;
        }

        cont.innerHTML = notificaciones.map(n => `
            <div class="p-4 hover:bg-slate-50 transition-colors flex gap-3 group">
                <div class="w-8 h-8 rounded-full ${n.color} flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-sm">${n.icono}</span></div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800">${n.titulo}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${n.detalle}</p>
                </div>
                <button onclick="descartarNotificacion('${n.id}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all shrink-0" title="Eliminar">
                    <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>`).join('');
    } catch (e) {
        console.error("Error al cargar notificaciones:", e);
        cont.innerHTML = '<p class="text-slate-400 text-sm text-center py-6">No se pudieron cargar.</p>';
    }
}

function actualizarPuntoNotificaciones(cantidad) {
    const punto = document.getElementById('punto_notificaciones');
    if (!punto) return;
    punto.classList.toggle('hidden', cantidad === 0);
}

function descartarNotificacion(id) {
    const descartadas = obtenerNotifDescartadas();
    if (!descartadas.includes(id)) descartadas.push(id);
    guardarNotifDescartadas(descartadas);
    cargarNotificaciones();
}

function limpiarTodasNotificaciones() {
    document.querySelectorAll('#lista_notificaciones button[onclick^="descartarNotificacion"]').forEach(btn => {
        const match = btn.getAttribute('onclick').match(/descartarNotificacion\('([^']+)'\)/);
        if (match) {
            const descartadas = obtenerNotifDescartadas();
            if (!descartadas.includes(match[1])) descartadas.push(match[1]);
            guardarNotifDescartadas(descartadas);
        }
    });
    cargarNotificaciones();
}
