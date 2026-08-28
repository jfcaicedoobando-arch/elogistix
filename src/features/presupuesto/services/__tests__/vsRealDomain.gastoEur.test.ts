import { describe, expect, it } from "vitest";
import { agregarGastosCxP, type CxpRow } from "../vsRealDomain";

/**
 * N9 (backlog v4): `proveedor_facturas` sólo guarda `tipo_cambio_usd`
 * (MXN por 1 USD). Aplicarlo a un gasto en EUR valuaba con la divisa
 * equivocada; ahora se excluye del real y se reporta como gasto sin T/C.
 */
describe("agregarGastosCxP · multi-moneda", () => {
  it("valúa el gasto en USD con la paridad MXN/USD", () => {
    const { porCategoria, sinTc } = agregarGastosCxP([
      { categoria_presupuesto_id: "cat-1", subtotal: 100, moneda: "USD", tipo_cambio_usd: 18 },
    ] satisfies CxpRow[]);
    expect(sinTc).toBe(0);
    expect(porCategoria.get("cat-1")).toBe(1_800);
  });

  it("excluye el gasto en EUR valuado con el T/C del dólar", () => {
    const { porCategoria, sinTc } = agregarGastosCxP([
      { categoria_presupuesto_id: "cat-1", subtotal: 100, moneda: "EUR", tipo_cambio_usd: 18 },
    ] satisfies CxpRow[]);
    expect(sinTc).toBe(1);
    expect(porCategoria.get("cat-1")).toBeUndefined();
  });

  it("suma 1:1 los gastos en pesos", () => {
    const { porCategoria, sinTc } = agregarGastosCxP([
      { categoria_presupuesto_id: "cat-1", subtotal: 500, moneda: "MXN", tipo_cambio_usd: null },
    ] satisfies CxpRow[]);
    expect(sinTc).toBe(0);
    expect(porCategoria.get("cat-1")).toBe(500);
  });
});
