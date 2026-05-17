import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 03 — Facturación", () => {
  test("módulo de facturación carga con tabs principales", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/facturacion");

    await expect(page.getByRole("heading", { name: /facturaci/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Tabs típicas: Facturas / Proformas / Proyección.
    await expect(page.getByRole("tab", { name: /facturas/i }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /proformas/i }).first()).toBeVisible();
  });
});
