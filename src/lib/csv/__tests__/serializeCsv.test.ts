import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv/serializeCsv";

describe("toCsv (serializeCsv)", () => {
  it("genera headers + filas con delimitador coma por defecto", () => {
    const csv = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("a,b\n1,2\n3,4");
  });

  it("soporta punto y coma como delimitador", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]], ";");
    expect(csv).toBe("a;b\n1;2");
  });

  it("envuelve en comillas valores con coma", () => {
    const csv = toCsv(["x"], [["uno, dos"]]);
    expect(csv).toBe('x\n"uno, dos"');
  });

  it("escapa comillas dobles duplicándolas (RFC 4180)", () => {
    const csv = toCsv(["x"], [['dijo "hola"']]);
    expect(csv).toBe('x\n"dijo ""hola"""');
  });

  it("envuelve en comillas valores con salto de línea", () => {
    const csv = toCsv(["x"], [["linea1\nlinea2"]]);
    expect(csv).toBe('x\n"linea1\nlinea2"');
  });

  it("no envuelve valores sin caracteres especiales", () => {
    const csv = toCsv(["x"], [["simple"]]);
    expect(csv).toBe("x\nsimple");
  });

  it("no envuelve un punto y coma cuando el delimitador es coma", () => {
    const csv = toCsv(["x"], [["uno;dos"]]);
    expect(csv).toBe("x\nuno;dos");
  });

  it("solo headers cuando no hay filas", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b");
  });

  it("N35: neutraliza celdas que inician con = + - @ (CSV injection)", () => {
    const csv = toCsv(["concepto"], [['=HIPERVINCULO("http://evil","pago")'], ["+1"], ["@x"], ["ok"]]);
    expect(csv).toContain("'=HIPERVINCULO");
    expect(csv).toContain("'+1");
    expect(csv).toContain("'@x");
    expect(csv).toContain("ok");
  });
});
