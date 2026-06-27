import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 02 — Embarques", () => {
  test("listado de embarques carga y permite abrir un detalle", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/embarques");

    await expect(page.getByRole("heading", { name: /embarques/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Esperar a que la tabla termine de cargar (estado loading=false) antes
    // de decidir si hay filas. Evita race con `Promise.race` que veía el
    // empty-state mientras la query aún no resolvía.
    const table = page.locator("table").first();
    await table.waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
      // networkidle puede no llegar si hay subscripciones realtime — tolerar.
    });

    const rowCount = await page.locator("table tbody tr").count();
    test.skip(
      rowCount === 0,
      "Sin datos sembrados — establecer E2E_HAS_SEED=1 + seed para probar el detalle",
    );

    await page.locator("table tbody tr").first().click();
    await expect(page).toHaveURL(/\/embarques\/.+/);
    await expect(page.getByText(/expediente|operador|cliente/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
