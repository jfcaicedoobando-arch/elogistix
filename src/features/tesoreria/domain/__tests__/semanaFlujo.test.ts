/**
 * Q-15.1 · Semana ISO calculada con componentes LOCALES (no UTC) y
 * Q-15.6 · KPI "Por pagar 30d" alineado al criterio del widget de próximas.
 */
import { describe, it, expect } from "vitest";
import { isoWeekKey, calcularFlujoProyectado } from "../flujoProyectado";
import { calcularResumenTesoreria } from "../resumen";
import type { CxpRow } from "../resumen.types";
import { parseDateOnlyLocal, formatDateOnlyLocal } from "@/lib/date/dateOnly";

describe("isoWeekKey (Q-15.1)", () => {
  it("mantiene la semana del date-only local sin correrse un día", () => {
    // Lunes 03/08/2026 → W32; domingo 09/08/2026 → misma semana ISO.
    expect(isoWeekKey(parseDateOnlyLocal("2026-08-03"))).toBe("2026-W32");
    expect(isoWeekKey(parseDateOnlyLocal("2026-08-09"))).toBe("2026-W32");
    // Lunes siguiente arranca semana nueva.
    expect(isoWeekKey(parseDateOnlyLocal("2026-08-10"))).toBe("2026-W33");
  });

  it("formatDateOnlyLocal es el inverso exacto de parseDateOnlyLocal", () => {
    for (const iso of ["2026-01-01", "2026-08-09", "2026-12-31"]) {
      expect(formatDateOnlyLocal(parseDateOnlyLocal(iso))).toBe(iso);
    }
  });

  it("el inicio de cada semana del flujo es un lunes en fecha local", () => {
    const flujo = calcularFlujoProyectado({
      cuentas: [], cobranza: [], cxp: [], liquidaciones: [],
      dias: 28, hoy: parseDateOnlyLocal("2026-08-05"),
    });
    for (const s of flujo.semanas) {
      expect(parseDateOnlyLocal(s.inicio).getDay()).toBe(1);
      expect(isoWeekKey(parseDateOnlyLocal(s.inicio))).toBe(s.semana_iso);
    }
  });
});

const cxp = (over: Partial<CxpRow>): CxpRow => ({
  id: "c1", folio_proveedor: "FP-1", proveedor_nombre: "Naviera SA",
  moneda: "MXN", saldo: 1000, fecha_vencimiento: null, ...over,
});

describe("KPI Por pagar 30d (Q-15.6)", () => {
  const hoy = parseDateOnlyLocal("2026-08-05");

  it("usa la fecha programada cuando existe (aunque el vencimiento esté fuera)", () => {
    const r = calcularResumenTesoreria({
      cuentas: [], cobranza: [],
      cxp: [cxp({ fecha_vencimiento: "2026-12-01", fecha_programada_pago: "2026-08-20" })],
      hoy: new Date(hoy),
    });
    expect(r.flujo.por_pagar_mxn).toBe(1000);
  });

  it("excluye la factura cuya fecha programada cae fuera de la ventana", () => {
    const r = calcularResumenTesoreria({
      cuentas: [], cobranza: [],
      cxp: [cxp({ fecha_vencimiento: "2026-08-10", fecha_programada_pago: "2026-11-30" })],
      hoy: new Date(hoy),
    });
    expect(r.flujo.por_pagar_mxn).toBe(0);
  });

  it("sin fecha programada cae al vencimiento", () => {
    const r = calcularResumenTesoreria({
      cuentas: [], cobranza: [],
      cxp: [cxp({ fecha_vencimiento: "2026-08-10" })],
      hoy: new Date(hoy),
    });
    expect(r.flujo.por_pagar_mxn).toBe(1000);
  });
});
