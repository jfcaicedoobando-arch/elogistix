/**
 * Flujo 23 — Bandeja Por cobrar: aging correcto (13.300.18).
 * v13.300.23 — usa PO + testid col-vence-en (elimina dependencia de orden).
 */
import { test, expect } from "../fixtures/pageErrors";
import { internalCreds, loginAs } from "../fixtures/auth";
import { FacturacionPO } from "../pageObjects/facturacion";

test.describe("Flujo 23 — Por cobrar · aging", () => {
  test("columna 'Vence en' no está clampada a 'hoy' para todas las filas", async ({ page }) => {
    await loginAs(page, internalCreds());

    const po = new FacturacionPO(page);
    await po.gotoPorCobrar();

    const rows = po.rows();
    await rows.first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => null);
    const total = await rows.count();
    test.skip(total === 0, "Sin facturas por cobrar en el tenant");

    const cells = po.venceEnCells();
    const n = Math.min(await cells.count(), 15);

    const dias: number[] = [];
    const textos: string[] = [];
    for (let i = 0; i < n; i++) {
      const c = cells.nth(i);
      textos.push(((await c.textContent()) ?? "").trim().toLowerCase());
      const d = await c.getAttribute("data-dias");
      const parsed = Number(d);
      if (Number.isFinite(parsed)) dias.push(parsed);
    }

    // Regresión 13.300.18: si hay ≥3 filas no todas deben decir "hoy".
    if (total >= 3) {
      const todasHoy = textos.every((t) => /^hoy$|vence hoy/.test(t));
      expect(todasHoy, `todas las celdas dicen "hoy": ${JSON.stringify(textos)}`).toBe(false);

      // Además, si alguna fila tiene fecha futura (data-dias < 0), no debe
      // mostrarse como "hoy".
      const clampadas = dias.filter((d) => d < 0).length > 0 && textos.every((t) => /^hoy$/.test(t));
      expect(clampadas).toBe(false);
    }

    const alguna = textos.some((t) => /d[íi]as?|hoy|vencid|en \d/.test(t));
    expect(alguna).toBe(true);
  });
});
