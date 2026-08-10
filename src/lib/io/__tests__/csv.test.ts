import { describe, it, expect } from "vitest";
import { toCSV } from "@/lib/io/csv";

describe("toCSV", () => {
  it("retorna vacío para lista vacía", () => {
    expect(toCSV([])).toBe("");
  });
  it("genera headers + filas", () => {
    expect(toCSV([{ a: 1, b: 2 }])).toBe("a,b\n1,2");
  });
  it("escapa comas, comillas y saltos de línea", () => {
    const out = toCSV([{ x: 'a,b' }, { x: 'c"d' }, { x: "e\nf" }]);
    expect(out).toContain('"a,b"');
    expect(out).toContain('"c""d"');
    expect(out).toContain('"e\nf"');
  });
  it("maneja null/undefined como vacío", () => {
    expect(toCSV([{ a: null, b: undefined, c: "x" }])).toBe("a,b,c\n,,x");
  });
  it("serializa objetos como JSON", () => {
    const out = toCSV([{ data: { foo: 1 } }]);
    expect(out).toContain('"{""foo"":1}"');
  });
  it("unifica headers de filas heterogéneas", () => {
    const out = toCSV([{ a: 1 }, { b: 2 }]);
    expect(out.split("\n")[0]).toBe("a,b");
  });

  it("N35: neutraliza fórmulas en celdas y encabezados", () => {
    const csv = toCSV([{ "=raro": "=1+1" }]);
    expect(csv.split("\n")[0]).toBe("'=raro");
    expect(csv).toContain("'=1+1");
  });
});
