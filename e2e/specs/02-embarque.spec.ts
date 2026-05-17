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
    const firstRow = page.locator("table tbody tr, [role='row']").first();
    const emptyState = page.getByText(/sin resultados|no hay embarques/i);
    await Promise.race([
      firstRow.waitFor({ state: "visible", timeout: 20_000 }),
      emptyState.waitFor({ state: "visible", timeout: 20_000 }),
    ]);

    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/embarques\/.+/);
      await expect(page.getByText(/expediente|operador|cliente/i).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });
});
