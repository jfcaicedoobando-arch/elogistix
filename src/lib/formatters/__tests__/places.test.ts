import { describe, it, expect } from "vitest";
import { getOrigen, getDestino, correctSpanishPlace } from "@/lib/formatters/places";

describe("getOrigen / getDestino — prioridad puerto > aeropuerto > ciudad", () => {
  it("getOrigen: puerto gana", () => {
    expect(getOrigen({ puerto_origen: "Manzanillo", aeropuerto_origen: "MEX", ciudad_origen: "CDMX" })).toBe("Manzanillo");
  });
  it("getOrigen: aeropuerto si no hay puerto", () => {
    expect(getOrigen({ aeropuerto_origen: "MEX", ciudad_origen: "CDMX" })).toBe("MEX");
  });
  it("getOrigen: ciudad como último recurso", () => {
    expect(getOrigen({ ciudad_origen: "Monterrey" })).toBe("Monterrey");
  });
  it("getOrigen: '—' si nada", () => {
    expect(getOrigen({})).toBe("—");
  });
  it("getDestino: aplica misma prioridad", () => {
    expect(getDestino({ puerto_destino: "Veracruz" })).toBe("Veracruz");
    expect(getDestino({})).toBe("—");
  });
});

describe("correctSpanishPlace", () => {
  it("vacío → ''", () => {
    expect(correctSpanishPlace(null)).toBe("");
    expect(correctSpanishPlace("")).toBe("");
  });

  it("corrige acentuación de lugares conocidos", () => {
    expect(correctSpanishPlace("mexico")).toBe("México");
    expect(correctSpanishPlace("queretaro")).toBe("Querétaro");
    expect(correctSpanishPlace("nuevo leon")).toBe("Nuevo León");
  });

  it("aplica title case para no listados", () => {
    expect(correctSpanishPlace("ciudad madero")).toBe("Ciudad Madero");
  });

  it("procesa partes separadas por coma", () => {
    expect(correctSpanishPlace("merida, yucatan")).toBe("Mérida, Yucatán");
  });
});
