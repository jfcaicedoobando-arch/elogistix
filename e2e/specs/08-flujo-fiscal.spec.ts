/**
 * Flujo 08 — Happy path fiscal (proforma → factura → timbrado → pago → REP).
 *
 * Este spec corre en SANDBOX: requiere que el tenant de staging tenga
 * configuradas las credenciales FacturApi sandbox y una proforma aprobada
 * lista para convertir. Por defecto está `skip` para no romper el smoke
 * de CI (ningún CI tiene la cuenta sandbox); úsalo manualmente:
 *
 *   E2E_FISCAL=1 E2E_PROFORMA_NUMERO=PRO-2026-XXXX npx playwright test 08
 *
 * v13.137.13 — cierra el pendiente 11 del plan fiscal.
 */
import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

const ENABLED = process.env.E2E_FISCAL === "1";
const PROFORMA = process.env.E2E_PROFORMA_NUMERO ?? "";

test.describe("Flujo 08 — Fiscal happy path", () => {
  test.skip(!ENABLED, "E2E_FISCAL=1 + E2E_PROFORMA_NUMERO requeridos");

  test("proforma aprobada → convertir → timbrar → registrar pago PPD → REP", async ({ page }) => {
    await loginAs(page, internalCreds());

    // 1. Entrar a facturación y localizar la proforma aprobada.
    await page.goto("/facturacion");
    await expect(page.getByRole("tab", { name: /por timbrar/i })).toBeVisible();
    await page.getByRole("tab", { name: /por timbrar/i }).click();

    const row = page.getByRole("row", { name: new RegExp(PROFORMA, "i") });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // 2. Convertir a factura.
    await row.getByRole("checkbox").check();
    await page.getByRole("button", { name: /convertir a factura/i }).click();
    await page.getByRole("button", { name: /^confirmar$/i }).click();
    await expect(page.getByText(/factura.*creada/i)).toBeVisible({ timeout: 20_000 });

    // 3. Saltar a Emitidas, timbrar la primera Borrador.
    await page.getByRole("tab", { name: /emitidas/i }).click();
    const borrador = page.getByRole("row").filter({ hasText: /Borrador/i }).first();
    await borrador.getByRole("button", { name: /timbrar/i }).click();
    await page.getByRole("button", { name: /^timbrar$/i }).click();
    await expect(page.getByText(/timbrada/i)).toBeVisible({ timeout: 30_000 });

    // 4. Registrar pago PPD → debe generarse el REP automáticamente.
    await borrador.getByRole("button", { name: /registrar pago/i }).click();
    await page.getByLabel(/monto/i).fill("100");
    await page.getByLabel(/forma de pago/i).selectOption({ label: /transferencia/i });
    await page.getByRole("button", { name: /guardar/i }).click();

    await expect(page.getByText(/REP.*timbrado|Complemento.*timbrado/i)).toBeVisible({
      timeout: 45_000,
    });
  });
});
