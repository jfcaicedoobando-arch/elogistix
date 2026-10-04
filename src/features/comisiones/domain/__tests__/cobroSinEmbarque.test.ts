import { describe, expect, it } from "vitest";
import { cobroSinEmbarqueMxn, comisionSinEmbarque, type PagoCobrado } from "../cobroSinEmbarque";

const pago: PagoCobrado = {
  monto: 116, moneda: "MXN", monto_aplicado_factura: 116, deleted_at: null, estado_rep: "NoAplica",
};

describe("47 · cobro conocido sin embarque", () => {
  it.each([116, 0.06, 0.07, 0])("conserva el cobro MXN %s, incluido un cero conocido", (monto) => {
    expect(cobroSinEmbarqueMxn({ ...pago, monto })).toBe(monto);
  });
  it("recupera el importe aplicado en MXN cuando el pago es en otra moneda", () => {
    expect(cobroSinEmbarqueMxn({ ...pago, monto: 5, moneda: "USD", monto_aplicado_factura: "95" }, "MXN")).toBe(95);
  });
  it("no confunde datos ausentes, no finitos ni divisas sin conversión con cero", () => {
    expect(cobroSinEmbarqueMxn(null)).toBeNull();
    expect(cobroSinEmbarqueMxn({ ...pago, monto: null })).toBeNull();
    expect(cobroSinEmbarqueMxn({ ...pago, monto: NaN })).toBeNull();
    expect(cobroSinEmbarqueMxn({ ...pago, moneda: "USD" }, "USD")).toBeNull();
  });
  it("un pago eliminado o con REP cancelado no se presenta como cobro vigente", () => {
    expect(cobroSinEmbarqueMxn({ ...pago, deleted_at: "2026-10-04" })).toBeNull();
    expect(cobroSinEmbarqueMxn({ ...pago, estado_rep: "Cancelado" })).toBeNull();
  });
  it("distingue la comisión no calculada de una comisión cero válida o un histórico liquidado", () => {
    const row = { embarque_id: null, estado: "Devengada", comision_mxn: 0 };
    expect(comisionSinEmbarque(row)).toBe(true);
    expect(comisionSinEmbarque({ ...row, embarque_id: "e1" })).toBe(false);
    expect(comisionSinEmbarque({ ...row, estado: "Liquidada" })).toBe(false);
    expect(comisionSinEmbarque({ ...row, estado: "Por recuperar" })).toBe(false);
    expect(comisionSinEmbarque({ ...row, comision_mxn: 50 })).toBe(false);
  });
});
