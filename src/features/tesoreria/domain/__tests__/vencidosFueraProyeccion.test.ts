import { describe, it, expect } from "vitest";
import { calcularFlujoProyectado } from "../flujoProyectado";
import type { CobranzaRow, CxpRow, LiquidacionRow } from "../resumen";

const cxp = (id: string, saldo: number, moneda = "MXN", fecha: string | null = "2026-09-27"): CxpRow =>
  ({ id, saldo, moneda, fecha_vencimiento: fecha, folio_proveedor: id, proveedor_nombre: "Transporte Monterrey" });
const calcular = (rows: CxpRow[], cobranza: CobranzaRow[] = [], liquidaciones: LiquidacionRow[] = []) =>
  calcularFlujoProyectado({ cuentas: [], cxp: rows, cobranza, liquidaciones, dias: 90, hoy: new Date(2026, 8, 30) });

describe("N02 · vencidos fuera de proyección", () => {
  it("desglosa el caso auditado por moneda sin incorporarlo a totales ni mover fechas", () => {
    const rows = [cxp("v1", 5331.1), cxp("v2", 700, "USD"), cxp("futuro", 1160, "MXN", "2026-10-01")];
    const antes = structuredClone(rows);
    const r = calcular(rows);
    expect(r.total_salidas_mxn).toBe(1160);
    expect(r.vencidos_fuera_proyeccion).toEqual({
      anteriores_a: "2026-09-28", entradas: { cantidad: 0, por_moneda: {} },
      salidas: { cantidad: 2, por_moneda: { MXN: 5331.1, USD: 700 } },
    });
    expect(r.semanas.flatMap((s) => s.detalle_salidas).map((f) => f.id)).toEqual(["futuro"]);
    expect(rows).toEqual(antes);
  });
  it("respeta fecha programada, el límite de lunes y saldos pendientes", () => {
    const r = calcular([
      { ...cxp("reprogramada", 100), fecha_programada_pago: "2026-10-01" },
      cxp("lunes", 200, "MXN", "2026-09-28"), cxp("pagada", 0), cxp("sin-fecha", 300, "MXN", null),
      cxp("fuera-futuro", 400, "MXN", "2027-03-01"),
    ]);
    expect(r.total_salidas_mxn).toBe(300);
    expect(r.vencidos_fuera_proyeccion.salidas.cantidad).toBe(0);
  });
  it("separa CxC y comisiones sin exigir TC para el aviso nominal", () => {
    const r = calcular([], [{ id: "c1", numero: "F1", cliente_nombre: "Aceros del Norte", saldo: 500, moneda: "USD", fecha_vencimiento: "2026-09-26" }],
      [{ id: "l1", periodo: "2026-08", vendedora_id: "v1", total_mxn: 300, fecha_pago: null, created_at: "" }]);
    expect(r.vencidos_fuera_proyeccion.entradas).toEqual({ cantidad: 1, por_moneda: { USD: 500 } });
    expect(r.vencidos_fuera_proyeccion.salidas).toEqual({ cantidad: 1, por_moneda: { MXN: 300 } });
    expect(r.total_entradas_mxn).toBe(0);
    expect(r.total_salidas_mxn).toBe(0);
  });
});
