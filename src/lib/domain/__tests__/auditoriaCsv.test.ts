import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportHallazgosCsv } from "@/lib/domain/auditoriaCsv";
import * as exportCsvMod from "@/generators/exportCsv";
import type { HallazgoAuditoria } from "@/types/auditoria";

describe("exportHallazgosCsv", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("genera nombre de archivo con fecha ISO y delega filas mapeadas", () => {
    const spy = vi.spyOn(exportCsvMod, "exportToCsv").mockImplementation(() => {});
    const hallazgos = [
      {
        severidad: "alta",
        expediente: "EXP-1",
        regla: "doc_faltante",
        cliente_nombre: "ACME",
        modo: "Marítimo",
        estado: "abierto",
        eta: "2026-01-10",
        detalle: "Falta BL",
        documentos_faltantes: ["BL", "Factura"],
      },
    ] as unknown as HallazgoAuditoria[];

    exportHallazgosCsv(hallazgos);

    expect(spy).toHaveBeenCalledTimes(1);
    const [filename, cols, rows] = spy.mock.calls[0];
    expect(filename).toMatch(/^auditoria_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(cols.map((c: { key: string }) => c.key)).toEqual([
      "severidad", "expediente", "regla", "cliente", "modo", "estado", "eta", "detalle", "documentos_faltantes",
    ]);
    expect(rows[0].cliente).toBe("ACME");
    expect(rows[0].documentos_faltantes).toBe("BL | Factura");
  });

  it("normaliza cliente y documentos vacíos", () => {
    const spy = vi.spyOn(exportCsvMod, "exportToCsv").mockImplementation(() => {});
    exportHallazgosCsv([
      {
        severidad: "baja",
        expediente: "EXP-2",
        regla: "x",
        cliente_nombre: null,
        modo: "Aéreo",
        estado: "cerrado",
        eta: null,
        detalle: "-",
        documentos_faltantes: null,
      },
    ] as unknown as HallazgoAuditoria[]);
    const [, , rows] = spy.mock.calls[0];
    expect(rows[0].cliente).toBe("");
    expect(rows[0].eta).toBe("");
    expect(rows[0].documentos_faltantes).toBe("");
  });
});
