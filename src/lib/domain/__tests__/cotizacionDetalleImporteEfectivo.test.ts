/**
 * v13.823.346 — Regresión: filas USD legacy sin `total` y payloads corruptos.
 */
import { describe, it, expect, vi } from "vitest";
import {
  importeEfectivoConcepto,
  tieneImportesEfectivos,
  parseConceptosDetallado,
  calcularTotalesConceptos,
} from "@/lib/domain/cotizacionDetalle";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

vi.mock("@/lib/observability/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function fila(over: Partial<ConceptoVentaCotizacion> = {}): ConceptoVentaCotizacion {
  return {
    descripcion: "Flete",
    unidad_medida: "Contenedor",
    cantidad: 2,
    precio_unitario: 500,
    moneda: "USD",
    total: 1000,
    aplica_iva: false,
    ...over,
  } as ConceptoVentaCotizacion;
}

describe("importeEfectivoConcepto", () => {
  it("usa el total guardado cuando es positivo", () => {
    expect(importeEfectivoConcepto(fila())).toBe(1000);
  });

  it("reconstruye cantidad × precio con total ausente (USD legacy)", () => {
    expect(importeEfectivoConcepto(fila({ total: undefined }))).toBe(1000);
  });

  it("reconstruye con total en 0", () => {
    expect(importeEfectivoConcepto(fila({ total: 0 }))).toBe(1000);
  });

  it("suma el IVA de la fila al reconstruir", () => {
    expect(
      importeEfectivoConcepto(fila({ total: 0, aplica_iva: true, tasa_iva_aplicada: 0.16 }), 0.16),
    ).toBe(1160);
  });

  it("es 0 sin cantidad ni precio", () => {
    expect(importeEfectivoConcepto(fila({ total: 0, cantidad: 0, precio_unitario: 0 }))).toBe(0);
  });
});

describe("tieneImportesEfectivos", () => {
  it("true con fila USD legacy sin total", () => {
    expect(tieneImportesEfectivos([fila({ total: 0 })])).toBe(true);
  });

  it("false sin conceptos", () => {
    expect(tieneImportesEfectivos([])).toBe(false);
  });

  it("false con payload nulo", () => {
    expect(tieneImportesEfectivos(null)).toBe(false);
  });
});

describe("calcularTotalesConceptos — USD legacy", () => {
  it("el total USD no queda en 0 cuando falta el total guardado", () => {
    const t = calcularTotalesConceptos([fila({ total: 0 })], 0.16);
    expect(t.totalUSD).toBe(1000);
  });
});

describe("parseConceptosDetallado — payload corrupto", () => {
  it("cuenta un descarte con JSON inválido", () => {
    const r = parseConceptosDetallado("{no-json");
    expect(r.conceptos).toEqual([]);
    expect(r.descartados).toBe(1);
  });

  it("cuenta un descarte con objeto no-array", () => {
    const r = parseConceptosDetallado({ descripcion: "Flete" });
    expect(r.descartados).toBe(1);
  });

  it("no avisa con payload vacío", () => {
    expect(parseConceptosDetallado(null).descartados).toBe(0);
    expect(parseConceptosDetallado("").descartados).toBe(0);
  });
});
