/**
 * Tests puros para `parseCsv.helpers.ts` — sin I/O, sin mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeHeader,
  detectDelimiter,
  buildEffectiveHeaders,
  tokenize,
  buildAliasMap,
  rowsFromRecords,
} from "@/lib/csv/parseCsv.helpers";

describe("normalizeHeader", () => {
  it("baja a minúsculas y reemplaza espacios por _", () => {
    expect(normalizeHeader(" Nombre del Cliente ")).toBe("nombre_del_cliente");
  });
  it("quita acentos y diacríticos", () => {
    expect(normalizeHeader("Razón Social")).toBe("razon_social");
    expect(normalizeHeader("Año")).toBe("ano");
  });
  it("quita zero-width, NBSP y controles", () => {
    expect(normalizeHeader("RFC\u200B\u00A0Cliente")).toBe("rfc_cliente");
    expect(normalizeHeader("col\u0001umna")).toBe("columna");
  });
  it("descarta caracteres no alfanuméricos", () => {
    expect(normalizeHeader("Tel.#1 (móvil)")).toBe("tel1_movil");
  });
});

describe("detectDelimiter", () => {
  it("detecta coma cuando predomina", () => {
    expect(detectDelimiter("a,b,c,d")).toBe(",");
  });
  it("detecta punto y coma cuando predomina", () => {
    expect(detectDelimiter("a;b;c;d")).toBe(";");
  });
  it("ignora separadores dentro de comillas", () => {
    expect(detectDelimiter('"a;b;c";"d";e')).toBe(";");
    expect(detectDelimiter('"a,b,c","d",e')).toBe(",");
  });
});

describe("buildEffectiveHeaders", () => {
  it("aplica alias y deja unique sin vacíos", () => {
    const r = buildEffectiveHeaders(["Nombre", "Razón Social", ""], { razon_social: "rfc" });
    expect(r.effective).toEqual(["nombre", "rfc", ""]);
    expect(r.unique).toEqual(["nombre", "rfc"]);
  });
  it("renombra duplicados con sufijo _N", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = buildEffectiveHeaders(["email", "email", "email"], {});
    expect(r.effective).toEqual(["email", "email_2", "email_3"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("tokenize", () => {
  it("parsea filas simples", () => {
    expect(tokenize("a,b,c\n1,2,3\n", ",")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
  it("respeta comillas y comillas dobles escapadas", () => {
    expect(tokenize('a,"b,c","d""e"\n', ",")).toEqual([["a", "b,c", 'd"e']]);
  });
  it("acepta punto y coma", () => {
    expect(tokenize("a;b\n1;2", ";")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("buildAliasMap", () => {
  it("normaliza claves y valores; salta claves vacías", () => {
    const m = buildAliasMap({ "Razón Social": "RFC", "  ": "ignored" });
    expect(m).toEqual({ razon_social: "rfc" });
  });
  it("retorna {} para undefined", () => {
    expect(buildAliasMap(undefined)).toEqual({});
  });
});

describe("rowsFromRecords", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());
  it("ignora la fila 0 (header) y mapea por effective", () => {
    const recs = [
      ["nombre", "rfc"],
      ["Acme", "ACM010101AAA"],
      ["", ""], // fila vacía
      ["Beta", "BTA020202BBB"],
    ];
    expect(rowsFromRecords(recs, ["nombre", "rfc"])).toEqual([
      { nombre: "Acme", rfc: "ACM010101AAA" },
      { nombre: "Beta", rfc: "BTA020202BBB" },
    ]);
  });
  it("salta columnas con header vacío", () => {
    const recs = [["nombre", "ignorar", "rfc"], ["Acme", "x", "ACM"]];
    expect(rowsFromRecords(recs, ["nombre", "", "rfc"])).toEqual([
      { nombre: "Acme", rfc: "ACM" },
    ]);
  });
});
