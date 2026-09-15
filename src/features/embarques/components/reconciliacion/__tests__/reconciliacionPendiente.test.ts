/**
 * REC-01: una fila sin factura (Real = 0 por falta de captura) no debe mostrar
 * -100.0%, ni el resumen cuando todo está pendiente.
 */
import { describe, it, expect } from "vitest";
import { pctOPendiente, pct } from "../reconciliacionFormat";
import {
  construirFilaReconciliacion,
  construirResumen,
} from "@/lib/domain/versionadoCotizacion";

describe("pctOPendiente", () => {
  it("muestra guion cuando está pendiente", () => {
    expect(pctOPendiente(-100, true)).toBe("—");
  });
  it("muestra el porcentaje cuando sí hay factura", () => {
    expect(pctOPendiente(-100, false)).toBe(pct(-100));
    expect(pctOPendiente(12.34, false)).toBe("+12.3%");
  });
});

describe("fila y resumen pendientes", () => {
  it("fila sin factura se clasifica pendiente y su Δ se oculta", () => {
    const fila = construirFilaReconciliacion({
      concepto: "Flete", moneda: "MXN", cotizado: 1000, refrescado: 1000, real: 0,
      sin_factura: true,
    });
    expect(fila.clasificacion).toBe("pendiente");
    expect(fila.real).toBe(0);
    expect(pctOPendiente(fila.delta_cot_vs_real.pct, fila.sin_factura)).toBe("—");
  });

  it("resumen con todo pendiente oculta el porcentaje", () => {
    const filas = [
      construirFilaReconciliacion({
        concepto: "Flete", moneda: "MXN", cotizado: 1000, refrescado: 1000, real: 0, sin_factura: true,
      }),
    ];
    const r = construirResumen(filas, undefined, {});
    expect(r.clasificacion).toBe("pendiente");
    expect(r.total_real).toBe(0);
    expect(pctOPendiente(r.delta_cot_vs_real.pct, r.clasificacion === "pendiente")).toBe("—");
  });

  it("no cambia el cálculo de filas con factura", () => {
    const fila = construirFilaReconciliacion({
      concepto: "Flete", moneda: "MXN", cotizado: 1000, refrescado: 1000, real: 1200,
      sin_factura: false,
    });
    expect(fila.delta_cot_vs_real.pct).toBe(20);
    expect(pctOPendiente(fila.delta_cot_vs_real.pct, fila.sin_factura)).toBe("+20.0%");
  });
});
