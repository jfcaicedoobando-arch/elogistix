import { describe, it, expect } from "vitest";
import {
  calcularReglasNoAplica,
  MOTIVO_SIN_FACTURAS,
  MOTIVO_SIN_COSTOS_COMPROBADOS,
  MOTIVO_SIN_COMISION,
} from "../cierreCheckNoAplica";

describe("calcularReglasNoAplica", () => {
  it("marca CxC y REP cuando no hay facturas de cliente", () => {
    const map = calcularReglasNoAplica([
      { regla: "cxc_cobrada", ok: true, detalle: { por_moneda: [], saldo_total: 0 } },
      { regla: "rep_timbrados", ok: true, detalle: { pendientes: 0 } },
    ]);
    expect(map.get("cxc_cobrada")).toBe(MOTIVO_SIN_FACTURAS);
    expect(map.get("rep_timbrados")).toBe(MOTIVO_SIN_FACTURAS);
  });

  it("marca CxP cuando no hay facturas de proveedor", () => {
    const map = calcularReglasNoAplica([
      { regla: "cxp_pagada", ok: true, detalle: { por_moneda: [] } },
    ]);
    expect(map.get("cxp_pagada")).toBe(MOTIVO_SIN_FACTURAS);
  });

  it("no marca nada cuando ya hay facturas y la base está completa", () => {
    const map = calcularReglasNoAplica([
      { regla: "cxc_cobrada", ok: false, detalle: { por_moneda: [{ moneda: "MXN", total: 100, saldo: 100 }] } },
      { regla: "cxp_pagada", ok: true, detalle: { por_moneda: [{ moneda: "MXN", total: 50, saldo: 0 }] } },
      { regla: "rep_timbrados", ok: true, detalle: { pendientes: 0 } },
      { regla: "costo_conceptos_con_factura", ok: true },
      { regla: "venta_conceptos_facturados", ok: true },
      { regla: "margen_minimo", ok: true },
      { regla: "comisiones_definitivas", ok: true },
    ]);
    expect(map.size).toBe(0);
  });

  it("no oculta REP pendiente aunque no haya facturas (dato inconsistente)", () => {
    const map = calcularReglasNoAplica([
      { regla: "cxc_cobrada", ok: true, detalle: { por_moneda: [] } },
      { regla: "rep_timbrados", ok: false, detalle: { pendientes: 2 } },
    ]);
    expect(map.has("rep_timbrados")).toBe(false);
  });

  it("marca margen y comisiones cuando faltan costos con factura", () => {
    const map = calcularReglasNoAplica([
      { regla: "costo_conceptos_con_factura", ok: false, detalle: { sin_factura: 4 } },
      { regla: "margen_minimo", ok: true, detalle: { margen_pct: 42 } },
      { regla: "comisiones_definitivas", ok: true, detalle: { no_definitivas: 0 } },
      { regla: "comision_calculada", ok: true },
    ]);
    expect(map.get("margen_minimo")).toBe(MOTIVO_SIN_COSTOS_COMPROBADOS);
    expect(map.get("comisiones_definitivas")).toBe(MOTIVO_SIN_COSTOS_COMPROBADOS);
    expect(map.get("comision_calculada")).toBe(MOTIVO_SIN_COSTOS_COMPROBADOS);
  });

  it("marca margen cuando falta venta por facturar", () => {
    const map = calcularReglasNoAplica([
      { regla: "venta_conceptos_facturados", ok: false, detalle: { pendientes: 2 } },
      { regla: "pnl_margen_minimo", ok: true },
    ]);
    expect(map.get("pnl_margen_minimo")).toBe(MOTIVO_SIN_COSTOS_COMPROBADOS);
  });

  it("respeta el margen ya reprobado (se queda en Pendiente rojo)", () => {
    const map = calcularReglasNoAplica([
      { regla: "costo_conceptos_con_factura", ok: false },
      { regla: "margen_minimo", ok: false, detalle: { margen_pct: 1 } },
    ]);
    expect(map.has("margen_minimo")).toBe(false);
  });

  it("marca comisiones en gris cuando el embarque no genera comisión", () => {
    const map = calcularReglasNoAplica(
      [
        { regla: "costo_conceptos_con_factura", ok: true },
        { regla: "comisiones_definitivas", ok: false, detalle: { no_definitivas: 1 } },
        { regla: "comision_calculada", ok: false },
      ],
      { sinComision: true },
    );
    expect(map.get("comisiones_definitivas")).toBe(MOTIVO_SIN_COMISION);
    expect(map.get("comision_calculada")).toBe(MOTIVO_SIN_COMISION);
  });
});
