import { describe, it, expect } from "vitest";
import { parseConceptosSugeridos } from "../facturaNotasCreditoConceptos";

describe("parseConceptosSugeridos (Ola 4 · N19)", () => {
  it("propaga tipo_iva del snapshot al concepto de la NC", () => {
    const snapshot = {
      conceptos: [
        { descripcion: "Flete exento", cantidad: 1, precio_unitario: 100, tipo_iva: "exento" },
        { descripcion: "Maniobra tasa 0", cantidad: 1, precio_unitario: 50, tipo_iva: "tasa_0" },
        { descripcion: "Servicio gravado" }, // sin tipo_iva
      ],
    };
    const out = parseConceptosSugeridos(snapshot);
    expect(out).toHaveLength(3);
    expect(out[0].tipo_iva).toBe("exento");
    expect(out[1].tipo_iva).toBe("tasa_0");
    expect(out[2].tipo_iva).toBeNull();
  });

  it("sin snapshot válido devuelve arreglo vacío", () => {
    expect(parseConceptosSugeridos(null)).toEqual([]);
    expect(parseConceptosSugeridos({})).toEqual([]);
  });
});
