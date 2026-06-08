import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 02 — Embarques", () => {
  test("listado de embarques carga y permite abrir un detalle", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/embarques");

    await expect(page.getByRole("heading", { name: /embarques/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Esperar a que cargue la primera fila (o estado vacío explícito).
    const firstRow = page.locator("table tbody tr").first();
    const emptyState = page.getByText(/sin resultados|no hay embarques/i);
    await Promise.race([
      firstRow.waitFor({ state: "visible", timeout: 20_000 }),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }),
    ]);

    // Si no hay datos sembrados, saltar el paso de detalle en lugar de un
    // `if (visible)` que pasa siempre. Requiere `E2E_HAS_SEED=1` para
    // ejercitar el flujo completo en CI con seed.
    const hasRow = await firstRow.isVisible().catch(() => false);
    test.skip(!hasRow, "Sin datos sembrados — establecer E2E_HAS_SEED=1 + seed para probar el detalle");

    await firstRow.click();
    await expect(page).toHaveURL(/\/embarques\/.+/);
    await expect(page.getByText(/expediente|operador|cliente/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
