import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 02 — Embarques", () => {
  test("listado de embarques carga y permite abrir un detalle", async ({ page }) => {
    await loginAs(page, internalCreds());

    // Esperar la respuesta REST del listado en vez de heurística de networkidle.
    const listResp = page
      .waitForResponse(
        (r) => /\/rest\/v1\/embarques/i.test(r.url()) && r.request().method() === "GET",
        { timeout: 20_000 },
      )
      .catch(() => null);
    await page.goto("/embarques");
    await listResp;

    await expect(page.getByRole("heading", { name: /embarques/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const table = page.locator("table").first();
    await table.waitFor({ state: "visible", timeout: 20_000 });

    const rowCount = await page.locator("table tbody tr").count();
    test.skip(
      rowCount === 0,
      "Sin datos sembrados — establecer E2E_HAS_SEED=1 + seed para probar el detalle",
    );

    // Capturar la respuesta del detalle para asegurar que efectivamente
    // navegamos al recurso y no quedamos en el listado.
    const detailResp = page
      .waitForResponse(
        (r) => /\/rest\/v1\/embarques\?.*id=eq\./i.test(r.url()),
        { timeout: 15_000 },
      )
      .catch(() => null);
    await page.locator("table tbody tr").first().click();
    await detailResp;

    await expect(page).toHaveURL(/\/embarques\/[0-9a-f-]{36}/i);
    // Confirmar que cargó el detalle real: el header del embarque muestra
    // un heading con el expediente (ELIMP/ELEXP/ELGEN-XXXXX).
    await expect(
      page.getByRole("heading", { name: /EL(IMP|EXP|GEN)\d+/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
