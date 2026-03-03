import { describe, it, expect } from "vitest";
import { getDocsForMode, ESTADO_TIMELINE, CATALOGO_CONCEPTOS } from "@/data/embarqueConstants";

describe("getDocsForMode", () => {
  it("Marítimo incluye BL Master", () => {
    expect(getDocsForMode("Marítimo")).toContain("Bill of Lading (BL Master)");
  });
  it("cadena vacía retorna docs marítimos por default", () => {
    expect(getDocsForMode("")).toContain("Bill of Lading (BL Master)");
  });
  it("Aéreo incluye AWB", () => {
    expect(getDocsForMode("Aéreo")).toContain("Air Waybill (AWB)");
  });
  it("Terrestre incluye Carta Porte", () => {
    expect(getDocsForMode("Terrestre")).toContain("Carta Porte");
  });
});

describe("ESTADO_TIMELINE", () => {
  it("tiene 6 estados", () => {
    expect(ESTADO_TIMELINE).toHaveLength(6);
  });
  it("empieza con Cotización y termina con Cerrado", () => {
    expect(ESTADO_TIMELINE[0]).toBe("Cotización");
    expect(ESTADO_TIMELINE[5]).toBe("Cerrado");
  });
});

describe("CATALOGO_CONCEPTOS", () => {
  it("tiene 8 opciones", () => {
    expect(CATALOGO_CONCEPTOS).toHaveLength(8);
  });
  it("incluye Flete Marítimo, Cargos en Destino y Cargos en Origen", () => {
    expect(CATALOGO_CONCEPTOS).toContain("Flete Marítimo");
    expect(CATALOGO_CONCEPTOS).toContain("Cargos en Destino");
    expect(CATALOGO_CONCEPTOS).toContain("Cargos en Origen");
  });
});
