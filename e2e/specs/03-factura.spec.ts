import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 03 — Facturación", () => {
  test("módulo de facturación carga con tabs principales", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/facturacion");

    await expect(page.getByRole("heading", { name: /facturaci/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // v13.92.0: rediseño a 3 tabs (Por timbrar / Emitidas / Notas de crédito).
    await expect(page.getByRole("tab", { name: /por timbrar/i }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /emitidas/i }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /notas de cr/i }).first()).toBeVisible();
  });
});
