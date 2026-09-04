/**
 * Conteos de las tarjetas de CxP: mismo canon de deuda que los importes,
 * ventana canónica de 7 días derivada de `fecha_vencimiento` (NO de
 * `dias_vencido`, que el mapper recorta con Math.max(0, dv)) y sin mezclar
 * monedas.
 */
import { describe, it, expect } from "vitest";
import { resumirTarjetasCxP } from "@/features/cxp/services/cxpKpiConteos";
import type { FacturaCxP } from "@/features/cxp/services/proveedorFacturas";

const HOY = "2026-03-10";

const f = (over: Partial<FacturaCxP>): FacturaCxP => ({
  id: "1", folio_interno: "FP-000001", proveedor_nombre: "Prov",
  moneda: "MXN", total: 100, saldo: 100, estatus: "Por vencer",
  // Valor recortado tal como llega de producción: nunca negativo.
  dias_vencido: 0, fecha_vencimiento: "2026-03-12",
  fecha_programada_pago: null,
  ...over,
} as FacturaCxP);

describe("resumirTarjetasCxP", () => {
  it("clasifica por fecha real: vencida, vence en 7d (incluida), 8d (fuera), sin fecha", () => {
    const r = resumirTarjetasCxP([
      f({ id: "vencida", fecha_vencimiento: "2026-03-05" }),
      f({ id: "en7d", fecha_vencimiento: "2026-03-17" }),
      f({ id: "en8d", fecha_vencimiento: "2026-03-18" }),
      f({ id: "sinFecha", fecha_vencimiento: null }),
    ], HOY);
    expect(r.vencidasN).toBe(1);
    expect(r.porVencerN).toBe(1);
    expect(r.porPagarMxn).toBe(4); // todas siguen siendo deuda por pagar
  });

  it("cuenta la vencida aunque dias_vencido llegue recortado en 0", () => {
    const r = resumirTarjetasCxP([
      f({ id: "v", estatus: "Por aprobar", dias_vencido: 0, fecha_vencimiento: "2026-03-06" }),
    ], HOY);
    expect(r.vencidasN).toBe(1);
    expect(r.porVencerN).toBe(0);
  });

  it("no cuenta como por vencer una factura futura lejana", () => {
    const r = resumirTarjetasCxP([
      f({ id: "futura", dias_vencido: 0, fecha_vencimiento: "2026-06-01" }),
    ], HOY);
    expect(r.vencidasN).toBe(0);
    expect(r.porVencerN).toBe(0);
  });

  it("excluye Rechazada, Cancelada y Borrador de los conteos", () => {
    const r = resumirTarjetasCxP([
      f({ id: "a" }),
      f({ id: "b", estatus: "Rechazada" }),
      f({ id: "c", estatus: "Cancelada" }),
      f({ id: "d", estatus: "Borrador" }),
    ], HOY);
    expect(r.porPagarMxn).toBe(1);
  });

  it("no suma EUR a MXN pero lo cuenta en programado", () => {
    const r = resumirTarjetasCxP([
      f({ id: "e", moneda: "EUR", saldo: 500, fecha_programada_pago: "2026-03-11" }),
      f({ id: "m", moneda: "MXN", saldo: 200, fecha_programada_pago: "2026-03-11" }),
      f({ id: "u", moneda: "USD", saldo: 300, fecha_programada_pago: "2026-03-11" }),
    ], HOY);
    expect(r.programadoMxn).toBe(200);
    expect(r.programadoUsd).toBe(300);
    expect(r.programadoN).toBe(3);
  });

  it("programado incluye hoy y hoy+7, excluye hoy+8", () => {
    const r = resumirTarjetasCxP([
      f({ id: "hoy", fecha_programada_pago: HOY, saldo: 10 }),
      f({ id: "mas7", fecha_programada_pago: "2026-03-17", saldo: 20 }),
      f({ id: "mas8", fecha_programada_pago: "2026-03-18", saldo: 40 }),
    ], HOY);
    expect(r.programadoN).toBe(2);
    expect(r.programadoMxn).toBe(30);
  });
});
