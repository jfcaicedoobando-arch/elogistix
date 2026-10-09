import { describe, expect, it } from "vitest";
import { resumirUtilidadCotizacion } from "../resumenUtilidadCotizacion";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

const usd = { totalCosto: 50, totalVenta: 100, profit: 50, porcentaje: 50 };
const vacio = { totalCosto: 0, totalVenta: 0, profit: 0, porcentaje: 0 };
const venta = (over: Partial<ConceptoVentaCotizacion> = {}): ConceptoVentaCotizacion => ({
  descripcion: "Coordinación", moneda: "USD", cantidad: 1, precio_unitario: 150,
  unidad_medida: "Servicio", total: 174, aplica_iva: true, tasa_iva_aplicada: 0.16, ...over,
});
const calcular = (ventas?: ConceptoVentaCotizacion[]) => resumirUtilidadCotizacion(usd, vacio, ventas);

describe("resumen comercial de utilidad", () => {
  it("override USD150 y manual MXN10200: conserva costo50, sin mezclar monedas", () => {
    const r = calcular([venta(), venta({ moneda: "MXN", precio_unitario: 10200, total: 10200, tipo_iva: "no_objeto" })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalesUSD).toMatchObject({ totalCosto: 50, totalVenta: 150, profit: 100 });
    expect(r.totalesUSD.porcentaje).toBe(66.67);
    expect(r.totalesMXN).toEqual({ totalCosto: 0, totalVenta: 10200, profit: 10200, porcentaje: 100 });
    expect(r.tieneVentaMXN).toBe(true);
  });

  it.each(["gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto"])("no incorpora impuesto %s ni total guardado", tipo_iva => {
    expect(calcular([venta({ tipo_iva, total: 999 })])).toMatchObject({ ok: true, totalesUSD: { totalVenta: 150, profit: 100 } });
  });

  it("un precio explícito cero conserva pérdida y no repone la venta del costeo", () => {
    expect(calcular([venta({ precio_unitario: 0, total: 174 })])).toMatchObject({ ok: true,
      totalesUSD: { totalVenta: 0, totalCosto: 50, profit: -50, porcentaje: 0 } });
  });

  it("no recurre al presupuesto por moneda ausente y conserva costos sin venta", () => {
    expect(resumirUtilidadCotizacion(usd, { totalCosto: 20, totalVenta: 40, profit: 20, porcentaje: 50 }, [venta()]))
      .toMatchObject({ ok: true, totalesMXN: { totalCosto: 20, totalVenta: 0, profit: -20 } });
  });

  it("respeta precisión por línea, cantidades y duplicados manuales legítimos", () => {
    const r = calcular([venta({ cantidad: 960, precio_unitario: 3.125 }), venta({ cantidad: 1, precio_unitario: 10.075 }), venta({ cantidad: 1, precio_unitario: 10.075 })]);
    expect(r).toMatchObject({ ok: true, totalesUSD: { totalVenta: 3020.16, profit: 2970.16 } });
  });

  it("ausencia histórica usa costeo, incluso venta presupuestada cero", () => {
    expect(calcular([])).toMatchObject({ ok: true, usaCosteo: true, totalesUSD: usd });
    expect(calcular()).toMatchObject({ ok: true, usaCosteo: true, totalesUSD: usd });
    expect(resumirUtilidadCotizacion({ ...usd, totalVenta: 0, profit: -50, porcentaje: 0 }, vacio, []))
      .toMatchObject({ ok: true, totalesUSD: { totalVenta: 0, profit: -50 } });
  });

  it.each([
    { cantidad: Number.NaN }, { cantidad: 0 }, { cantidad: -1 }, { precio_unitario: Number.POSITIVE_INFINITY },
    { precio_unitario: -1 }, { descripcion: "" }, { moneda: "EUR" },
  ])("no fabrica utilidad con una venta incompleta %j", over => {
    expect(calcular([venta(over)])).toMatchObject({ ok: false, mensaje: expect.stringContaining("incompletos") });
  });

  it("no cae al costeo si el parser descartó todas o algunas ventas", () => {
    for (const ventas of [[], [venta()]]) expect(resumirUtilidadCotizacion(usd, vacio, ventas, { conceptosDescartados: 1 }))
      .toMatchObject({ ok: false, mensaje: expect.stringContaining("incompletos") });
  });

  it("una nueva captura vacía no equivale a ausencia histórica", () => {
    const placeholder = venta({ descripcion: "", precio_unitario: 0, total: 0 });
    expect(calcular([placeholder])).toMatchObject({ ok: false });
    expect(calcular([placeholder, venta()])).toMatchObject({ ok: true, totalesUSD: { totalVenta: 150 } });
  });

  it("sin ningún costo no informa 100% de margen, pero costo registrado cero es válido", () => {
    expect(resumirUtilidadCotizacion(vacio, vacio, [venta()], { sinCostosRegistrados: true }))
      .toMatchObject({ ok: false, mensaje: expect.stringContaining("desglose de costos") });
    expect(resumirUtilidadCotizacion(vacio, vacio, [venta()])).toMatchObject({ ok: true, totalesUSD: { profit: 150, porcentaje: 100 } });
  });

  it("no modifica ni vincula costos o conceptos al calcular", () => {
    const ventas = [venta({ origen_costo_id: "c1" }), venta({ moneda: "MXN" })];
    const antes = JSON.stringify({ usd, vacio, ventas });
    calcular(ventas);
    expect(JSON.stringify({ usd, vacio, ventas })).toBe(antes);
  });
});
