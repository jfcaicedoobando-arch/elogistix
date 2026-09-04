/**
 * Conteos de las tarjetas de CxP: mismo canon de deuda que los importes,
 * ventana canónica de 7 días y sin mezclar monedas.
 */
import { describe, it, expect } from "vitest";
import { resumirTarjetasCxP } from "@/features/cxp/services/cxpKpiConteos";
import type { FacturaCxP } from "@/features/cxp/services/proveedorFacturas";

const HOY = "2026-03-10";

const f = (over: Partial<FacturaCxP>): FacturaCxP => ({
  id: "1", folio_interno: "FP-000001", proveedor_nombre: "Prov",
  moneda: "MXN", total: 100, saldo: 100, estatus: "Por vencer",
  dias_vencido: 0, fecha_vencimiento: "2026-03-12",
  fecha_programada_pago: null,
  ...over,
} as FacturaCxP);

describe("resumirTarjetasCxP", () => {
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

  it("usa la ventana canónica de 7 días y el rango hoy..hoy+7 inclusive", () => {
    const r = resumirTarjetasCxP([
      f({ id: "d6", dias_vencido: -6, fecha_vencimiento: "2026-03-16" }),
      f({ id: "d9", dias_vencido: -9, fecha_vencimiento: "2026-03-19" }),
      f({ id: "p7", fecha_programada_pago: "2026-03-17", saldo: 50, dias_vencido: -30, fecha_vencimiento: "2026-04-09" }),
      f({ id: "p8", fecha_programada_pago: "2026-03-18", saldo: 70, dias_vencido: -30, fecha_vencimiento: "2026-04-09" }),
    ], HOY);
    expect(r.porVencerN).toBe(1);
    expect(r.programadoMxn).toBe(50);
  });

  it("cuenta vencidas por días reales, no por estatus", () => {
    const r = resumirTarjetasCxP([
      f({ id: "v", estatus: "Por aprobar", dias_vencido: 4 }),
    ], HOY);
    expect(r.vencidasN).toBe(1);
    expect(r.porVencerN).toBe(0);
  });
});
