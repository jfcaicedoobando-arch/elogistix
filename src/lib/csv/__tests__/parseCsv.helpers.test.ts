/**
 * Tests puros para `parseCsv.helpers.ts` — sin I/O, sin mocks.
 * `normalizeHeader` ya está cubierto por `parseCsv.test.ts`; aquí cubrimos
 * el resto de helpers (detector de delimitador, builder de headers efectivos,
 * tokenizer RFC-4180, alias map y mapeo de filas).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectDelimiter,
  buildEffectiveHeaders,
  tokenize,
  buildAliasMap,
  rowsFromRecords,
} from "@/lib/csv/parseCsv.helpers";

describe("detectDelimiter — heurística coma vs punto-y-coma", () => {
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

describe("buildEffectiveHeaders — alias, duplicados, vacíos", () => {
  it("aplica alias y deja unique sin vacíos", () => {
    const r = buildEffectiveHeaders(["Nombre", "Razón Social", ""], { razon_social: "rfc" });
    expect(r.effective).toEqual(["nombre", "rfc", ""]);
    expect(r.unique).toEqual(["nombre", "rfc"]);
  });
  it("renombra duplicados con sufijo _N y avisa", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = buildEffectiveHeaders(["email", "email", "email"], {});
    expect(r.effective).toEqual(["email", "email_2", "email_3"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("tokenize — state machine RFC 4180", () => {
  it("parsea filas separadas por coma", () => {
    expect(tokenize("a,b,c\n1,2,3\n", ",")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
  it("respeta comillas y comillas dobles escapadas", () => {
    expect(tokenize('a,"b,c","d""e"\n', ",")).toEqual([["a", "b,c", 'd"e']]);
  });
  it("acepta punto y coma como delimitador", () => {
    expect(tokenize("a;b\n1;2", ";")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("buildAliasMap — normaliza claves y valores", () => {
  it("normaliza claves y valores; salta claves vacías", () => {
    const m = buildAliasMap({ "Razón Social": "RFC", "  ": "ignored" });
    expect(m).toEqual({ razon_social: "rfc" });
  });
  it("retorna {} para undefined", () => {
    expect(buildAliasMap(undefined)).toEqual({});
  });
});

describe("rowsFromRecords — ignora header y filas vacías", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());
  it("ignora la fila 0 (header) y mapea por effective", () => {
    const recs = [
      ["nombre", "rfc"],
      ["Acme", "ACM010101AAA"],
      ["", ""],
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
