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

  it("top_acreedores acepta 'Por vencer' y 'Vencida'", () => {
    const cxp: CxpRow[] = [
      { id: "1", folio_proveedor: "F1", proveedor_nombre: "A", moneda: "MXN", saldo: 100, fecha_vencimiento: "2026-06-20", estatus: "Por vencer" },
      { id: "2", folio_proveedor: "F2", proveedor_nombre: "B", moneda: "MXN", saldo: 200, fecha_vencimiento: "2026-06-20", estatus: "Vencida" },
      { id: "3", folio_proveedor: "F3", proveedor_nombre: "C", moneda: "MXN", saldo: 999, fecha_vencimiento: "2026-06-20", estatus: "Pagada" },
    ];
    const r = calcularResumenTesoreria({ cuentas, cobranza: [], cxp, hoy: HOY });
    expect(r.top_acreedores.map((t) => t.nombre)).toEqual(["B", "A"]);
  });

  it("propaga cuentas y usa hoy=new Date() por defecto", () => {
    const r = calcularResumenTesoreria({ cuentas, cobranza: [], cxp: [] });
    expect(r.cuentas).toBe(cuentas);
    expect(r.flujo.flujo_neto_mxn).toBe(0);
  });
});
