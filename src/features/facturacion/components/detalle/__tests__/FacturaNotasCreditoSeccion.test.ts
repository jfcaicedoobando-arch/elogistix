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

describe("parseConceptosSugeridos (AUDIT-144 linaje)", () => {
  it("copia el id del concepto original y deja null si falta", () => {
    const out = parseConceptosSugeridos({ conceptos: [
      { id: "cf-1", descripcion: "A", precio_unitario: 100 },
      { descripcion: "B", precio_unitario: 300 },
    ] });
    expect(out[0].concepto_factura_id).toBe("cf-1");
    expect(out[1].concepto_factura_id).toBeNull();
  });
});
