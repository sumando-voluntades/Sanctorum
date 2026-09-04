/*
 * incluir.js — Inyector de componentes parciales (Sidebar, Header, Footer)
 * Optimizado con caché en sesión y navegación nativa estable.
 */

async function incluirParcial(selector, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error al cargar parcial: ${url}`);
    const html = await res.text();
    const contenedor = document.querySelector(selector);
    
    if (contenedor) {
      contenedor.innerHTML = html;

      // Si es el footer, fuerza el fondo oscuro y el ancho completo automáticamente
      if (selector === '#footer-mount' || url.includes('footer')) {
        contenedor.style.setProperty('background-color', '#0b1120', 'important');
        contenedor.style.setProperty('width', '100%', 'important');
        contenedor.style.setProperty('display', 'block', 'important');
        contenedor.style.setProperty('margin-top', '4rem', 'important');
      }
    }
  } catch (error) {
    console.error(error);
  }
}