import { describe, it, expect } from "vitest";
import { parseLeadsCsv, mapLeadCsvRows } from "../leadsCsv";

describe("parseLeadsCsv", () => {
  it("parsea filas simples", () => {
    const r = parseLeadsCsv("a,b,c\n1,2,3\n");
    expect(r).toEqual([["a","b","c"],["1","2","3"]]);
  });

  it("respeta comillas dobles y comas escapadas", () => {
    const r = parseLeadsCsv('empresa,notas\n"Acme, S.A.","línea ""1"""\n');
    expect(r).toEqual([["empresa","notas"],["Acme, S.A.",'línea "1"']]);
  });

  it("ignora filas completamente vacías", () => {
    const r = parseLeadsCsv("a,b\n,\n1,2\n");
    expect(r).toEqual([["a","b"],["1","2"]]);
  });

  it("tolera CRLF", () => {
    const r = parseLeadsCsv("a,b\r\n1,2\r\n");
    expect(r).toEqual([["a","b"],["1","2"]]);
  });
});

describe("mapLeadCsvRows", () => {
  it("devuelve [] si no hay matriz", () => {
    expect(mapLeadCsvRows([])).toEqual([]);
  });

  it("marca empresa requerida", () => {
    const r = mapLeadCsvRows([["empresa","email"],["","foo@bar.com"]]);
    expect(r[0].__error).toBe("Empresa requerida");
  });

  it("usa defaults para fuente/score inválidos", () => {
    const r = mapLeadCsvRows([
      ["empresa","fuente","score"],
      ["Acme","invent","99"],
    ]);
    expect(r[0].fuente).toBe("Otro");
    expect(r[0].estado).toBe("Nuevo");
    expect(r[0].score).toBe(3);
    expect(r[0].__error).toBeUndefined();
  });

  // v13.823.62: el CSV sólo acepta los estados manuales.
  it("acepta estados manuales y marca error en estados del ERP", () => {
    const ok = mapLeadCsvRows([["empresa","estado"],["Acme","Contactado"]]);
    expect(ok[0].estado).toBe("Contactado");
    expect(ok[0].__error).toBeUndefined();

    for (const derivado of ["Calificado", "Prospecto", "Pendiente de alta", "Convertido", "invent"]) {
      const r = mapLeadCsvRows([["empresa","estado"],["Acme", derivado]]);
      expect(r[0].__error).toBe(LEAD_CSV_ESTADO_DERIVADO_ERROR);
      expect(r[0].estado).toBe("Nuevo");
    }
  });

  it("estado vacío usa Nuevo sin error", () => {
    const r = mapLeadCsvRows([["empresa","estado"],["Acme",""]]);
    expect(r[0].estado).toBe("Nuevo");
    expect(r[0].__error).toBeUndefined();
  });


  it("acepta alias de headers (company, correo, teléfono)", () => {
    const r = mapLeadCsvRows([
      ["company","correo","teléfono"],
      ["Acme","x@y.com","555"],
    ]);
    expect(r[0].empresa).toBe("Acme");
    expect(r[0].email).toBe("x@y.com");
    expect(r[0].telefono).toBe("555");
  });
});
