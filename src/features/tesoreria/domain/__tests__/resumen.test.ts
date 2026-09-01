import { describe, it, expect } from "vitest";
import {
  calcularResumenTesoreria,
  type CobranzaRow,
  type CxpRow,
  type ResumenCuenta,
} from "../resumen";

const HOY = new Date("2026-06-15T00:00:00");

const cuentas: ResumenCuenta[] = [
  { id: "c1", alias: "BBVA", banco: "BBVA", moneda: "MXN", saldo: 100_000 },
];

describe("calcularResumenTesoreria", () => {
  it("suma cobranza/cxp dentro de ventana de 30 días por moneda", () => {
    const cobranza: CobranzaRow[] = [
      { id: "f1", numero: "F-1", cliente_nombre: "A", moneda: "MXN", saldo: 1000, fecha_vencimiento: "2026-06-20" },
      { id: "f2", numero: "F-2", cliente_nombre: "B", moneda: "USD", saldo: 200, fecha_vencimiento: "2026-07-10" },
      { id: "f3", numero: "F-3", cliente_nombre: "C", moneda: "MXN", saldo: 500, fecha_vencimiento: "2026-08-01" }, // fuera de ventana
    ];
    const cxp: CxpRow[] = [
      { id: "x1", folio_proveedor: "P-1", proveedor_nombre: "P", moneda: "MXN", saldo: 300, fecha_vencimiento: "2026-06-25" },
      { id: "x2", folio_proveedor: "P-2", proveedor_nombre: "Q", moneda: "USD", saldo: 50, fecha_vencimiento: "2026-07-05" },
    ];
    const r = calcularResumenTesoreria({ cuentas, cobranza, cxp, hoy: HOY });
    expect(r.flujo.por_cobrar_mxn).toBe(1000);
    expect(r.flujo.por_cobrar_usd).toBe(200);
    expect(r.flujo.por_pagar_mxn).toBe(300);
    expect(r.flujo.por_pagar_usd).toBe(50);
    expect(r.flujo.flujo_neto_mxn).toBe(700);
    expect(r.flujo.flujo_neto_usd).toBe(150);
  });

  it("ignora saldos <=0 y fechas nulas", () => {
    const cobranza: CobranzaRow[] = [
      { id: "f1", numero: "F-1", cliente_nombre: "A", moneda: "MXN", saldo: 0, fecha_vencimiento: "2026-06-20" },
      { id: "f2", numero: "F-2", cliente_nombre: "B", moneda: "MXN", saldo: 100, fecha_vencimiento: null },
    ];
    const r = calcularResumenTesoreria({ cuentas, cobranza, cxp: [], hoy: HOY });
    expect(r.flujo.por_cobrar_mxn).toBe(0);
  });

  it("top_deudores solo incluye estatus 'Vencida', ordenados desc y top 5", () => {
    const cobranza: CobranzaRow[] = Array.from({ length: 7 }, (_, i) => ({
      id: `f${i}`,
      numero: `F-${i}`,
      cliente_nombre: `Cliente ${i}`,
      moneda: "MXN",
      saldo: (i + 1) * 100,
      fecha_vencimiento: "2026-05-01",
      estatus_cobranza: "Vencida",
      dias_vencido: i + 1,
    }));
    // uno no vencido (debe filtrarse)
    cobranza.push({ id: "fx", numero: "FX", cliente_nombre: "X", moneda: "MXN", saldo: 9999, fecha_vencimiento: "2026-05-01", estatus_cobranza: "Pendiente" });
    const r = calcularResumenTesoreria({ cuentas, cobranza, cxp: [], hoy: HOY });
    expect(r.top_deudores).toHaveLength(5);
    expect(r.top_deudores[0].saldo).toBe(700);
    expect(r.top_deudores.every((d) => d.nombre !== "X")).toBe(true);
  });

  it("top_acreedores sólo incluye 'Vencida' (v13.300.49 · alineado a deudores)", () => {
    const cxp: CxpRow[] = [
      { id: "1", folio_proveedor: "F1", proveedor_nombre: "A", moneda: "MXN", saldo: 100, fecha_vencimiento: "2026-06-20", estatus: "Por vencer" },
      { id: "2", folio_proveedor: "F2", proveedor_nombre: "B", moneda: "MXN", saldo: 200, fecha_vencimiento: "2026-06-20", estatus: "Vencida" },
      { id: "3", folio_proveedor: "F3", proveedor_nombre: "C", moneda: "MXN", saldo: 999, fecha_vencimiento: "2026-06-20", estatus: "Pagada" },
    ];
    const r = calcularResumenTesoreria({ cuentas, cobranza: [], cxp, hoy: HOY });
    expect(r.top_acreedores.map((t) => t.nombre)).toEqual(["B"]);
    expect(r.cxp_vencidas_count).toBe(1);
    expect(r.cxp_vencidas_total_mxn).toBe(200);
  });

  it("saldo_bancos_mxn convierte USD→MXN con TC (v13.300.49)", () => {
    const mix: ResumenCuenta[] = [
      { id: "c1", alias: "MXN", banco: "BBVA", moneda: "MXN", saldo: 100_000 },
      { id: "c2", alias: "USD", banco: "BBVA", moneda: "USD", saldo: 10_000 },
    ];
    const r = calcularResumenTesoreria({
      cuentas: mix, cobranza: [], cxp: [], hoy: HOY, tipoCambioUsd: 20,
    });
    expect(r.saldo_bancos_mxn).toBe(300_000);
  });

  it("cartera_vencida_total_mxn agrega TODO (no sólo Top-5)", () => {
    const cobranza: CobranzaRow[] = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`, numero: `F-${i}`, cliente_nombre: `Cliente ${i}`,
      moneda: "MXN", saldo: 1_000, fecha_vencimiento: "2026-05-01",
      estatus_cobranza: "Vencida", dias_vencido: 30,
    }));
    const r = calcularResumenTesoreria({ cuentas, cobranza, cxp: [], hoy: HOY });
    expect(r.cartera_vencida_count).toBe(10);
    expect(r.cartera_vencida_total_mxn).toBe(10_000);
    expect(r.top_deudores).toHaveLength(5);
  });

  it("propaga cuentas y usa hoy=new Date() por defecto", () => {
    const r = calcularResumenTesoreria({ cuentas, cobranza: [], cxp: [] });
    expect(r.cuentas).toBe(cuentas);
    expect(r.flujo.flujo_neto_mxn).toBe(0);
  });

  it("agrupa top_deudores por cliente+moneda (fix bug de duplicados)", () => {
    // Mismo cliente, 3 facturas vencidas en MXN → una sola fila con suma
    const cobranza: CobranzaRow[] = [
      { id: "a1", numero: "A-1", cliente_nombre: "Acme", moneda: "MXN", saldo: 100, fecha_vencimiento: "2026-05-01", estatus_cobranza: "Vencida", dias_vencido: 5 },
      { id: "a2", numero: "A-2", cliente_nombre: "Acme", moneda: "MXN", saldo: 200, fecha_vencimiento: "2026-05-01", estatus_cobranza: "Vencida", dias_vencido: 30 },
      { id: "a3", numero: "A-3", cliente_nombre: "Acme", moneda: "MXN", saldo: 400, fecha_vencimiento: "2026-05-01", estatus_cobranza: "Vencida", dias_vencido: 10 },
      // Mismo cliente pero USD → fila separada
      { id: "a4", numero: "A-4", cliente_nombre: "Acme", moneda: "USD", saldo: 50, fecha_vencimiento: "2026-05-01", estatus_cobranza: "Vencida", dias_vencido: 3 },
      { id: "b1", numero: "B-1", cliente_nombre: "Beta", moneda: "MXN", saldo: 50, fecha_vencimiento: "2026-05-01", estatus_cobranza: "Vencida", dias_vencido: 2 },
    ];
    const r = calcularResumenTesoreria({ cuentas, cobranza, cxp: [], hoy: HOY });
    const nombres = r.top_deudores.map((d) => `${d.nombre}/${d.moneda}`);
    // Acme aparece 2 veces (una por moneda), NO 3 por cada factura
    expect(nombres).toEqual(["Acme/MXN", "Acme/USD", "Beta/MXN"]);
    const acmeMxn = r.top_deudores.find((d) => d.nombre === "Acme" && d.moneda === "MXN")!;
    expect(acmeMxn.saldo).toBe(700);
    expect(acmeMxn.dias).toBe(30); // peor caso del grupo
  });
});


describe("calcularResumenTesoreria — Q-06 sin TC confiable", () => {
  const HOY2 = new Date("2026-06-15T00:00:00");
  it("marca saldo_bancos_incompleto y expone desglose por moneda", () => {
    const mix: ResumenCuenta[] = [
      { id: "c1", alias: "MXN", banco: "BBVA", moneda: "MXN", saldo: 100_000 },
      { id: "c2", alias: "USD", banco: "BBVA", moneda: "USD", saldo: 5_000 },
    ];
    const r = calcularResumenTesoreria({ cuentas: mix, cobranza: [], cxp: [], hoy: HOY2 });
    expect(r.saldo_bancos_mxn).toBe(100_000);
    expect(r.saldo_bancos_incompleto).toBe(true);
    expect(r.saldos_por_moneda.USD).toBe(5_000);
    expect(r.tipo_cambio_usd ?? null).toBe(null);
  });

  it("con TC propaga tipo_cambio_usd y tipo_cambio_fecha", () => {
    const r = calcularResumenTesoreria({
      cuentas: [{ id: "c1", alias: "MXN", banco: "BBVA", moneda: "MXN", saldo: 1 }],
      cobranza: [], cxp: [], hoy: HOY2, tipoCambioUsd: 20, tipoCambioFecha: "2026-06-14",
    });
    expect(r.tipo_cambio_usd).toBe(20);
    expect(r.tipo_cambio_fecha).toBe("2026-06-14");
  });
});

describe("calcularResumenTesoreria — P1-7 EUR", () => {
  const HOY3 = new Date("2026-06-15T00:00:00");

  it("MXN+USD+EUR con TC completo: suma correcta y no marca incompleto", () => {
    const mix: ResumenCuenta[] = [
      { id: "c1", alias: "MXN", banco: "BBVA", moneda: "MXN", saldo: 100_000 },
      { id: "c2", alias: "USD", banco: "BBVA", moneda: "USD", saldo: 1_000 },
      { id: "c3", alias: "EUR", banco: "BBVA", moneda: "EUR", saldo: 500 },
    ];
    const r = calcularResumenTesoreria({
      cuentas: mix, cobranza: [], cxp: [], hoy: HOY3,
      tipoCambioUsd: 20, tipoCambioEur: 22,
    });
    expect(r.saldo_bancos_mxn).toBe(100_000 + 1_000 * 20 + 500 * 22);
    expect(r.saldo_bancos_incompleto).toBe(false);
    expect(r.saldos_por_moneda.EUR).toBe(500);
    expect(r.tipo_cambio_eur).toBe(22);
  });

  it("EUR sin TC: marca incompleto y no suma mal el EUR", () => {
    const mix: ResumenCuenta[] = [
      { id: "c1", alias: "MXN", banco: "BBVA", moneda: "MXN", saldo: 100_000 },
      { id: "c2", alias: "EUR", banco: "BBVA", moneda: "EUR", saldo: 500 },
    ];
    const r = calcularResumenTesoreria({
      cuentas: mix, cobranza: [], cxp: [], hoy: HOY3, tipoCambioUsd: 20,
    });
    expect(r.saldo_bancos_mxn).toBe(100_000);
    expect(r.saldo_bancos_incompleto).toBe(true);
    expect(r.saldos_por_moneda.EUR).toBe(500);
    expect(r.tipo_cambio_eur ?? null).toBe(null);
  });
});
