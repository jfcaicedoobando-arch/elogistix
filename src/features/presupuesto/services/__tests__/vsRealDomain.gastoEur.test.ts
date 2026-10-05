import { describe, expect, it } from "vitest";
import { agregarGastosCxP, type CxpRow } from "../vsRealDomain";

/** Auditoría 85: el TC capturado pertenece a la moneda del documento. */
describe("agregarGastosCxP · multi-moneda", () => {
  it("valúa el gasto en USD con la paridad MXN/USD", () => {
    const { porCategoria, sinTc } = agregarGastosCxP([
      { categoria_presupuesto_id: "cat-1", subtotal: 100, moneda: "USD", tipo_cambio_usd: 18 },
    ] satisfies CxpRow[]);
    expect(sinTc).toBe(0);
    expect(porCategoria.get("cat-1")).toBe(1_800);
  });

  it("incluye EUR 100 a TC documento 20 sin advertencia falsa", () => {
    const { porCategoria, sinTc } = agregarGastosCxP([
      { categoria_presupuesto_id: "cat-1", subtotal: 100, moneda: "EUR", tipo_cambio_usd: 20 },
    ] satisfies CxpRow[]);
    expect(sinTc).toBe(0);
    expect(porCategoria.get("cat-1")).toBe(2_000);
  });

  it("suma 1:1 los gastos en pesos", () => {
    const { porCategoria, sinTc } = agregarGastosCxP([
      { categoria_presupuesto_id: "cat-1", subtotal: 500, moneda: "MXN", tipo_cambio_usd: null },
    ] satisfies CxpRow[]);
    expect(sinTc).toBe(0);
    expect(porCategoria.get("cat-1")).toBe(500);
  });
});

 it.each([null, 0, -1, Infinity, "NaN"])("excluye EUR sin paridad válida: %s", (tc) => {
    const r = agregarGastosCxP([{ categoria_presupuesto_id: "cat-1", subtotal: 100, moneda: "EUR", tipo_cambio_usd: tc }]);
    expect(r.sinTc).toBe(1);
    expect(r.porCategoria.size).toBe(0);
  });
