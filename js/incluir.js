/*
 * incluir.js — carga un fragmento de HTML compartido (navbar, header, footer) dentro de
 * un elemento "mount" de la página. Es lo que permite que partials/navbar_admin.html,
 * partials/header_admin.html, partials/footer_admin.html, partials/navbar_publico.html y
 * partials/footer_publico.html vivan en un solo archivo cada uno, en vez de estar
 * copiados y pegados en las 16 páginas que los usan.
 *
 * IMPORTANTE — por qué hay que esperar (await) el resultado antes de seguir:
 * el fetch() tarda un instante en llegar. Si el código que aplica el rol del usuario
 * (aplicarRestriccionesNav) o resalta la página activa (marcarLinkActivoAdmin/Publico) se
 * ejecuta ANTES de que el navbar ya esté insertado en la página, no encuentra ningún
 * <a> todavía y simplemente no hace nada, sin ningún error visible — el bug sería
 * invisible y confuso. Por eso cada página debe hacer:
 *
 *     await incluirParcial('#sidebar-mount', 'partials/navbar_admin.html');
 *     // (recién aquí es seguro tocar los <a> de dentro de #sidebar-mount)
 *
 * en vez de lanzar el fetch y seguir de inmediato.
 */
async function incluirParcial(selector, url) {
    const host = document.querySelector(selector);
    if (!host) { console.error(`incluirParcial: no existe ningún elemento para "${selector}"`); return null; }
    try {
        const respuesta = await fetch(url);
        host.innerHTML = await respuesta.text();
        document.dispatchEvent(new CustomEvent('parcial:cargado', { detail: { selector, url } }));
        return host;
    } catch (e) {
        console.error(`incluirParcial: no se pudo cargar ${url}`, e);
        return null;
    }
}
