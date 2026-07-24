/**
 * Flujo 17 — Modales de captura y wizard responsive.
 *
 * Verifica que los modales `FormDialogShell` (Nuevo Cliente, Nuevo Proveedor,
 * Capturar factura de proveedor) y la ruta wizard `/cotizaciones/nueva`
 * funcionen correctamente en tableta (768×1024) y desktop xl+ (1440×900):
 *   - Se abren desde el botón/FAB trigger.
 *   - Sin overflow horizontal en `<main>` ni en el propio dialog.
 *   - Cierre con Escape (dialogs) o navegación (wizard-page) restaura foco.
 *   - Cero `console.error`.
 * No se envía ningún formulario.
 */
import { expect, test, type Page } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop-xl", width: 1440, height: 900 },
] as const;

async function assertNoMainOverflow(page: Page, label: string) {
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

async function assertDialogFits(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]') as HTMLElement | null;
    if (!d) return null;
    return {
      overflowX: d.scrollWidth - d.clientWidth,
      heightRatio: d.getBoundingClientRect().height / window.innerHeight,
    };
  });
  expect(metrics, `dialog presente en ${label}`).not.toBeNull();
  expect(metrics!.overflowX, `overflow horizontal dialog en ${label}`).toBeLessThanOrEqual(1);
  // FormDialogShell fija max-h-[85vh]; damos un margen para el border.
  expect(metrics!.heightRatio, `alto dialog vs viewport en ${label}`).toBeLessThanOrEqual(0.92);
}

/** Prueba un modal FormDialogShell: abrir → medir → cerrar con Escape → foco vuelve al trigger. */
async function ejercitarModal(
  page: Page,
  opts: {
    ruta: string;
    listaLista: () => Promise<void>;
    triggerName: RegExp;
    tituloDialog: RegExp;
    label: string;
  },
) {
  await page.goto(opts.ruta);
  await opts.listaLista();

  const trigger = page.getByRole("button", { name: opts.triggerName }).first();
  await expect(trigger, `trigger ${opts.label}`).toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const dialog = page.getByRole("dialog").filter({ hasText: opts.tituloDialog }).first();
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  await page.waitForLoadState("networkidle").catch(() => {}); // shell asentado
  await assertDialogFits(page, opts.label);
  await assertNoMainOverflow(page, `${opts.label} con dialog abierto`);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 5_000 });

  // Radix Dialog restaura foco al trigger que abrió el modal.
  const focoTexto = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return (el?.getAttribute("aria-label") ?? el?.textContent ?? "").toLowerCase();
  });
  expect(focoTexto, `foco tras Escape en ${opts.label}`).toMatch(opts.triggerName);
}

for (const vp of VIEWPORTS) {
  test.describe(`Flujo 17 — Modales captura (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await loginAs(page, internalCreds());
    });

    test(`Nuevo Cliente (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await ejercitarModal(page, {
        ruta: "/clientes",
        listaLista: async () => {
          await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });
        },
        triggerName: /nuevo cliente/i,
        tituloDialog: /nuevo cliente/i,
        label: `Nuevo Cliente ${vp.name}`,
      });

      expect(errores, `consola ${vp.name}`).toEqual([]);
    });

    test(`Nuevo Proveedor (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await ejercitarModal(page, {
        ruta: "/proveedores",
        listaLista: async () => {
          await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });
        },
        triggerName: /nuevo proveedor/i,
        tituloDialog: /nuevo proveedor/i,
        label: `Nuevo Proveedor ${vp.name}`,
      });

      expect(errores, `consola ${vp.name}`).toEqual([]);
    });

    test(`Capturar Factura CxP (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await ejercitarModal(page, {
        ruta: "/cxp",
        listaLista: async () => {
          // /cxp puede aterrizar sin filas si no hay facturas; basta con el heading.
          await expect(
            page.getByRole("heading", { name: /cuentas por pagar/i }).first(),
          ).toBeVisible({ timeout: 15_000 });
          await page.waitForLoadState("networkidle").catch(() => {});
        },
        triggerName: /capturar factura/i,
        tituloDialog: /capturar factura de proveedor/i,
        label: `CxP Capturar ${vp.name}`,
      });

      expect(errores, `consola ${vp.name}`).toEqual([]);
    });

    test(`Wizard Nueva Cotización — ruta (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      // El FAB "Nueva cotización" navega a /cotizaciones/nueva (no es un modal).
      await page.goto("/cotizaciones");
      await expect(
        page.getByRole("heading", { name: /cotizaciones/i }).first(),
      ).toBeVisible({ timeout: 15_000 });

      const fab = page.getByRole("button", { name: /nueva cotizaci[oó]n/i }).first();
      await expect(fab).toBeVisible({ timeout: 15_000 });
      await fab.click();

      await page.waitForURL(/\/cotizaciones\/nueva/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: /nueva cotizaci[oó]n/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});

      await assertNoMainOverflow(page, `wizard-cotizacion ${vp.name}`);

      // Botón de cancelar/regresar debe estar accesible sin scroll.
      const salir = page
        .getByRole("button", { name: /cancelar|volver|regresar|salir/i })
        .first();
      await expect(salir).toBeVisible({ timeout: 5_000 });

      expect(errores, `consola ${vp.name}`).toEqual([]);
    });
  });
}
