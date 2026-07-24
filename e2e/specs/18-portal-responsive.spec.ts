/**
 * Flujo 18 — Portal cliente responsive.
 *
 * Valida rutas `/portal/*` en tableta (768×1024) y desktop xl+ (1440×900):
 *   - Dashboard (`/portal`), listado embarques, detalle embarque, facturas.
 *   - `<main>` sin overflow horizontal.
 *   - 0 `console.error`.
 *   - Navegación lista → detalle → back sin errores.
 *
 * Requiere `E2E_PORTAL_EMAIL` / `E2E_PORTAL_PASSWORD`. Si faltan, el spec se salta.
 */
import { expect, test, type Page } from "../fixtures/testBase";
import { loginAs, portalCreds } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop-xl", width: 1440, height: 900 },
] as const;

const TIENE_PORTAL = Boolean(process.env.E2E_PORTAL_EMAIL && process.env.E2E_PORTAL_PASSWORD);

async function assertNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return {
      main: main.scrollWidth - main.clientWidth,
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(overflow.main, `overflow <main> en ${label}`).toBeLessThanOrEqual(1);
  expect(overflow.doc, `overflow document en ${label}`).toBeLessThanOrEqual(1);
}

for (const vp of VIEWPORTS) {
  test.describe(`Flujo 18 — Portal cliente (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      test.skip(!TIENE_PORTAL, "Requiere credenciales E2E_PORTAL_*");
      await loginAs(page, portalCreds());
    });

    test(`Dashboard + listados sin overflow (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      // 1) Dashboard portal
      await page.goto("/portal");
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await assertNoOverflow(page, `portal dashboard ${vp.name}`);

      // Aserción de negocio (v13.312.15): el dashboard del portal debe
      // renderizar al menos un heading real del cliente (no solo layout).
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible({ timeout: 10_000 });

      // 2) Embarques (lista)
      await page.goto("/portal/embarques");
      await expect(
        page.getByRole("heading", { name: /mis embarques/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await assertNoOverflow(page, `portal embarques ${vp.name}`);

      // 3) Facturas (lista)
      await page.goto("/portal/facturas");
      await expect(
        page.getByRole("heading", { name: /mis facturas/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await assertNoOverflow(page, `portal facturas ${vp.name}`);

      // 4) Cotizaciones (lista)
      await page.goto("/portal/cotizaciones");
      await expect(
        page.getByRole("heading", { name: /mis cotizaciones/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await assertNoOverflow(page, `portal cotizaciones ${vp.name}`);

      expect(errores, `consola portal ${vp.name}`).toEqual([]);
    });

    test(`Detalle de embarque sin overflow (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await page.goto("/portal/embarques");
      await expect(
        page.getByRole("heading", { name: /mis embarques/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle");

      const filas = page.locator("table tbody tr");
      const hayFilas = (await filas.count()) > 0;
      test.skip(!hayFilas, "Sin embarques visibles en el portal para este usuario");

      await filas.first().click();
      await page.waitForURL(/\/portal\/embarques\/[^/]+/i, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await assertNoOverflow(page, `portal detalle embarque ${vp.name}`);

      expect(errores, `consola detalle portal ${vp.name}`).toEqual([]);
    });
  });
}
