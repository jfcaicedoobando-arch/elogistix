/**
 * Ola A CRM: higiene de cartera. La deduplicación debe detectar el mismo
 * prospecto capturado con variaciones (razón social con S.A. de C.V.,
 * teléfono con lada/espacios, correo con mayúsculas).
 */
import { describe, it, expect } from "vitest";
import {
  clasificarDuplicado,
  clasificarLote,
  resumenDuplicados,
  normTelefono,
} from "../leadsDedupe";

const EXISTENTES = [
  {
    id: "1",
    empresa: "Aceros del Norte S.A. de C.V.",
    contacto: "Ana",
    email: "Ventas@Aceros.MX",
    telefono: "+52 (81) 1234-5678",
    estado: "Contactado",
  },
];

describe("leadsDedupe", () => {
  it("marca duplicado exacto cuando el correo coincide sin importar mayúsculas", () => {
    const c = clasificarDuplicado({ empresa: "Otra", email: "ventas@aceros.mx" }, EXISTENTES);
    expect(c.nivel).toBe("exacto");
    expect(c.campos).toContain("correo");
  });

  it("compara teléfonos por los últimos 10 dígitos", () => {
    expect(normTelefono("+52 (81) 1234-5678")).toBe("528112345678");
    const c = clasificarDuplicado({ empresa: "Otra", telefono: "8112345678" }, EXISTENTES);
    expect(c.nivel).toBe("posible");
    expect(c.campos).toEqual(["teléfono"]);
  });

  it("ignora puntuación y sufijos de razón social sólo si normaliza igual", () => {
    const c = clasificarDuplicado({ empresa: "aceros del norte sa de cv" }, EXISTENTES);
    expect(c.nivel).toBe("posible");
  });

  it("no marca duplicado a un lead nuevo", () => {
    const c = clasificarDuplicado({ empresa: "Textiles Bajío", email: "a@b.mx" }, EXISTENTES);
    expect(c.nivel).toBe("nuevo");
  });

  it("detecta filas repetidas dentro del mismo archivo", () => {
    const filas = [
      { empresa: "Nueva Empresa", email: "n@e.mx" },
      { empresa: "Nueva Empresa", email: "n@e.mx" },
    ];
    const cs = clasificarLote(filas, []);
    expect(cs[0].nivel).toBe("nuevo");
    expect(cs[1].nivel).toBe("exacto");
    expect(cs[1].campos).toContain("repetido en el archivo");
    expect(resumenDuplicados(cs)).toEqual({ nuevos: 1, posibles: 0, exactos: 1 });
  });
});
