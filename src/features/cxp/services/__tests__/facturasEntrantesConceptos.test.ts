/** Normalización de los conceptos sugeridos que viajan con el documento. */
import { describe, expect, it } from "vitest";
import { mapearConceptosSugeridos } from "@/features/cxp/services/facturasEntrantesConceptos";

describe("mapearConceptosSugeridos", () => {
  it("devuelve vacío cuando no hay relación", () => {
    expect(mapearConceptosSugeridos(null)).toEqual([]);
    expect(mapearConceptosSugeridos(undefined)).toEqual([]);
  });

  it("usa valores por defecto cuando falta el concepto embebido", () => {
    expect(
      mapearConceptosSugeridos([
        { concepto_costo_id: "c1", monto_sugerido: null, conceptos_costo: null },
      ]),
    ).toEqual([
      { conceptoCostoId: "c1", concepto: "Concepto de costo", monto: 0, moneda: "MXN" },
    ]);
  });

  it("mapea concepto, monto y moneda", () => {
    expect(
      mapearConceptosSugeridos([
        {
          concepto_costo_id: "c2",
          monto_sugerido: 1500.5,
          conceptos_costo: { concepto: "Flete marítimo", moneda: "USD" },
        },
      ]),
    ).toEqual([
      { conceptoCostoId: "c2", concepto: "Flete marítimo", monto: 1500.5, moneda: "USD" },
    ]);
  });
});
