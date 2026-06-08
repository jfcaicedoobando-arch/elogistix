import { describe, it, expect } from "vitest";
import { parseCsv, toCsv, normalizeHeader } from "../parseCsv";

describe("normalizeHeader", () => {
  it("normaliza acentos y espacios", () => {
    expect(normalizeHeader("Razón Social")).toBe("razon_social");
    expect(normalizeHeader("  Días Crédito  ")).toBe("dias_credito");
    expect(normalizeHeader("RFC")).toBe("rfc");
  });
  it("elimina BOM intermedio y zero-width", () => {
    expect(normalizeHeader("Razón\uFEFF Social")).toBe("razon_social");
    expect(normalizeHeader("nombre\u200B")).toBe("nombre");
    expect(normalizeHeader("e\u200Cmail")).toBe("email");
  });
  it("colapsa NBSP como espacio", () => {
    expect(normalizeHeader("Días\u00A0Crédito")).toBe("dias_credito");
  });
  it("elimina caracteres de control", () => {
    expect(normalizeHeader("rfc\t")).toBe("rfc");
    expect(normalizeHeader("\u0001nombre\u007F")).toBe("nombre");
  });
});

describe("parseCsv", () => {
  it("parsea CSV básico con coma", () => {
    const r = parseCsv("nombre,rfc\nAcme,ABC123\nXyz,DEF456\n");
    expect(r.delimiter).toBe(",");
    expect(r.headers).toEqual(["nombre", "rfc"]);
    expect(r.rows).toEqual([
      { nombre: "Acme", rfc: "ABC123" },
      { nombre: "Xyz", rfc: "DEF456" },
    ]);
  });

  it("autodetecta punto y coma", () => {
    const r = parseCsv("nombre;rfc\nAcme;ABC\n");
    expect(r.delimiter).toBe(";");
    expect(r.rows[0].rfc).toBe("ABC");
  });

  it("respeta comas dentro de comillas y comillas escapadas", () => {
    const r = parseCsv('nombre,direccion\n"Acme, S.A.","Av. ""Las Flores"" 10"\n');
    expect(r.rows[0]).toEqual({
      nombre: "Acme, S.A.",
      direccion: 'Av. "Las Flores" 10',
    });
  });

  it("soporta saltos de línea dentro de campos entre comillas", () => {
    const r = parseCsv('nombre,nota\n"A","linea1\nlinea2"\n');
    expect(r.rows[0].nota).toBe("linea1\nlinea2");
  });

  it("ignora filas completamente vacías y BOM", () => {
    const r = parseCsv("\uFEFFnombre,rfc\nA,1\n\n\nB,2\n");
    expect(r.rows).toHaveLength(2);
  });

  it("normaliza encabezados con acentos", () => {
    const r = parseCsv("Razón Social,RFC\nAcme,X1\n");
    expect(r.headers).toEqual(["razon_social", "rfc"]);
    expect(r.rows[0].razon_social).toBe("Acme");
  });

  it("maneja archivo vacío", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("   \n  ").rows).toEqual([]);
  });

  it("ignora columnas con encabezado vacío (comas sobrantes)", () => {
    const r = parseCsv(",nombre,rfc,\n,Acme,X1,\n");
    expect(r.headers).toEqual(["nombre", "rfc"]);
    expect(r.rows[0]).toEqual({ nombre: "Acme", rfc: "X1" });
  });

  it("deduplica headers duplicados con sufijo _N", () => {
    const r = parseCsv("nombre,Nombre\nA,B\n");
    expect(r.headers).toEqual(["nombre", "nombre_2"]);
    expect(r.rows[0]).toEqual({ nombre: "A", nombre_2: "B" });
  });

  it("aplica headerAliases para variaciones menores", () => {
    const r = parseCsv("correo,tel\nx@y.com,55\n", {
      headerAliases: { correo: "email", tel: "telefono" },
    });
    expect(r.headers).toEqual(["email", "telefono"]);
    expect(r.rows[0]).toEqual({ email: "x@y.com", telefono: "55" });
  });
});

describe("toCsv", () => {
  it("escapa valores con coma, comillas y saltos de línea", () => {
    const out = toCsv(
      ["a", "b"],
      [["x,y", 'con "comillas"'], ["normal", "con\nsalto"]],
    );
    expect(out).toBe('a,b\n"x,y","con ""comillas"""\nnormal,"con\nsalto"');
  });
});
