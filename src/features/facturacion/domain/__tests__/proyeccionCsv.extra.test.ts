import { describe, it, expect } from "vitest";
import {
  PROYECCION_CSV_HEADERS,
  buildProyeccionCsvFilename,
  buildProyeccionCsvRows,
} from "@/features/facturacion/domain/proyeccionCsv";
import type { GrupoProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";

// ── Fixture helper ──────────────────────────────────────────────────────────
function makeGrupo(overrides: Partial<GrupoProyeccion> = {}): GrupoProyeccion {
  return {
    expediente: "EXP-100",
    sinTc: false,
    cliente_nombre: "Cliente Test",
    operador: "Operador X",
    eta: "2024-08-20",
    contenedores: ["CONT-1"],
    totalContenedores: 1,
    ventaMxn: 10000,
    ventaUsd: 600,
    costoMxn: 7000,
    costoUsd: 420,
    profitMxn: 3000,
    profitUsd: 180,
    margenPct: 30,
    estado: "Pendiente",
    embarqueIds: ["emb-100"],
    ...overrides,
  };
}

// ── PROYECCION_CSV_HEADERS ──────────────────────────────────────────────────
describe("proyeccionCsv · PROYECCION_CSV_HEADERS", () => {
  it("contiene exactamente 13 columnas", () => {
    expect(PROYECCION_CSV_HEADERS).toHaveLength(13);
  });

  it("primera columna es 'expediente'", () => {
    expect(PROYECCION_CSV_HEADERS[0].key).toBe("expediente");
  });

  it("última columna es 'estado'", () => {
    expect(PROYECCION_CSV_HEADERS[PROYECCION_CSV_HEADERS.length - 1].key).toBe("estado");
  });

  it("incluye columna 'margen'", () => {
    expect(PROYECCION_CSV_HEADERS.some((h) => h.key === "margen")).toBe(true);
  });

  it("incluye columnas de costo (costo_usd, costo_mxn)", () => {
    const keys = PROYECCION_CSV_HEADERS.map((h) => h.key);
    expect(keys).toContain("costo_usd");
    expect(keys).toContain("costo_mxn");
  });
});

// ── buildProyeccionCsvFilename ──────────────────────────────────────────────
describe("proyeccionCsv · buildProyeccionCsvFilename", () => {
  it("genera nombre con mesKey incluido", () => {
    expect(buildProyeccionCsvFilename("2024-08")).toBe("proyeccion_2024-08.csv");
  });

  it("empieza con 'proyeccion_'", () => {
    expect(buildProyeccionCsvFilename("2025-01")).toMatch(/^proyeccion_/);
  });

  it("termina en '.csv'", () => {
    expect(buildProyeccionCsvFilename("2025-01")).toMatch(/\.csv$/);
  });

  it("acepta mesKey con formato distinto (ej. nombre de mes)", () => {
    expect(buildProyeccionCsvFilename("julio-2025")).toBe("proyeccion_julio-2025.csv");
  });
});

// ── buildProyeccionCsvRows ──────────────────────────────────────────────────
describe("proyeccionCsv · buildProyeccionCsvRows", () => {
  it("devuelve arreglo vacío para lista vacía", () => {
    expect(buildProyeccionCsvRows([])).toEqual([]);
  });

  it("mapea correctamente campos base de un grupo", () => {
    const grupo = makeGrupo();
    const [row] = buildProyeccionCsvRows([grupo]);
    expect(row.expediente).toBe("EXP-100");
    expect(row.cliente).toBe("Cliente Test");
    expect(row.operador).toBe("Operador X");
    expect(row.estado).toBe("Pendiente");
  });

  it("formatea ventaUsd con 2 decimales", () => {
    const [row] = buildProyeccionCsvRows([makeGrupo({ ventaUsd: 600.1 })]);
    expect(row.venta_usd).toBe("600.10");
  });

  it("formatea costoMxn con 2 decimales", () => {
    const [row] = buildProyeccionCsvRows([makeGrupo({ costoMxn: 7000 })]);
    expect(row.costo_mxn).toBe("7000.00");
  });

  it("formatea profitUsd con 2 decimales", () => {
    const [row] = buildProyeccionCsvRows([makeGrupo({ profitUsd: 180.555 })]);
    expect(row.profit_usd).toBe("180.56");
  });

  it("formatea margenPct con 1 decimal", () => {
    const [row] = buildProyeccionCsvRows([makeGrupo({ margenPct: 30.123 })]);
    expect(row.margen).toBe("30.1");
  });

  it("eta es cadena vacía cuando es null", () => {
    const [row] = buildProyeccionCsvRows([makeGrupo({ eta: null })]);
    expect(row.eta).toBe("");
  });

  it("refleja totalContenedores en campo contenedores", () => {
    const [row] = buildProyeccionCsvRows([makeGrupo({ totalContenedores: 5 })]);
    expect(row.contenedores).toBe(5);
  });

  it("mapea estado 'Facturado' correctamente", () => {
    const [row] = buildProyeccionCsvRows([makeGrupo({ estado: "Facturado" })]);
    expect(row.estado).toBe("Facturado");
  });

  it("procesa múltiples grupos sin mezclar datos", () => {
    const grupos = [
      makeGrupo({ expediente: "EXP-A", ventaUsd: 100 }),
      makeGrupo({ expediente: "EXP-B", ventaUsd: 200 }),
    ];
    const rows = buildProyeccionCsvRows(grupos);
    expect(rows).toHaveLength(2);
    expect(rows[0].expediente).toBe("EXP-A");
    expect(rows[0].venta_usd).toBe("100.00");
    expect(rows[1].expediente).toBe("EXP-B");
    expect(rows[1].venta_usd).toBe("200.00");
  });
});
