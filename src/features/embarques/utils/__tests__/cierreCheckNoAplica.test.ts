import { describe, it, expect } from "vitest";
import { calcularReglasNoAplica } from "../cierreCheckNoAplica";

describe("calcularReglasNoAplica", () => {
  it("marca CxC y REP cuando no hay facturas de cliente", () => {
    const set = calcularReglasNoAplica([
      { regla: "cxc_cobrada", ok: true, detalle: { por_moneda: [], saldo_total: 0 } },
      { regla: "rep_timbrados", ok: true, detalle: { pendientes: 0 } },
    ]);
    expect(set.has("cxc_cobrada")).toBe(true);
    expect(set.has("rep_timbrados")).toBe(true);
  });

  it("marca CxP cuando no hay facturas de proveedor", () => {
    const set = calcularReglasNoAplica([
      { regla: "cxp_pagada", ok: true, detalle: { por_moneda: [] } },
    ]);
    expect(set.has("cxp_pagada")).toBe(true);
  });

  it("no marca nada cuando ya hay facturas", () => {
    const set = calcularReglasNoAplica([
      { regla: "cxc_cobrada", ok: false, detalle: { por_moneda: [{ moneda: "MXN", total: 100, saldo: 100 }] } },
      { regla: "cxp_pagada", ok: true, detalle: { por_moneda: [{ moneda: "MXN", total: 50, saldo: 0 }] } },
      { regla: "rep_timbrados", ok: true, detalle: { pendientes: 0 } },
    ]);
    expect(set.size).toBe(0);
  });

  it("no oculta REP pendiente aunque no haya facturas (dato inconsistente)", () => {
    const set = calcularReglasNoAplica([
      { regla: "cxc_cobrada", ok: true, detalle: { por_moneda: [] } },
      { regla: "rep_timbrados", ok: false, detalle: { pendientes: 2 } },
    ]);
    expect(set.has("rep_timbrados")).toBe(false);
  });
});
