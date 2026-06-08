import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 04 — Conciliación / Proformas pendientes", () => {
  test("tab de proformas pendientes carga sin errores", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/facturacion");

    const tab = page.getByRole("tab", { name: /proformas|pendientes|conciliaci/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
    await tab.click();

    // Locators separados: filas reales del tbody vs estado vacío explícito.
    // Antes el locator triple (`tbody tr, [role=row], [data-empty=true]`)
    // resolvía a headers (rows) y daba falsos positivos.
    const dataRow = page.locator("table tbody tr").first();
    const emptyMarker = page.locator("[data-empty='true']").first();
    const emptyText = page.getByText(/sin resultados|no hay/i).first();
    await Promise.race([
      dataRow.waitFor({ state: "visible", timeout: 20_000 }),
      emptyMarker.waitFor({ state: "visible", timeout: 20_000 }),
      emptyText.waitFor({ state: "visible", timeout: 20_000 }),
    ]);

    // No debe haberse roto el render.
    await expect(page.getByText(/algo salió mal|error/i)).toHaveCount(0);
  });
});
