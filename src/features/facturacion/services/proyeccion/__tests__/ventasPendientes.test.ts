import { describe, expect, it } from "vitest";
import { ventasPendientes, type FacturaCierre } from "../ventasPendientes";
const factura = (over: Partial<FacturaCierre> = {}): FacturaCierre => ({ id: "f", embarque_id: "e1",
  proforma_id: "p1", moneda: "MXN", subtotal: 150, conceptos_factura: [], ...over });
const ventas = [{ embarque_id: "e1", proforma_id: "p1", moneda: "MXN", total: 150 },
  { embarque_id: "e1", proforma_id: null, moneda: "MXN", total: 50 }];
describe("emitted coverage and projected pending", () => {
  it("keeps the separate50 sale pending, despite one emitted proforma", () => {
    expect(ventasPendientes(ventas, [factura()])).toEqual([ventas[1]]);
    expect(ventasPendientes(ventas, [])).toEqual(ventas);
  });
  it("keeps draft/cancelled coverage absent and separates currencies of one proforma", () => {
    const mixtas = [...ventas, { ...ventas[0], moneda: "USD", total: 10 }];
    expect(ventasPendientes(mixtas, [factura()])).toEqual([ventas[1], mixtas[2]]);
  });
  it("consolidated invoices cover their own shipments and origin proformas exactly once", () => {
    const consolidada = factura({ embarque_id: null, proforma_id: null, subtotal: 200,
      conceptos_factura: [
        { embarque_id: "e1", proforma_id_origen: "p1", total: 150, deleted_at: null },
        { embarque_id: "e2", proforma_id_origen: "p2", total: 50, deleted_at: null },
      ] });
    expect(ventasPendientes([...ventas, { ...ventas[1], embarque_id: "e2", proforma_id: "p2" }], [consolidada]))
      .toEqual([ventas[1]]);
  });
  it("untagged invoice lines do not inflate tagged coverage", () => {
    const f = factura({ subtotal: 200, conceptos_factura: [
      { embarque_id: "e1", proforma_id_origen: "p1", total: 150, deleted_at: null },
      { embarque_id: null, proforma_id_origen: null, total: 50, deleted_at: null },
    ] });
    expect(ventasPendientes([{ ...ventas[0], total: 200 }], [f])[0].total).toBe(50);
  });
  it("legacy consolidated invoice uses active shipment links ahead of header", () => {
    const f = factura({ embarque_id: "other", proforma_id: null, subtotal: 100,
      factura_embarques: [{ embarque_id: "e1", activa: true }, { embarque_id: "e2", activa: true },
        { embarque_id: "cancelled", activa: false }] });
    expect(ventasPendientes([{ ...ventas[1], total: 70 }], [f])[0].total).toBe(20);
    expect(ventasPendientes([{ ...ventas[0], total: 70 }], [f])[0].total).toBe(20);
  });
  it("legacy origin-less credit coverage is not used twice across identified and unlinked sales", () => {
    const f = factura({ proforma_id: null, subtotal: 100 });
    const mixed = [...ventas, { ...ventas[0], proforma_id: "p2", total: 25 }];
    const pending = ventasPendientes(mixed, [f]);
    expect(pending.reduce((s, v) => s + Number(v.total), 0)).toBe(125);
  });
  it("partial gross issue within a proforma leaves the remaining base", () => {
    expect(ventasPendientes(ventas, [factura({ subtotal: 100 })])).toEqual([
      { ...ventas[0], total: 50 }, ventas[1],
    ]);
  });
});
