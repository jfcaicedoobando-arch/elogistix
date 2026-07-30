import { describe, it, expect } from "vitest";
import { toTitleCase, nombreDesdeEmail, shortName } from "@/lib/formatters/text";

describe("toTitleCase", () => {
  it("vacío/null → ''", () => {
    expect(toTitleCase("")).toBe("");
    expect(toTitleCase(null)).toBe("");
    expect(toTitleCase(undefined)).toBe("");
  });

  it("conectores en minúscula menos si son la primera palabra", () => {
    expect(toTitleCase("juan de la cruz")).toBe("Juan de la Cruz");
    expect(toTitleCase("de la rosa")).toBe("De la Rosa");
  });

  it("siglas comunes en mayúsculas", () => {
    expect(toTitleCase("rfc del cliente iva")).toBe("RFC del Cliente IVA");
  });

  it("tokens corporativos sa/cv → mayúsculas", () => {
    expect(toTitleCase("acme sa de cv")).toBe("Acme SA de CV");
  });

  it("preserva S.A. con puntos internos", () => {
    expect(toTitleCase("acme S.A. de C.V.")).toBe("Acme S.A. de C.V.");
  });

  it("capitaliza después de guion interno", () => {
    expect(toTitleCase("juan-pedro")).toBe("Juan-Pedro");
  });

  it("quita dígitos colgantes", () => {
    expect(toTitleCase("acme123")).toBe("Acme");
  });
});

describe("nombreDesdeEmail", () => {
  it("extrae y formatea la parte local", () => {
    expect(nombreDesdeEmail("alan.hernandez@elogistix.com")).toBe("Alan Hernandez");
    expect(nombreDesdeEmail("juan_perez")).toBe("Juan Perez");
    expect(nombreDesdeEmail("maria-lopez@x.com")).toBe("Maria Lopez");
  });

  it("vacío/null → ''", () => {
    expect(nombreDesdeEmail("")).toBe("");
    expect(nombreDesdeEmail(null)).toBe("");
  });
});

describe("shortName", () => {
  it("corta antes de coma o em dash", () => {
    expect(shortName("Juan Pérez, Director")).toBe("Juan Pérez");
    expect(shortName("Acme — México")).toBe("Acme");
  });

  it("null → '-'", () => {
    expect(shortName(null)).toBe("-");
    expect(shortName("")).toBe("-");
  });
});

describe("toTitleCase · códigos cortos (R-14)", () => {
  it("preserva dígitos en códigos cortos", () => {
    expect(toTitleCase("R3")).toBe("R3");
    expect(toTitleCase("contenedor m2")).toBe("Contenedor M2");
    expect(toTitleCase("ruta T1 norte")).toBe("Ruta T1 Norte");
  });

  it("sigue limpiando dígitos colgantes de raíces largas", () => {
    expect(toTitleCase("acme123")).toBe("Acme");
  });
});
