/**
 * Flujo 21 — Detalle de embarque: tabs Resumen, Tracking y Documentos.
 * v13.300.23 — usa POs + testids + fixture pageErrors.
 */
import { test, expect } from "../fixtures/pageErrors";
import { internalCreds, loginAs } from "../fixtures/auth";
import { EmbarqueDetallePO, EmbarquesListPO } from "../pageObjects/embarques";

test.describe("Flujo 21 — Detalle de embarque · tabs", () => {
  test("abre Resumen / Tracking / Documentos sin errores", async ({ page }) => {
    await loginAs(page, internalCreds());

    const list = new EmbarquesListPO(page);
    await list.goto();
    const rows = list.rows();
    await rows.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
    test.skip((await rows.count()) === 0, "Sin embarques sembrados en el tenant");

    await list.openFirstRow();

    const detalle = new EmbarqueDetallePO(page);
    await expect(detalle.tab("resumen")).toBeVisible({ timeout: 15_000 });

    // Resumen debe montar el estado progreso.
    const arribado = await detalle.isArribado();

    // Tab Tracking.
    await detalle.openTab("tracking");
    if (arribado) {
      // Guardrail 13.300.16: si el embarque ya arribó NO debe verse "ETA vencida".
      await expect(page.getByText(/eta vencid/i)).toHaveCount(0);
    }

    // Tab Documentos: el checklist debe montar.
    await detalle.openTab("documentos");
    await expect(
      page.getByText(/checklist|documentos requeridos|bill of lading|factura comercial/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // ErrorBoundary no debe estar montado.
    await expect(page.getByText(/algo sali[oó] mal|ocurri[oó] un error/i)).toHaveCount(0);
  });
});
