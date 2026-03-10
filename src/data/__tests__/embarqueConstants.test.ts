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
  it("tiene 7 estados", () => {
    expect(ESTADO_TIMELINE).toHaveLength(7);
  });
  it("empieza con Confirmado y termina con Cerrado", () => {
    expect(ESTADO_TIMELINE[0]).toBe("Confirmado");
    expect(ESTADO_TIMELINE[ESTADO_TIMELINE.length - 1]).toBe("Cerrado");
  });
  it("incluye Arribo y EIR", () => {
    expect(ESTADO_TIMELINE).toContain("Arribo");
    expect(ESTADO_TIMELINE).toContain("EIR");
  });
});

describe("CATALOGO_CONCEPTOS", () => {
  it("tiene 18 opciones", () => {
    expect(CATALOGO_CONCEPTOS).toHaveLength(18);
  });
  it("incluye Flete Marítimo, Cargos en Destino y Cargos en Origen", () => {
    expect(CATALOGO_CONCEPTOS).toContain("Flete Marítimo");
    expect(CATALOGO_CONCEPTOS).toContain("Cargos en Destino");
    expect(CATALOGO_CONCEPTOS).toContain("Cargos en Origen");
  });
  it("incluye conceptos unificados de cotizaciones", () => {
    expect(CATALOGO_CONCEPTOS).toContain("Handling");
    expect(CATALOGO_CONCEPTOS).toContain("Honorarios de Despacho Aduanal");
    expect(CATALOGO_CONCEPTOS).toContain("Otro");
  });
});
