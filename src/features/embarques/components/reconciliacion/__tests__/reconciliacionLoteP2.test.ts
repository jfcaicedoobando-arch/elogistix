import { describe, it, expect } from "vitest";
import { createTable, getCoreRowModel, getSortedRowModel } from "@tanstack/react-table";
import {
  construirFilaReconciliacion,
  construirResumen,
  type FilaReconciliacion3C,
} from "@/lib/domain/versionadoCotizacion";
import { filtrarSoloVarianza, clavePctOrden } from "../reconciliacionVista";
import { generarCsvReconciliacion3C } from "@/features/embarques/services/reconciliacion3Columnas.csv";

const fila = (concepto: string, moneda: string, cot: number, real: number, extra = {}) =>
  construirFilaReconciliacion({ concepto, moneda, cotizado: cot, refrescado: cot, real, ...extra });

describe("Resumen 3C sin TC del embarque", () => {
  it("USD 100/150 sin TC → pendiente, nunca dentro_rango", () => {
    const r = construirResumen([fila("Flete Manzanillo", "USD", 100, 150)]);
    expect(r.filas_sin_tipo_cambio).toBe(1);
    expect(r.clasificacion).toBe("pendiente");
  });
  it("mix USD sin TC + MXN comparable → delta sólo del MXN", () => {
    const r = construirResumen([fila("Flete", "USD", 100, 150), fila("Maniobras Monterrey", "MXN", 1000, 1100)]);
    expect(r.filas_sin_tipo_cambio).toBe(1);
    expect(r.total_real).toBe(1100);
    expect(r.delta_cot_vs_real.pct).toBeCloseTo(10);
    expect(r.clasificacion).not.toBe("pendiente");
  });
  it("MXN 0/0 sí es comparable", () => {
    const r = construirResumen([fila("Seguro", "MXN", 0, 0)]);
    expect(r.clasificacion).toBe("dentro_rango");
  });
});

const cuatro: FilaReconciliacion3C[] = [
  { ...fila("A", "MXN", 100, 100), clasificacion: "dentro_rango" },
  { ...fila("B", "MXN", 100, 110), clasificacion: "alerta" },
  { ...fila("C", "MXN", 100, 200), clasificacion: "critica" },
  fila("D", "MXN", 100, 0, { sin_factura: true }),
];

describe("Filtro 'Sólo con varianza'", () => {
  it("sólo alerta y crítica", () => {
    expect(filtrarSoloVarianza(cuatro).map((f) => f.concepto)).toEqual(["B", "C"]);
  });
  it("CSV exporta el conjunto visible", () => {
    const csv = generarCsvReconciliacion3C(filtrarSoloVarianza(cuatro));
    expect(csv).toContain("B");
    expect(csv).not.toMatch(/\nD,/);
    expect(csv.trim().split("\n")).toHaveLength(3);
  });
});

describe("Orden de Δ", () => {
  it("pendiente al final sin -100%", () => {
    const data = [fila("Pend", "MXN", 100, 0, { sin_factura: true }), fila("Alto", "MXN", 100, 150), fila("Bajo", "MXN", 100, 90)];
    expect(clavePctOrden(data[0], data[0].delta_cot_vs_real.pct)).toBeUndefined();
    const table = createTable<FilaReconciliacion3C>({
      data,
      columns: [{ id: "d", accessorFn: (f) => clavePctOrden(f, f.delta_cot_vs_real.pct), sortUndefined: "last" }],
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      state: { sorting: [{ id: "d", desc: false }], columnPinning: {}, columnVisibility: {} },
      onStateChange: () => {},
      renderFallbackValue: null,
    });
    expect(table.getSortedRowModel().rows.map((r) => r.original.concepto)).toEqual(["Bajo", "Alto", "Pend"]);
  });
});

describe("CSV Δ Refr vs Real", () => {
  it("cabecera y valores, vacío en pendientes, escaping", () => {
    const csv = generarCsvReconciliacion3C([
      construirFilaReconciliacion({ concepto: "Flete, Monterrey", moneda: "MXN", cotizado: 100, refrescado: 200, real: 250 }),
      fila("Pend", "MXN", 100, 0, { sin_factura: true }),
    ]);
    const [cab, l1, l2] = csv.trim().split("\n");
    expect(cab).toContain("Δ Cot vs Real (%),Δ Refr vs Real (%),Clasificación");
    expect(l1).toContain('"Flete, Monterrey"');
    expect(l1).toContain("150.00,25.00,");
    expect(l2).toContain(",,,Sin factura");
  });
});
