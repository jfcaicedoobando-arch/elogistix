import { describe, it, expect } from "vitest";
import {
  buildFilasReconciliacion,
  calcularResumen,
  calcularResumenPorMoneda,
} from "@/features/embarques/services/reconciliacionCostos.helpers";
import type { CCRow, PFCRow } from "@/features/embarques/services/reconciliacionCostos.tipos";
import {
  agruparRealesFacturados,
  buildFilas3C,
  generarCsvReconciliacion3C,
} from "@/features/embarques/services/reconciliacion3Columnas.helpers";
import { construirResumen } from "@/lib/domain/versionadoCotizacion";

// Datos ficticios: forwarder de Monterrey, embarque de importación.
const cc = (id: string, concepto: string, moneda: string, monto: number): CCRow => ({
  id, concepto, proveedor_nombre: "Transportes Regios SA", moneda, monto, estado_liquidacion: "pendiente",
});
const vinc = (ccId: string, monto: number, moneda: string, tc: number | null): PFCRow => ({
  monto, concepto_costo_id: ccId,
  proveedor_facturas: {
    id: `pf-${ccId}-${monto}`, folio_proveedor: `A-${monto}`, estado: "pendiente",
    moneda, tipo_cambio_usd: tc, deleted_at: null,
  },
});
const cot = (concepto: string, moneda: string, total: number) => ({
  id: concepto + moneda, cotizacion_id: "c1", version: 1, concepto, proveedor: "X",
  moneda, cantidad: 1, costo_unitario: total, costo_total: total, precio_venta: total, precio_total: total,
});

describe("P1-A · CxP: sin factura nunca es ahorro", () => {
  const conceptos = [cc("a", "Flete", "USD", 2745), cc("b", "Maniobras", "MXN", 5800)];

  it("sin facturas: variación N/D por moneda, presupuesto visible", () => {
    const filas = buildFilasReconciliacion(conceptos, []);
    expect(filas.every((f) => f.diferencia === 0 && f.desviacion_pct === 0)).toBe(true);
    const tot = calcularResumenPorMoneda(filas);
    for (const t of tot) {
      expect(t.diferencia).toBeNull();
      expect(t.desviacion_pct).toBeNull();
      expect(t.sin_factura).toBe(1);
    }
    expect(tot.find((t) => t.moneda === "USD")!.cotizado).toBe(2745);
    const r = calcularResumen(filas);
    expect(r.diferencia_total).toBeNull();
    expect(r.conceptos_sin_factura).toBe(2);
  });

  it("mixto: delta sólo de la comparable, sin factura fuera de numerador y base", () => {
    const cs = [cc("a", "Flete", "USD", 1000), cc("c", "THC", "USD", 500)];
    const tot = calcularResumenPorMoneda(buildFilasReconciliacion(cs, [vinc("a", 1100, "USD", null)]));
    expect(tot[0].cotizado).toBe(1500);
    expect(tot[0].diferencia).toBe(100);
    expect(tot[0].desviacion_pct).toBeCloseTo(10);
    expect(tot[0].sin_factura).toBe(1);
  });
});

describe("P1-B · 3 columnas: vínculo sin TC es pendiente, no real 0", () => {
  const conceptos = [cc("a", "Flete", "USD", 100)];

  it("USD 100 + factura MXN 872.61 sin TC → pendiente de TC, delta fuera", () => {
    const reales = agruparRealesFacturados(buildFilasReconciliacion(conceptos, [vinc("a", 872.61, "MXN", null)]));
    expect(reales[0].tiene_factura).toBe(false);
    expect(reales[0].pendiente_tc).toBe(true);
    const filas = buildFilas3C([cot("Flete", "USD", 100)], [], reales);
    expect(filas[0].pendiente_tc).toBe(true);
    expect(filas[0].clasificacion).toBe("pendiente");
    const res = construirResumen(filas, undefined, { usd: 18 });
    expect(res.clasificacion).toBe("pendiente");
    expect(res.filas_pendientes).toBe(1);
  });

  it("con TC válido vuelve a comparación normal", () => {
    const reales = agruparRealesFacturados(buildFilasReconciliacion(conceptos, [vinc("a", 872.61, "MXN", 17.4522)]));
    expect(reales[0].tiene_factura).toBe(true);
    expect(reales[0].pendiente_tc).toBe(false);
    const filas = buildFilas3C([cot("Flete", "USD", 100)], [], reales);
    expect(filas[0].pendiente_tc).toBe(false);
    expect(filas[0].real).toBeCloseTo(50, 1);
    expect(filas[0].clasificacion).not.toBe("pendiente");
  });

  it("mixto válido + excluido → pendiente de TC con real parcial", () => {
    const reales = agruparRealesFacturados(buildFilasReconciliacion(conceptos, [
      vinc("a", 60, "USD", null), vinc("a", 872.61, "MXN", null),
    ]));
    expect(reales[0].pendiente_tc).toBe(true);
    const filas = buildFilas3C([cot("Flete", "USD", 100)], [], reales);
    expect(filas[0].real).toBe(60);
    expect(filas[0].clasificacion).toBe("pendiente");
  });
});

describe("P1-C · CSV coincide con la pantalla", () => {
  it("sin factura y pendiente TC: % vacío + motivo; comparable: % numérico", () => {
    const filas = buildFilas3C(
      [cot("Flete", "USD", 100), cot("THC", "USD", 200), cot("Maniobras, patio", "MXN", 1000)],
      [],
      [
        { concepto: "THC", moneda: "USD", monto: 220, tiene_factura: true },
        { concepto: "Maniobras, patio", moneda: "MXN", monto: 0, tiene_factura: false, pendiente_tc: true },
      ],
    );
    const csv = generarCsvReconciliacion3C(filas);
    expect(csv).not.toContain("-100.00");
    expect(csv).toContain("Flete,USD,100,100,0,,,Sin factura");
    expect(csv).toContain("THC,USD,200,200,220,10.00,");
    expect(csv).toContain('"Maniobras, patio",MXN,1000,1000,0,,,Pendiente de tipo de cambio');
  });
});
