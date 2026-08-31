import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'Admin@Admin.com';
const ADMIN_PASS = '123456';

// Inicia sesión administrativa de forma confiable antes de los tests protegidos
async function iniciarSesionAdmin(page) {
  await page.goto('/login');
  await page.fill('#login_correo', ADMIN_EMAIL);
  await page.fill('#login_password', ADMIN_PASS);
  await page.click('#formLogin button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('1. Vistas Públicas y Solicitudes Web', () => {

  test('Carga el home y componentes inyectados', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sumando Voluntades/i);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('#header-mount header')).toBeVisible();
    await expect(page.locator('#footer-mount footer')).toBeVisible();
  });

  test('Envío de solicitud web: Asistencia Psicológica', async ({ page }) => {
    await page.goto('/solicitud_apoyo_oficial');
    await page.fill('#psi_nombre', 'Paciente Prueba Playwright');
    await page.fill('#psi_correo', 'paciente_test@sanctorum.org');
    await page.fill('#psi_telefono', '2221234567');
    await page.fill('#psi_mensaje', 'Solicito valoración inicial para apoyo psicológico.');
    await page.click('#formPsicologica button[type="submit"]');

    const modal = page.locator('#modalSolicitud');
    await expect(modal).toBeVisible({ timeout: 10000 });
  });

});

test.describe('2. Autenticación y Control de Sesión', () => {

  test('Validación de campos requeridos en el login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#formLogin')).toBeVisible();
    await page.click('#formLogin button[type="submit"]');
    await expect(page.locator('#login_correo')).toHaveAttribute('required', '');
  });

  test('Inicio de sesión exitoso y almacenamiento de JWT', async ({ page }) => {
    await iniciarSesionAdmin(page);
    const token = await page.evaluate(() => localStorage.getItem('token_sanctorum'));
    expect(token).toBeTruthy();
  });

  test('Cierre de sesión limpia el token de localStorage', async ({ page }) => {
    await iniciarSesionAdmin(page);
    await page.evaluate(() => {
      if (typeof cerrarSesion === 'function') cerrarSesion();
    });
    await page.waitForURL('**/login', { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('token_sanctorum'));
    expect(token).toBeNull();
  });

});

test.describe('3. Módulos Operativos y Clínicos', () => {

  test('Módulo Expedientes: Carga de lista y modal de nuevo registro', async ({ page }) => {
    await iniciarSesionAdmin(page);
    await page.goto('/expedientes');
    await expect(page).toHaveURL(/expedientes/);
    await expect(page.locator('main')).toBeVisible();

    const btnNuevo = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")').first();
    if (await btnNuevo.isVisible()) {
      await btnNuevo.click();
      // Selector específico para modales de creación en la vista
      const modal = page.locator('#modalNuevoBeneficiario, #modalBeneficiario, #modalExpediente, div[id*="modal"]:not(#modalNotificaciones)').first();
      await expect(modal).toBeVisible();
    }
  });

  test('Módulo Inventario: Apertura de formulario para insumos', async ({ page }) => {
    await iniciarSesionAdmin(page);
    await page.goto('/inventario');
    await expect(page).toHaveURL(/inventario/);

    const btnInsumo = page.locator('button:has-text("Nuevo"), button:has-text("Registrar"), button:has-text("Agregar")').first();
    if (await btnInsumo.isVisible()) {
      await btnInsumo.click();
      const modal = page.locator('#modalNuevoInsumo, #modalInsumo, #modalArticulo, div[id*="modal"]:not(#modalNotificaciones)').first();
      await expect(modal).toBeVisible();
    }
  });

  test('Módulo Agenda: Verificación de calendario y modal de visitas', async ({ page }) => {
    await iniciarSesionAdmin(page);
    await page.goto('/agenda');
    await expect(page).toHaveURL(/agenda/);

    const btnAgendar = page.locator('button:has-text("Agendar"), button:has-text("Nueva Actividad"), button:has-text("Nuevo Evento")').first();
    if (await btnAgendar.isVisible()) {
      await btnAgendar.click();
      const modal = page.locator('#modalAgendar, #modalNuevaVisita, #modalEvento, div[id*="modal"]:not(#modalNotificaciones)').first();
      await expect(modal).toBeVisible();
    }
  });

});