/**
 * Regresión P1-1 (/compras/conciliacion): vínculos sin TC nunca generan
 * ahorro en fila, KPI ni footer. Datos ficticios: forwarder de Monterrey.
 */
import { describe, expect, it } from "vitest";
import {
  buildFilasReconciliacion, calcularResumen, calcularResumenPorMoneda,
} from "@/features/embarques/services/reconciliacionCostos.helpers";
import type { CCRow, PFCRow } from "@/features/embarques/services/reconciliacionCostos.tipos";

const cc = (id: string, moneda: string, monto: number): CCRow => ({
  id, concepto: `Concepto ${id}`, proveedor_nombre: "Logística Regia SA de CV", moneda, monto, estado_liquidacion: "Pendiente",
});
const v = (id: string, conc: string, monto: number, moneda: string, tc: number | null): PFCRow => ({
  monto, concepto_costo_id: conc, descripcion: "Maniobras Monterrey",
  proveedor_facturas: { id, folio_proveedor: `MTY-${id}`, estado: "Vigente", moneda, tipo_cambio_usd: tc, deleted_at: null },
});

describe("conciliación sin TC", () => {
  it("100 USD + 872.61 MXN sin TC: sin ahorro en fila, KPI ni footer; factura visible en MXN", () => {
    const filas = buildFilasReconciliacion([cc("a", "USD", 100)], [v("f1", "a", 872.61, "MXN", null)]);
    const [f] = filas;
    expect(f.estatus_renglon).toBe("no_comparable");
    expect(f.diferencia).toBe(0);
    expect(f.desviacion_pct).toBe(0);
    expect(f.facturas[0]).toMatchObject({ excluida: true, monto_original: 872.61, moneda: "MXN" });
    expect(f.facturas[0].motivo_exclusion).toMatch(/sin tipo de cambio/);
    const r = calcularResumen(filas);
    expect(r).toMatchObject({ total_cotizado: 100, diferencia_total: null, desviacion_pct_total: null, pendientes_tc: 1 });
    const [t] = calcularResumenPorMoneda(filas);
    expect(t).toMatchObject({ moneda: "USD", cotizado: 100, diferencia: null, desviacion_pct: null, pendientes_tc: 1 });
  });

  it("con TC fiable reaparece la comparación", () => {
    const filas = buildFilasReconciliacion([cc("a", "USD", 100)], [v("f1", "a", 1745.2, "MXN", 17.452)]);
    expect(filas[0].estatus_renglon).toBe("conciliado");
    const [t] = calcularResumenPorMoneda(filas);
    expect(t.diferencia).toBeCloseTo(0, 6);
    expect(t.pendientes_tc).toBe(0);
  });

  it("mixto: la variación sólo usa la fila comparable", () => {
    const filas = buildFilasReconciliacion(
      [cc("a", "USD", 100), cc("b", "USD", 200)],
      [v("f1", "a", 872.61, "MXN", null), v("f2", "b", 220, "USD", null)],
    );
    const [t] = calcularResumenPorMoneda(filas);
    expect(t.cotizado).toBe(300);
    expect(t.diferencia).toBe(20);
    expect(t.desviacion_pct).toBeCloseTo(10, 6);
    expect(t.pendientes_tc).toBe(1);
  });

  it("presupuesto MXN + USD no se suma en un solo total", () => {
    const filas = buildFilasReconciliacion(
      [cc("a", "USD", 100), cc("b", "MXN", 5000)],
      [v("f1", "b", 5000, "MXN", null)],
    );
    const t = calcularResumenPorMoneda(filas).sort((x, y) => x.moneda.localeCompare(y.moneda));
    expect(t.map((x) => [x.moneda, x.cotizado])).toEqual([["MXN", 5000], ["USD", 100]]);
  });
});
