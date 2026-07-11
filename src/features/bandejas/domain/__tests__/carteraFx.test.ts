import { describe, it, expect } from "vitest";
import { equivalenteMxn } from "../carteraFx";

describe("bandejas/domain/carteraFx", () => {
  it("suma MXN directo y convierte USD con TC válido", () => {
    const r = equivalenteMxn({ MXN: 1000, USD: 100, otras: {} }, 20);
    expect(r).toEqual({ totalMxn: 3000, facturasSinTc: 0 });
  });

  it("reporta USD sin TC cuando tcUsdMxn <= 1", () => {
    const r = equivalenteMxn({ MXN: 500, USD: 200, otras: {} }, 0);
    expect(r.totalMxn).toBe(500);
    expect(r.facturasSinTc).toBe(1);
  });

  it("cuenta monedas ajenas como sin TC sin mezclarlas", () => {
    const r = equivalenteMxn({ MXN: 100, USD: 0, otras: { EUR: 50, GBP: 10 } }, 20);
    expect(r.totalMxn).toBe(100);
    expect(r.facturasSinTc).toBe(2);
  });

  it("ignora buckets en cero en 'otras'", () => {
    const r = equivalenteMxn({ MXN: 0, USD: 0, otras: { EUR: 0 } }, 20);
    expect(r).toEqual({ totalMxn: 0, facturasSinTc: 0 });
  });
});
