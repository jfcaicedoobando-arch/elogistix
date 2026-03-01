import { describe, it, expect } from "vitest";
import { getDocsForMode, ESTADO_TIMELINE, CONCEPTOS_MARITIMOS } from "@/data/embarqueConstants";

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

describe("CONCEPTOS_MARITIMOS", () => {
  it("no está vacío", () => {
    expect(CONCEPTOS_MARITIMOS.length).toBeGreaterThan(0);
  });
});
