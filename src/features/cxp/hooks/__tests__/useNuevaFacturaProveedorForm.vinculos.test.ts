/**
 * Regresión: vincular un costo en otra moneda NO debe generar un ajuste
 * fantasma. La base (`montoOriginal`) se guarda en la moneda de la factura.
 */
import { describe, it, expect } from "vitest";
import { toggleVinculoReducer } from "../useNuevaFacturaProveedorForm.vinculos";
import type { ConceptoCostoAbierto } from "@/features/cxp/services";

const concepto = {
  id: "c1",
  embarque_id: "e1",
  concepto: "Flete marítimo",
  monto: 51,
  moneda: "USD",
} as unknown as ConceptoCostoAbierto;

describe("toggleVinculoReducer", () => {
  it("usa el monto convertido como base cuando la moneda difiere", () => {
    const next = toggleVinculoReducer({}, concepto, true, 872.57);
    expect(next.c1.monto).toBe(872.57);
    expect(next.c1.montoOriginal).toBe(872.57);
  });

  it("usa el monto cotizado cuando no se pasa base convertida", () => {
    const next = toggleVinculoReducer({}, concepto, true);
    expect(next.c1.montoOriginal).toBe(51);
  });

  it("quita el vínculo al desmarcar", () => {
    const conVinculo = toggleVinculoReducer({}, concepto, true, 872.57);
    expect(toggleVinculoReducer(conVinculo, concepto, false)).toEqual({});
  });
});
