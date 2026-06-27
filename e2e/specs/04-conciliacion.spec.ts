import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

/**
 * Flujo 04 — "Por timbrar" (antes Conciliación / Proformas pendientes).
 *
 * v13.92.0 consolidó las proformas pendientes dentro del tab "Por timbrar"
 * del módulo `/facturacion`. Este spec valida que ese tab monta y muestra
 * datos o un empty state, sin crashes.
 */
test.describe("Flujo 04 — Por timbrar (proformas)", () => {
  test("tab 'Por timbrar' carga sin errores", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/facturacion");

    const tab = page.getByRole("tab", { name: /por timbrar/i }).first();
    await expect(tab).toBeVisible({ timeout: 15_000 });
    await tab.click();

    // El tab muestra una tabla con proformas O un empty state. Usamos un
    // locator combinado para que el mensaje de fallo sea claro y para no
    // depender de Promise.race con tres timeouts de 20s.
    const dataRow = page.locator("table tbody tr").first();
    const emptyMarker = page.locator("[data-empty='true']").first();
    const emptyText = page.getByText(/sin resultados|no hay|sin proformas/i).first();
    const cualquiera = dataRow.or(emptyMarker).or(emptyText);
    await expect(
      cualquiera,
      "El tab Por timbrar no mostró ni filas ni empty state",
    ).toBeVisible({ timeout: 20_000 });

    // No debe haberse roto el render con un error boundary.
    await expect(page.getByText(/algo salió mal/i)).toHaveCount(0);
  });
});
