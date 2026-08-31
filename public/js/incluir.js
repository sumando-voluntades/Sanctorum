/*
 * incluir.js — Inyector de componentes parciales (Sidebar, Header, Footer)
 * Optimizado con caché en sesión y navegación nativa estable.
 */

async function incluirParcial(selector, ruta) {
    const contenedor = document.querySelector(selector);
    if (!contenedor) return;

    const cacheKey = 'parcial_' + ruta;
    const cachedHtml = sessionStorage.getItem(cacheKey);
    
    // Si ya se descargó en esta sesión, se inyecta de inmediato (0 ms)
    if (cachedHtml) {
        contenedor.innerHTML = cachedHtml;
        return;
    }

    try {
        const res = await fetch(ruta);
        if (!res.ok) throw new Error(`Error ${res.status} al cargar ${ruta}`);
        const html = await res.text();
        sessionStorage.setItem(cacheKey, html);
        contenedor.innerHTML = html;
    } catch (err) {
        console.error(`No se pudo inyectar el parcial ${ruta}:`, err);
    }
}