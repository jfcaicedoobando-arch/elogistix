/**
 * Flujo 16 — Modal de confirmación crítico (eliminar embarque) responsive.
 *
 * Objetivo: garantizar que el `AlertDialog` de acciones destructivas
 * (paso 1 de eliminación de embarque) funcione correctamente en tableta
 * (768×1024) y escritorio xl+ (1440×900), y que al cerrarse (Cancel o Esc)
 * el foco regrese al botón que lo abrió.
 *
 * NO se ejecuta el borrado real: sólo se abre → cancela / Esc → verifica
 * cierre + foco + ausencia de overflow / errores de consola.
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
  test.describe(`Flujo 16 — AlertDialog crítico (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`eliminar embarque → cancelar y Esc devuelven foco (${vp.name})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
      });

      await loginAs(page, internalCreds());

      // Ir a lista y abrir el primer embarque.
      await page.goto("/embarques");
      await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });
      await page.locator("table tbody tr").first().click();
      await expect(
        page.getByRole("heading", { name: /EL(IMP|EXP|GEN)\d+/i }).first(),
      ).toBeVisible({ timeout: 15_000 });

      const btnEliminar = page.getByRole("button", { name: /^eliminar$/i }).first();
      await expect(btnEliminar).toBeVisible({ timeout: 10_000 });

      // ---- Ciclo A: abrir → Cancelar ----
      await btnEliminar.click();
      const dialog = page.getByRole("alertdialog").filter({
        hasText: /eliminar embarque|no se puede eliminar/i,
      }).first();
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await assertNoOverflow(page, `dialog-abierto ${vp.name}`);

      // Si el embarque tiene dependencias, el diálogo bloqueado muestra
      // "Entendido"; si no, muestra "Cancelar". Cerramos con el botón visible.
      const cancelar = dialog.getByRole("button", { name: /^cancelar$|^entendido$/i });
      await cancelar.click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });

      // Foco debe regresar al botón que abrió el diálogo (Radix
      // AlertDialog restaura foco al último elemento con foco previo).
      const focusedTagA = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.textContent?.trim().toLowerCase() ?? "";
      });
      expect(focusedTagA, `foco tras Cancelar (${vp.name})`).toContain("eliminar");

      // ---- Ciclo B: abrir → Escape ----
      await btnEliminar.click();
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden({ timeout: 5_000 });

      const focusedTagB = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.textContent?.trim().toLowerCase() ?? "";
      });
      expect(focusedTagB, `foco tras Escape (${vp.name})`).toContain("eliminar");

      await assertNoOverflow(page, `post-cierre ${vp.name}`);
      expect(consoleErrors, `consola en ${vp.name}`).toEqual([]);
    });
  });
}
