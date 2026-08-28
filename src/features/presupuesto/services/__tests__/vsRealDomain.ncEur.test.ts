import { describe, expect, it } from "vitest";
import { restarNotasCreditoCxP, type NcCxPRow } from "../vsRealDomain";

/**
 * N9 (Ola E2/E3 · Sub-ola D): una NC en EUR debe valuarse con su propia
 * paridad EUR/MXN, no con el T/C del dólar heredado de la factura padre.
 */
describe("restarNotasCreditoCxP · multi-moneda", () => {
  it("usa la paridad propia de la NC en EUR", () => {
    const real = new Map<string, number>([["cat-1", 100_000]]);
    const rows: NcCxPRow[] = [
      { categoria_presupuesto_id: "cat-1", monto: 100, moneda: "EUR", tipo_cambio_usd: 21 },
    ];
    expect(restarNotasCreditoCxP(rows, real)).toBe(0);
    expect(real.get("cat-1")).toBe(100_000 - 2_100);
  });

  it("excluye la NC extranjera sin paridad y la reporta", () => {
    const real = new Map<string, number>([["cat-1", 5_000]]);
    const rows: NcCxPRow[] = [
      { categoria_presupuesto_id: "cat-1", monto: 100, moneda: "EUR", tipo_cambio_usd: null },
    ];
    expect(restarNotasCreditoCxP(rows, real)).toBe(1);
    expect(real.get("cat-1")).toBe(5_000);
  });

  it("resta 1:1 las NC en pesos", () => {
    const real = new Map<string, number>([["cat-1", 1_000]]);
    const rows: NcCxPRow[] = [
      { categoria_presupuesto_id: "cat-1", monto: 250, moneda: "MXN", tipo_cambio_usd: null },
    ];
    expect(restarNotasCreditoCxP(rows, real)).toBe(0);
    expect(real.get("cat-1")).toBe(750);
  });
});
