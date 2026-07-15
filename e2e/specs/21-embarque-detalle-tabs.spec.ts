/**
 * Flujo 21 — Detalle de embarque: tabs Resumen, Tracking y Documentos.
 *
 * Smoke que asegura que:
 *  - las 3 pestañas montan sin crashear tras los refactors 13.300.14-16
 *  - el tab Tracking no muestra "ETA vencida" cuando el embarque ya llegó
 *    (bug corregido en 13.300.16)
 *  - el tab Documentos muestra la sección de checklist
 *
 * Requiere ≥1 embarque en el tenant (E2E_HAS_SEED implícito).
 */
import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 21 — Detalle de embarque · tabs", () => {
  test("abre Resumen / Tracking / Documentos sin errores", async ({ page }) => {
    await loginAs(page, internalCreds());

    const listResp = page
      .waitForResponse(
        (r) => /\/rest\/v1\/embarques/i.test(r.url()) && r.request().method() === "GET",
        { timeout: 20_000 },
      )
      .catch(() => null);
    await page.goto("/embarques");
    await listResp;

    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
    const total = await rows.count();
    test.skip(total === 0, "Sin embarques sembrados en el tenant");

    await rows.first().click();
    await expect(page).toHaveURL(/\/embarques\/[0-9a-f-]{36}/i, { timeout: 15_000 });

    // Tab Resumen (default): partes + estado progreso deben verse.
    const tabResumen = page.getByRole("tab", { name: /^resumen$/i }).first();
    await expect(tabResumen).toBeVisible({ timeout: 15_000 });

    // Tab Tracking.
    await page.getByRole("tab", { name: /^tracking$/i }).click();
    // No debe haber un banner de "ETA vencida" si el detalle indica que
    // el embarque ya arribó. Buscamos ambos y validamos exclusión mutua.
    const arribadoBadge = page.getByText(/entregad[oa]|arribad[oa]|en dest/i).first();
    const etaVencida = page.getByText(/eta vencid/i).first();
    if (await arribadoBadge.isVisible().catch(() => false)) {
      await expect(etaVencida).toHaveCount(0);
    }

    // Tab Documentos: el checklist debe montar (título "Documentos" en el heading interno).
    await page.getByRole("tab", { name: /^documentos$/i }).click();
    await expect(
      page.getByText(/checklist|documentos requeridos|bill of lading|factura comercial/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Guardrail: no debe haber overlay de ErrorBoundary.
    await expect(page.getByText(/algo sali[oó] mal|ocurri[oó] un error/i)).toHaveCount(0);
  });
});
