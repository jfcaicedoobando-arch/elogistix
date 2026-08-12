import { describe, expect, it } from "vitest";
import { calcularTotalMxn } from "@/features/facturacion/utils/calcularTotalMxn";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";

function concepto(over: Partial<ConceptoManualInput>): ConceptoManualInput {
  return {
    descripcion: "Servicio",
    cantidad: 1,
    precio_unitario: 100,
    tipo_iva: "gravado_16",
    ...over,
  } as ConceptoManualInput;
}

describe("calcularTotalMxn (FE-12)", () => {
  it("redondea por línea antes de acumular (precios con 3 decimales)", () => {
    const res = calcularTotalMxn(
      [concepto({ cantidad: 3, precio_unitario: 19.995 })],
      "MXN",
      1,
      0.16,
    );
    // 3 × 19.995 = 59.99 (redondeado) + IVA 9.60 = 69.59
    expect(res.mxn).toBeCloseTo(69.59, 2);
    expect(res.tcFaltante).toBe(false);
  });

  it("sólo calcula IVA sobre los conceptos gravados", () => {
    const res = calcularTotalMxn(
      [
        concepto({ cantidad: 1, precio_unitario: 100 }),
        concepto({ cantidad: 1, precio_unitario: 100, tipo_iva: "exento" }),
      ],
      "MXN",
      1,
      0.16,
    );
    expect(res.mxn).toBeCloseTo(216, 2);
  });

  it("marca tcFaltante cuando la moneda extranjera no tiene tipo de cambio", () => {
    const res = calcularTotalMxn([concepto({})], "USD", 0, 0.16);
    expect(res.tcFaltante).toBe(true);
    expect(res.mxn).toBe(0);
  });
});
