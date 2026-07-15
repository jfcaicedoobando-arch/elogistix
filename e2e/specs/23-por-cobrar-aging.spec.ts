/**
 * Flujo 23 — Bandeja Por cobrar: aging correcto (13.300.18).
 *
 * Regresión del bug donde TODAS las facturas mostraban "Vence hoy" porque
 * `cobranza.ts` clampaba las fechas futuras a 0. Ahora la columna "Vence en"
 * debe tener variedad: al menos una fila con "en Nd" (futuro) cuando existen
 * facturas con vencimiento futuro en el seed.
 */
import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 23 — Por cobrar · aging", () => {
  test("columna 'Vence en' no está clampada a 'hoy' para todas las filas", async ({ page }) => {
    await loginAs(page, internalCreds());

    await page.goto("/facturacion?tab=por-cobrar");
    await expect(page.getByRole("heading", { name: /facturaci/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    const tabPorCobrar = page.getByRole("tab", { name: /por cobrar/i }).first();
    if (await tabPorCobrar.isVisible().catch(() => false)) {
      await tabPorCobrar.click();
    }

    // Esperar tabla con filas o empty-state.
    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => null);
    const total = await rows.count();
    test.skip(total === 0, "Sin facturas por cobrar en el tenant");

    // Recolectar texto de la columna "Vence en" (badges tipo "en Nd" / "hoy" / "vencida").
    // La columna es la 4ª del defineColumns (folio, cliente, vence, vence en, saldo).
    const cells = rows.locator("td").nth(3);
    const textos: string[] = [];
    const n = Math.min(total, 15);
    for (let i = 0; i < n; i++) {
      textos.push(((await cells.nth(i).textContent()) ?? "").trim().toLowerCase());
    }

    // Guardrail del bug 13.300.18: si hay ≥3 filas, NO todas deben decir "hoy".
    if (total >= 3) {
      const todasHoy = textos.every((t) => /^hoy$|vence hoy/.test(t));
      expect(todasHoy).toBe(false);
    }

    // Al menos una etiqueta con formato válido esperado.
    const alguna = textos.some((t) => /d[íi]as?|hoy|vencid|en \d/.test(t));
    expect(alguna).toBe(true);
  });
});
