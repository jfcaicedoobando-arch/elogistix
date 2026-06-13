import { describe, it, expect } from "vitest";
import {
  normalizeHeader,
  detectDelimiter,
  buildEffectiveHeaders,
  tokenize,
} from "../parseCsv.helpers";

describe("csv/parseCsv.helpers", () => {
  it("parseHelpers.normalizeHeader: quita acentos y espacios", () => {
    expect(normalizeHeader("Razón Social")).toBe("razon_social");
  });

  it("parseHelpers.normalizeHeader: quita zero-width chars", () => {
    expect(normalizeHeader("Cli\u200Bente")).toBe("cliente");
  });

  it("parseHelpers.normalizeHeader: NBSP cuenta como espacio", () => {
    expect(normalizeHeader("Razón\u00A0Social")).toBe("razon_social");
  });

  it("parseHelpers.normalizeHeader: descarta no alfanuméricos", () => {
    expect(normalizeHeader("Precio ($USD)")).toBe("precio_usd");
  });

  it("parseHelpers.detectDelimiter: detecta coma", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
  });

  it("parseHelpers.detectDelimiter: detecta punto y coma", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
  });

  it("parseHelpers.detectDelimiter: ignora separadores dentro de comillas", () => {
    expect(detectDelimiter('"a,b";c;d')).toBe(";");
  });

  it("parseHelpers.buildEffectiveHeaders: deduplica con sufijo _N", () => {
    const { effective, unique } = buildEffectiveHeaders(["nombre", "nombre"], {});
    expect(effective).toEqual(["nombre", "nombre_2"]);
    expect(unique).toEqual(["nombre", "nombre_2"]);
  });

  it("parseHelpers.buildEffectiveHeaders: aplica aliases", () => {
    const { effective } = buildEffectiveHeaders(["razon_social"], { razon_social: "nombre" });
    expect(effective).toEqual(["nombre"]);
  });

  it("parseHelpers.buildEffectiveHeaders: columnas vacías se ignoran", () => {
    const { effective, unique } = buildEffectiveHeaders(["a", "", "b"], {});
    expect(effective).toEqual(["a", "", "b"]);
    expect(unique).toEqual(["a", "b"]);
  });

  it("parseHelpers.tokenize: maneja comillas escapadas RFC 4180", () => {
    const r = tokenize('a,"b""c",d', ",");
    expect(r[0]).toEqual(["a", 'b"c', "d"]);
  });

  it("parseHelpers.tokenize: respeta saltos de línea dentro de quotes", () => {
    const r = tokenize('a,"line\n2",c', ",");
    expect(r[0]).toEqual(["a", "line\n2", "c"]);
  });

  it("parseHelpers.tokenize: múltiples filas separadas por \\n", () => {
    const r = tokenize("a,b\nc,d", ",");
    expect(r).toEqual([["a", "b"], ["c", "d"]]);
  });
});
