import { describe, expect, it } from "vitest";
import { calcularTotalesConceptos } from "../totalesConceptos";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";

const base = { descripcion: "x", clave_sat: "78101800" };

describe("calcularTotalesConceptos", () => {
  it("suma IVA 16% correctamente", () => {
    const conceptos: ConceptoManualInput[] = [
      { ...base, cantidad: 2, precio_unitario: 100, tipo_iva: "gravado_16" },
    ];
    expect(calcularTotalesConceptos(conceptos, 0.16)).toEqual({
      subtotal: 200,
      iva: 32,
      total: 232,
    });
  });

  it("tasa 0% no aporta IVA", () => {
    const conceptos: ConceptoManualInput[] = [
      { ...base, cantidad: 1, precio_unitario: 500, tipo_iva: "tasa_0" },
    ];
    expect(calcularTotalesConceptos(conceptos, 0.16)).toEqual({
      subtotal: 500,
      iva: 0,
      total: 500,
    });
  });

  it("exento y gravado conviven en el mismo total", () => {
    const conceptos: ConceptoManualInput[] = [
      { ...base, cantidad: 1, precio_unitario: 1000, tipo_iva: "exento" },
      { ...base, cantidad: 1, precio_unitario: 1000, tipo_iva: "gravado_16" },
    ];
    expect(calcularTotalesConceptos(conceptos, 0.16)).toEqual({
      subtotal: 2000,
      iva: 160,
      total: 2160,
    });
  });
});
