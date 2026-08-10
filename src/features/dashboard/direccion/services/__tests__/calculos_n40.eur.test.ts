import { describe, it, expect } from "vitest";
import { agregarEmbarques } from "../calculos";
import type { EmbarqueRow } from "../loaders";

function embarque(over: Partial<EmbarqueRow> = {}): EmbarqueRow {
  return {
    id: "e1", modo: "Marítimo", estado: "Activo", eta: "2026-01-10",
    cerrado_at: null, cliente_id: "c1", cliente_nombre: "Cliente Uno",
    tipo_cambio_usd: 18, tipo_cambio_eur: 20,
    ...over,
  };
}

// Ola 4 · N40: la guardia debe validar el TC de la MONEDA del concepto (EUR
// usa tipo_cambio_eur, no tipo_cambio_usd) — antes `agregarEmbarques` validaba
// siempre `t.usd` sin importar la moneda del concepto.
describe("agregarEmbarques — guardia EUR-only (Ola 4 · N40)", () => {
  it("suma ventas y costos EUR con sólo tipo_cambio_eur capturado (sin TC USD)", () => {
    const out = agregarEmbarques(
      [embarque({ tipo_cambio_usd: 0, tipo_cambio_eur: 21 })],
      [{ embarque_id: "e1", total: 100, moneda: "EUR" }],
      [{ embarque_id: "e1", monto: 50, moneda: "EUR" }],
    );
    expect(out[0].venta).toBe(2100);
    expect(out[0].costo).toBe(1050);
  });

  it("ignora conceptos EUR sin tipo_cambio_eur aunque exista TC USD válido", () => {
    const out = agregarEmbarques(
      [embarque({ tipo_cambio_usd: 18, tipo_cambio_eur: 0 })],
      [{ embarque_id: "e1", total: 100, moneda: "EUR" }],
      [{ embarque_id: "e1", monto: 30, moneda: "EUR" }],
    );
    expect(out[0].venta).toBe(0);
    expect(out[0].costo).toBe(0);
  });

  it("conceptos USD siguen requiriendo TC USD válido (regresión)", () => {
    const out = agregarEmbarques(
      [embarque({ tipo_cambio_usd: 0, tipo_cambio_eur: 20 })],
      [{ embarque_id: "e1", total: 100, moneda: "USD" }],
      [],
    );
    expect(out[0].venta).toBe(0);
  });
});
