/**
 * Flujo 15 — Embarques responsive.
 *
 * Verifica que el módulo `/embarques` sea usable tanto en tableta (768×1024)
 * como en escritorio xl+ (1440×900):
 *   1. Lista renderiza sin overflow horizontal ni errores de consola.
 *   2. Se abre el primer embarque y su detalle carga (heading EL…).
 *   3. Se regresa a la lista y sigue sin overflow ni errores.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop-xl", width: 1440, height: 900 },
] as const;

async function assertNoOverflow(page: import("@playwright/test").Page, label: string) {
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
  test.describe(`Flujo 15 — Embarques (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`navegar lista → detalle → lista sin overflow (${vp.name})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
      });

      await loginAs(page, internalCreds());

      // 1) Lista de embarques.
      await page.goto("/embarques");
      await expect(
        page.getByRole("heading", { name: /embarques/i }).first(),
      ).toBeVisible({ timeout: 15_000 });

      const table = page.locator("table").first();
      await expect(table).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await assertNoOverflow(page, `lista ${vp.name}`);

      // 2) Abrir el primer embarque.
      await page.locator("table tbody tr").first().click();
      await expect(
        page.getByRole("heading", { name: /EL(IMP|EXP|GEN)\d+/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await assertNoOverflow(page, `detalle ${vp.name}`);

      // 3) Regresar a la lista.
      await page.goto("/embarques");
      await expect(
        page.getByRole("heading", { name: /embarques/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await assertNoOverflow(page, `lista-post ${vp.name}`);

      expect(consoleErrors, `consola en ${vp.name}`).toEqual([]);
    });
  });
}
