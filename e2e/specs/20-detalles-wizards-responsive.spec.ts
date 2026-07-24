/**
 * Flujo 20 — Detalles y wizards multi-paso responsive.
 *
 * Extiende specs 15 y 17 cubriendo detalles y rutas wizard en tableta
 * (768×1024) y desktop xl+ (1440×900):
 *   - `/cotizaciones/:id` (detalle)
 *   - `/clientes/:id` (detalle con tabs)
 *   - `/proveedores/:id` (detalle)
 *   - `/cotizaciones/nueva` — se avanza por los pasos disponibles sin enviar,
 *     verificando que cada paso no genera overflow ni errores.
 *
 * Nada se envía a la base de datos: el spec cancela/regresa antes de terminar.
 */
import { expect, test, type Page } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop-xl", width: 1440, height: 900 },
] as const;

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

async function abrirPrimeraFila(page: Page, ruta: string, heading: RegExp, label: string) {
  await page.goto(ruta);
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  const filas = page.locator("table tbody tr");
  const cuenta = await filas.count();
  test.skip(cuenta === 0, `Sin datos en ${ruta} para probar detalle (${label})`);
  await filas.first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

for (const vp of VIEWPORTS) {
  test.describe(`Flujo 20 — Detalles y wizards (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await loginAs(page, internalCreds());
    });

    test(`Detalle de cotización (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await abrirPrimeraFila(page, "/cotizaciones", /cotizaciones/i, "cotización");
      await expect(page).toHaveURL(/\/cotizaciones\/[^/]+/i);
      await assertNoOverflow(page, `detalle cotización ${vp.name}`);

      expect(errores, `consola detalle cotización ${vp.name}`).toEqual([]);
    });

    test(`Detalle de cliente + tabs (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await abrirPrimeraFila(page, "/clientes", /clientes/i, "cliente");
      await expect(page).toHaveURL(/\/clientes\/[^/]+/i);
      await assertNoOverflow(page, `detalle cliente ${vp.name}`);

      // Recorrer tabs si existen (contactos, embarques, documentos, etc.)
      const tabs = page.getByRole("tab");
      const totalTabs = await tabs.count();
      for (let i = 0; i < Math.min(totalTabs, 5); i++) {
        await tabs.nth(i).click().catch(() => {});
        await page.waitForLoadState("networkidle").catch(() => {});
        await assertNoOverflow(page, `cliente tab#${i} ${vp.name}`);
      }

      expect(errores, `consola detalle cliente ${vp.name}`).toEqual([]);
    });

    test(`Detalle de proveedor (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await abrirPrimeraFila(page, "/proveedores", /proveedores/i, "proveedor");
      await expect(page).toHaveURL(/\/proveedores\/[^/]+/i);
      await assertNoOverflow(page, `detalle proveedor ${vp.name}`);

      expect(errores, `consola detalle proveedor ${vp.name}`).toEqual([]);
    });

    test(`Wizard Nueva Cotización — avanza pasos disponibles sin enviar (${vp.name})`, async ({
      page,
    }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      await page.goto("/cotizaciones/nueva");
      await expect(
        page.getByRole("heading", { name: /nueva cotizaci[oó]n/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await assertNoOverflow(page, `wizard paso 1 ${vp.name}`);

      // Intento genérico: pulsar "Siguiente" hasta 3 veces mientras exista y
      // esté habilitado. Si validaciones lo bloquean, el botón queda disabled
      // y salimos. Nada se envía al backend.
      for (let paso = 2; paso <= 4; paso++) {
        const siguiente = page
          .getByRole("button", { name: /siguiente|continuar/i })
          .first();
        const visible = await siguiente.isVisible().catch(() => false);
        if (!visible) break;
        const habilitado = await siguiente.isEnabled().catch(() => false);
        if (!habilitado) break;
        await siguiente.click();
        await page.waitForLoadState("networkidle").catch(() => {});
        await assertNoOverflow(page, `wizard paso ${paso} ${vp.name}`);
      }

      // Salida sin envío: preferimos "Cancelar" si existe, si no volvemos atrás.
      const cancelar = page
        .getByRole("button", { name: /cancelar|salir|volver|regresar/i })
        .first();
      if (await cancelar.isVisible().catch(() => false)) {
        await cancelar.click().catch(() => {});
      } else {
        await page.goBack();
      }

      // Filtra errores de red esperados si el wizard cancelado dispara aborts.
      const relevantes = errores.filter((e) => !/aborted|AbortError/i.test(e));
      expect(relevantes, `consola wizard ${vp.name}`).toEqual([]);
    });
  });
}
