import { describe, it, expect } from "vitest";
import {
  HUECO_CSV_HEADERS,
  buildHuecoCsvFilename,
  buildHuecoCsvRows,
} from "@/features/facturacion/domain/huecoCsv";
import type { FilaHueco } from "@/features/facturacion/services";

// ── Fixture helper ──────────────────────────────────────────────────────────
function makeFilaHueco(overrides: Partial<FilaHueco> = {}): FilaHueco {
  return {
    embarque_id: "emb-1",
    expediente: "EXP-001",
    cliente_nombre: "Empresa SA",
    operador: "Juan Pérez",
    etd: "2024-03-01",
    eta: "2024-03-15",
    bl_master: "MASTER123",
    bl_house: "HOUSE456",
    diasDesdeEta: 10,
    sin_tc: false,
    ventaUsd: 1500.5,
    ventaMxn: 25000.75,
    ...overrides,
  };
}

// ── HUECO_CSV_HEADERS ───────────────────────────────────────────────────────
describe("huecoCsv · HUECO_CSV_HEADERS", () => {
  it("contiene exactamente 10 columnas", () => {
    expect(HUECO_CSV_HEADERS).toHaveLength(10);
  });

  it("huecoCsv: primera columna es 'expediente'", () => {
    expect(HUECO_CSV_HEADERS[0].key).toBe("expediente");
  });

  it("última columna es 'venta_mxn'", () => {
    expect(HUECO_CSV_HEADERS[HUECO_CSV_HEADERS.length - 1].key).toBe("venta_mxn");
  });

  it("incluye columna 'dias_sin_facturar'", () => {
    expect(HUECO_CSV_HEADERS.some((h) => h.key === "dias_sin_facturar")).toBe(true);
  });
});

// ── buildHuecoCsvFilename ───────────────────────────────────────────────────
describe("huecoCsv · buildHuecoCsvFilename", () => {
  it("genera nombre con la fecha proporcionada", () => {
    const fecha = new Date("2024-07-15T12:00:00Z");
    expect(buildHuecoCsvFilename(fecha)).toBe("hueco_facturacion_2024-07-15.csv");
  });

  it("incluye prefijo 'hueco_facturacion_'", () => {
    expect(buildHuecoCsvFilename(new Date("2025-01-01T00:00:00Z"))).toMatch(
      /^hueco_facturacion_/,
    );
  });

  it("huecoCsv: termina en '.csv'", () => {
    expect(buildHuecoCsvFilename(new Date("2025-01-01T00:00:00Z"))).toMatch(/\.csv$/);
  });

  it("la porción de fecha tiene formato YYYY-MM-DD", () => {
    const result = buildHuecoCsvFilename(new Date("2024-11-30T00:00:00Z"));
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

// ── buildHuecoCsvRows ───────────────────────────────────────────────────────
describe("huecoCsv · buildHuecoCsvRows", () => {
  it("devuelve arreglo vacío cuando filas es []", () => {
    expect(buildHuecoCsvRows([])).toEqual([]);
  });

  it("mapea correctamente los campos de una fila simple", () => {
    const fila = makeFilaHueco();
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.expediente).toBe("EXP-001");
    expect(row.cliente).toBe("Empresa SA");
    expect(row.operador).toBe("Juan Pérez");
  });

  it("huecoCsv: formatea ventaUsd con 2 decimales", () => {
    const fila = makeFilaHueco({ ventaUsd: 1234.5 });
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.venta_usd).toBe("1234.50");
  });

  it("formatea ventaMxn con 2 decimales", () => {
    const fila = makeFilaHueco({ ventaMxn: 9876 });
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.venta_mxn).toBe("9876.00");
  });

  it("bl_master es cadena vacía cuando es null", () => {
    const fila = makeFilaHueco({ bl_master: null });
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.bl_master).toBe("");
  });

  it("bl_house es cadena vacía cuando es null", () => {
    const fila = makeFilaHueco({ bl_house: null });
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.bl_house).toBe("");
  });

  it("huecoCsv: etd es cadena vacía cuando es null", () => {
    const fila = makeFilaHueco({ etd: null });
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.etd).toBe("");
  });

  it("dias_sin_facturar refleja diasDesdeEta", () => {
    const fila = makeFilaHueco({ diasDesdeEta: 42 });
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.dias_sin_facturar).toBe(42);
  });

  it("procesa múltiples filas correctamente", () => {
    const filas = [
      makeFilaHueco({ expediente: "EXP-A" }),
      makeFilaHueco({ expediente: "EXP-B" }),
    ];
    const rows = buildHuecoCsvRows(filas);
    expect(rows).toHaveLength(2);
    expect(rows[0].expediente).toBe("EXP-A");
    expect(rows[1].expediente).toBe("EXP-B");
  });
});
