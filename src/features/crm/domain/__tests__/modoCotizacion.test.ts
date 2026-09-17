import { describe, it, expect } from "vitest";
import { mapModoCrmACotizacion } from "../modoCotizacion";

describe("mapModoCrmACotizacion", () => {
  it("acepta los modos exactos del catálogo", () => {
    expect(mapModoCrmACotizacion("Marítimo")).toBe("Marítimo");
    expect(mapModoCrmACotizacion("Aéreo")).toBe("Aéreo");
    expect(mapModoCrmACotizacion("Terrestre")).toBe("Terrestre");
    expect(mapModoCrmACotizacion("Multimodal")).toBe("Multimodal");
  });

  it("normaliza variantes con sufijo del CRM", () => {
    expect(mapModoCrmACotizacion("Marítimo FCL")).toBe("Marítimo");
    expect(mapModoCrmACotizacion("maritimo lcl")).toBe("Marítimo");
    expect(mapModoCrmACotizacion("Aéreo consolidado")).toBe("Aéreo");
    expect(mapModoCrmACotizacion("Aereo express")).toBe("Aéreo");
  });

  it("no adivina: valores desconocidos devuelven null (nunca Marítimo)", () => {
    for (const v of ["FCL", "LCL", "Courier", "Barco", "", null, undefined]) {
      expect(mapModoCrmACotizacion(v)).toBeNull();
    }
  });
});
