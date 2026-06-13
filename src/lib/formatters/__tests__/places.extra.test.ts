import { describe, it, expect } from "vitest";
import { getOrigen, getDestino, correctSpanishPlace } from "@/lib/formatters/places";

describe("formatters/places · getOrigen", () => {
  it("01 · devuelve puerto_origen cuando está presente", () => {
    expect(getOrigen({ puerto_origen: "Veracruz", aeropuerto_origen: "MEX", ciudad_origen: "CDMX" })).toBe("Veracruz");
  });

  it("02 · fallback a aeropuerto_origen si no hay puerto", () => {
    expect(getOrigen({ aeropuerto_origen: "MEX", ciudad_origen: "CDMX" })).toBe("MEX");
  });

  it("03 · fallback a ciudad_origen si no hay puerto ni aeropuerto", () => {
    expect(getOrigen({ ciudad_origen: "Guadalajara" })).toBe("Guadalajara");
  });

  it("04 · devuelve — cuando todos son nulos/undefined", () => {
    expect(getOrigen({})).toBe("—");
  });

  it("05 · null en puerto usa aeropuerto como fallback", () => {
    expect(getOrigen({ puerto_origen: null, aeropuerto_origen: "GDL" })).toBe("GDL");
  });
});

describe("formatters/places · getDestino", () => {
  it("06 · devuelve puerto_destino cuando está presente", () => {
    expect(getDestino({ puerto_destino: "Manzanillo" })).toBe("Manzanillo");
  });

  it("07 · fallback a aeropuerto_destino", () => {
    expect(getDestino({ aeropuerto_destino: "CUN" })).toBe("CUN");
  });

  it("08 · devuelve — cuando todos son vacíos/nulos", () => {
    expect(getDestino({ puerto_destino: null, aeropuerto_destino: null, ciudad_destino: null })).toBe("—");
  });
});

describe("formatters/places · correctSpanishPlace", () => {
  it("09 · null devuelve string vacío", () => {
    expect(correctSpanishPlace(null)).toBe("");
  });

  it("10 · undefined devuelve string vacío", () => {
    expect(correctSpanishPlace(undefined)).toBe("");
  });

  it("11 · 'mexico' se corrige a 'México'", () => {
    expect(correctSpanishPlace("mexico")).toBe("México");
  });

  it("12 · 'queretaro' se corrige a 'Querétaro'", () => {
    expect(correctSpanishPlace("queretaro")).toBe("Querétaro");
  });

  it("13 · 'nuevo leon' se corrige a 'Nuevo León'", () => {
    expect(correctSpanishPlace("nuevo leon")).toBe("Nuevo León");
  });

  it("14 · múltiples partes separadas por coma se procesan individualmente", () => {
    const result = correctSpanishPlace("queretaro,mexico");
    expect(result).toContain("Querétaro");
    expect(result).toContain("México");
  });

  it("15 · texto no en diccionario recibe Title Case normal", () => {
    expect(correctSpanishPlace("ciudad juarez")).toBe("Ciudad Juarez");
  });

  it("16 · 'merida' se corrige a 'Mérida'", () => {
    expect(correctSpanishPlace("merida")).toBe("Mérida");
  });

  it("17 · 'torreon' se corrige a 'Torreón'", () => {
    expect(correctSpanishPlace("torreon")).toBe("Torreón");
  });
});
