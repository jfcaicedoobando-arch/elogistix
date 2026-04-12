import { describe, it, expect } from "vitest";
import { getDocsForMode, ESTADOS_EMBARQUE, CATALOGO_CONCEPTOS } from "@/data/embarqueConstants";

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

describe("ESTADOS_EMBARQUE", () => {
  it("tiene 7 estados", () => {
    expect(ESTADOS_EMBARQUE).toHaveLength(7);
  });
  it("empieza con Confirmado y termina con Cerrado", () => {
    expect(ESTADOS_EMBARQUE[0]).toBe("Confirmado");
    expect(ESTADOS_EMBARQUE[ESTADOS_EMBARQUE.length - 1]).toBe("Cerrado");
  });
  it("incluye Arribo y EIR", () => {
    expect(ESTADOS_EMBARQUE).toContain("Arribo");
    expect(ESTADOS_EMBARQUE).toContain("EIR");
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
