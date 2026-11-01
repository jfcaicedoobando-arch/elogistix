import { describe, it, expect } from "vitest";
import Papa from "papaparse";
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

  it("escapa también encabezados con comas, comillas y saltos de línea", () => {
    const csv = toCSV([{ "nombre, legal": "Acme", 'nota "fiscal"': "a,b", "dos\nlíneas": "00123" }]);
    expect(Papa.parse<string[]>(csv, { delimiter: ",", dynamicTyping: false }).data).toEqual([
      ["nombre, legal", 'nota "fiscal"', "dos\nlíneas"],
      ["Acme", "a,b", "00123"],
    ]);
  });

  it("mantiene IDs, referencias históricas, relaciones y bajas como texto", () => {
    const csv = toCSV([{
      id: "00001234567890123456789", cliente_id: "0000456", referencia: "0000123",
      telefono: "00525512345678", deleted_at: "2026-09-10T12:00:00.000Z",
      detalle: { factura_id: "0000789" },
    }]);
    expect(Papa.parse<string[]>(csv, { delimiter: ",", dynamicTyping: false }).data[1]).toEqual([
      "00001234567890123456789", "0000456", "0000123", "00525512345678",
      "2026-09-10T12:00:00.000Z", '{"factura_id":"0000789"}',
    ]);
  });

  it("conserva filas vacías finales y objetos sin columnas", () => {
    expect(toCSV([{ a: "x" }, { a: "" }, { a: null }])).toBe("a\nx\n\n");
    expect(toCSV([{}, {}])).toBe("\n\n");
  });

  it("neutraliza negativos, fórmulas y controles sin conceder excepciones numéricas", () => {
    const csv = toCSV([{ a: -171.92, b: "-1+2", c: "@x", d: "+52", e: "\t=1", f: "\r=1" }]);
    expect(Papa.parse<string[]>(csv, { delimiter: ",", dynamicTyping: false }).data[1]).toEqual([
      "'-171.92", "'-1+2", "'@x", "'+52", "'\t=1", "'\r=1",
    ]);
  });
});
