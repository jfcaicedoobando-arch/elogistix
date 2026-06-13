import { describe, it, expect } from "vitest";
import { toTitleCase, nombreDesdeEmail, shortName } from "@/lib/formatters/text";

describe("formatters/text · toTitleCase", () => {
  it("01 · null devuelve string vacío", () => {
    expect(toTitleCase(null)).toBe("");
  });

  it("02 · undefined devuelve string vacío", () => {
    expect(toTitleCase(undefined)).toBe("");
  });

  it("03 · capitaliza primera letra de cada palabra", () => {
    expect(toTitleCase("hola mundo")).toBe("Hola Mundo");
  });

  it("04 · conectores como 'de' y 'la' quedan en minúscula cuando no son la primera palabra", () => {
    const result = toTitleCase("empresa de la republica");
    expect(result).toMatch(/de/);
    expect(result).toMatch(/la/);
    expect(result.startsWith("Empresa")).toBe(true);
  });

  it("05 · siglas RFC quedan en mayúsculas", () => {
    expect(toTitleCase("clave rfc empresa")).toContain("RFC");
  });

  it("06 · sigla IVA queda en mayúsculas", () => {
    expect(toTitleCase("calculo iva")).toContain("IVA");
  });

  it("07 · tokens corporativos SA CV quedan en mayúsculas", () => {
    const result = toTitleCase("empresa sa de cv");
    expect(result).toContain("SA");
    expect(result).toContain("CV");
  });

  it("08 · palabras con guión interno se capitalizan en cada parte", () => {
    expect(toTitleCase("norte-america")).toBe("Norte-America");
  });

  it("09 · string con dígitos colgantes al final del token los elimina", () => {
    const result = toTitleCase("producto123");
    expect(result).toBe("Producto");
  });

  it("10 · acrónimo con puntos S.A. queda en mayúsculas", () => {
    expect(toTitleCase("empresa s.a. holdings")).toContain("S.A.");
  });

  it("11 · string con solo espacios devuelve vacío", () => {
    expect(toTitleCase("   ")).toBe("");
  });
});

describe("formatters/text · nombreDesdeEmail", () => {
  it("12 · null devuelve string vacío", () => {
    expect(nombreDesdeEmail(null)).toBe("");
  });

  it("13 · email 'alan.hernandez@elogistix.com' → 'Alan Hernandez'", () => {
    expect(nombreDesdeEmail("alan.hernandez@elogistix.com")).toBe("Alan Hernandez");
  });

  it("14 · email con guión 'maria-jose@example.com' → 'Maria Jose'", () => {
    expect(nombreDesdeEmail("maria-jose@example.com")).toBe("Maria Jose");
  });

  it("15 · sin @ actúa sobre todo el string separando por puntos", () => {
    expect(nombreDesdeEmail("juan.perez")).toBe("Juan Perez");
  });

  it("16 · email con underscore 'carlos_garcia@x.com' → 'Carlos Garcia'", () => {
    expect(nombreDesdeEmail("carlos_garcia@x.com")).toBe("Carlos Garcia");
  });
});

describe("formatters/text · shortName", () => {
  it("17 · null devuelve guión", () => {
    expect(shortName(null)).toBe("-");
  });

  it("18 · nombre simple sin separadores devuelve el nombre completo", () => {
    expect(shortName("Juan Pérez")).toBe("Juan Pérez");
  });

  it("19 · nombre con coma devuelve solo la primera parte", () => {
    expect(shortName("Empresa SA, Sucursal Norte")).toBe("Empresa SA");
  });

  it("20 · nombre con guión largo devuelve solo la primera parte", () => {
    expect(shortName("Nombre — Subtítulo")).toBe("Nombre ");
  });
});
