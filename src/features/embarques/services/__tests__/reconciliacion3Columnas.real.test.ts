/**
 * v13.823.370 (P1-2) — La columna "Real" de la conciliación a 3 columnas debe
 * venir del monto realmente facturado por el proveedor, no del presupuesto
 * clonado al convertir la cotización.
 */
import { describe, it, expect } from "vitest";
import {
  agruparRealesFacturados,
  buildFilas3C,
} from "../reconciliacion3Columnas.helpers";
import { buildFilasReconciliacion } from "../reconciliacionCostos.helpers";
import type { CostoVersionado } from "@/features/cotizacion/services/versionado";

const cotizado = (concepto: string, monto: number, moneda = "MXN"): CostoVersionado =>
  ({ concepto, moneda, costo_total: monto } as unknown as CostoVersionado);

const conceptoCosto = (id: string, concepto: string, monto: number) => ({
  id,
  concepto,
  proveedor_nombre: "Naviera X",
  moneda: "MXN",
  monto,
  estado_liquidacion: "pendiente",
});

const pfc = (conceptoId: string, monto: number, estado: string) => ({
  monto,
  concepto_costo_id: conceptoId,
  descripcion: null,
  proveedor_facturas: {
    id: "f1",
    folio_interno: "FP-000001",
    folio_proveedor: "A-1",
    fecha_emision: "2026-01-10",
    fecha_vencimiento: "2026-02-10",
    estado,
    moneda: "MXN", deleted_at: null,
  },
});

describe("agruparRealesFacturados", () => {
  it("sin factura: real 0 y marcado como sin factura", () => {
    const filas = buildFilasReconciliacion([conceptoCosto("c1", "Flete", 4500)], []);
    const reales = agruparRealesFacturados(filas);
    expect(reales).toEqual([
      { concepto: "Flete", moneda: "MXN", monto: 0, tiene_factura: false, pendiente_tc: false },
    ]);
  });

  it("factura ligada: real = monto facturado", () => {
    const filas = buildFilasReconciliacion(
      [conceptoCosto("c1", "Flete", 4500)],
      [pfc("c1", 4700, "Vigente")],
    );
    expect(agruparRealesFacturados(filas)).toEqual([
      { concepto: "Flete", moneda: "MXN", monto: 4700, tiene_factura: true, pendiente_tc: false },
    ]);
  });

  it("factura cancelada: vuelve a contar como sin factura", () => {
    const filas = buildFilasReconciliacion(
      [conceptoCosto("c1", "Flete", 4500)],
      [pfc("c1", 4700, "Cancelada")],
    );
    expect(agruparRealesFacturados(filas)).toEqual([
      { concepto: "Flete", moneda: "MXN", monto: 0, tiene_factura: false, pendiente_tc: false },
    ]);
  });

  it("suma los conceptos que comparten concepto y moneda", () => {
    const filas = buildFilasReconciliacion(
      [conceptoCosto("c1", "Maniobras", 1000), conceptoCosto("c2", "Maniobras", 500)],
      [pfc("c1", 1000, "Vigente")],
    );
    expect(agruparRealesFacturados(filas)).toEqual([
      { concepto: "Maniobras", moneda: "MXN", monto: 1000, tiene_factura: true, pendiente_tc: false },
    ]);
  });
});

describe("buildFilas3C · clasificación pendiente", () => {
  it("sin factura NO se clasifica 'Dentro del rango'", () => {
    const filas = buildFilas3C(
      [cotizado("Flete", 4500)],
      [],
      agruparRealesFacturados(buildFilasReconciliacion([conceptoCosto("c1", "Flete", 4500)], [])),
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].real).toBe(0);
    expect(filas[0].sin_factura).toBe(true);
    expect(filas[0].clasificacion).toBe("pendiente");
  });

  it("con factura dentro de tolerancia sí queda 'dentro_rango'", () => {
    const reales = agruparRealesFacturados(
      buildFilasReconciliacion([conceptoCosto("c1", "Flete", 4500)], [pfc("c1", 4500, "Vigente")]),
    );
    const filas = buildFilas3C([cotizado("Flete", 4500)], [], reales);
    expect(filas[0].real).toBe(4500);
    expect(filas[0].sin_factura).toBe(false);
    expect(filas[0].clasificacion).toBe("dentro_rango");
  });

  it("un cotizado sin ningún renglón real queda pendiente (fail-closed)", () => {
    const filas = buildFilas3C([cotizado("Custodia", 800)], [], []);
    expect(filas[0].clasificacion).toBe("pendiente");
    expect(filas[0].real).toBe(0);
  });
});
