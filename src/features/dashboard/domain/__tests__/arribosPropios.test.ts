import { describe, it, expect } from "vitest";
import { sumarArribosPropios, type FilaProfitMes } from "../arribosPropios";

const fila = (v: number, c: number): FilaProfitMes => ({
  ventaMXN: v, costoMXN: c, ventaUSD: v / 17, costoUSD: c / 17,
  ventaMxnFromUsd: v, costoMxnFromUsd: c, ventaMxnFromEur: 0,
  costoMxnFromEur: 0, ventaMxnNative: 0, costoMxnNative: 0,
});

describe("sumarArribosPropios", () => {
  it("suma sólo las filas recibidas y deriva la utilidad", () => {
    const r = sumarArribosPropios([fila(1000, 600), fila(500, 450)]);
    expect(r.ventaMXN).toBe(1500);
    expect(r.costoMXN).toBe(1050);
    expect(r.profitMXN).toBe(450);
    expect(r.ventaMxnFromUsd).toBe(1500);
  });

  it("no mezcla gastos fijos de la empresa en la vista propia", () => {
    expect(sumarArribosPropios([fila(10, 5)]).gastosOperativosMXN).toBe(0);
  });

  it("lista vacía da ceros", () => {
    const r = sumarArribosPropios([]);
    expect(r.profitMXN).toBe(0);
    expect(r.ventaMXN).toBe(0);
  });
});
