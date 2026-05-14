import { describe, it, expect } from "vitest";
import {
  REGLAS_AUDITORIA,
  agruparPorRegla,
  contarPorSeveridad,
  filtrarHallazgos,
  isSnoozeActivo,
  isoDate,
  minSnoozeDate,
} from "@/lib/domain/auditoria";
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";

const h = (over: Partial<HallazgoAuditoria> = {}): HallazgoAuditoria => ({
  embarque_id: "e1",
  expediente: "EXP-1",
  cliente_nombre: "ACME",
  modo: "Marítimo",
  estado: "En tránsito",
  eta: null,
  regla: "docs_faltantes",
  severidad: "medio",
  detalle: "",
  documentos_faltantes: [],
  ...over,
});

describe("lib/domain/auditoria", () => {
  describe("isoDate", () => {
    it("formatea YYYY-MM-DD", () => {
      expect(isoDate(new Date("2026-05-14T10:00:00Z"))).toBe("2026-05-14");
    });
  });

  describe("minSnoozeDate", () => {
    it("devuelve el día siguiente al `from`", () => {
      expect(minSnoozeDate(new Date("2026-05-14T10:00:00Z"))).toBe("2026-05-15");
    });
    it("avanza correctamente fin de mes", () => {
      expect(minSnoozeDate(new Date("2026-01-31T10:00:00Z"))).toBe("2026-02-01");
    });
  });

  describe("isSnoozeActivo", () => {
    it("false si no hay snooze", () => {
      expect(isSnoozeActivo(null)).toBe(false);
      expect(isSnoozeActivo(undefined)).toBe(false);
      expect(isSnoozeActivo("")).toBe(false);
    });
    it("true si snoozedUntil >= today", () => {
      expect(isSnoozeActivo("2026-05-14", "2026-05-14")).toBe(true);
      expect(isSnoozeActivo("2026-05-15", "2026-05-14")).toBe(true);
    });
    it("false si snoozedUntil < today", () => {
      expect(isSnoozeActivo("2026-05-13", "2026-05-14")).toBe(false);
    });
  });

  describe("contarPorSeveridad", () => {
    it("siempre devuelve las 3 llaves", () => {
      expect(contarPorSeveridad([])).toEqual({ critico: 0, alto: 0, medio: 0 });
    });
    it("cuenta correctamente", () => {
      const list = [
        h({ severidad: "critico" }),
        h({ severidad: "critico" }),
        h({ severidad: "alto" }),
        h({ severidad: "medio" }),
      ];
      expect(contarPorSeveridad(list)).toEqual({ critico: 2, alto: 1, medio: 1 });
    });
  });

  describe("agruparPorRegla", () => {
    it("garantiza un array por cada regla conocida", () => {
      const result = agruparPorRegla([]);
      for (const r of REGLAS_AUDITORIA) {
        expect(result[r]).toEqual([]);
      }
    });
    it("agrupa hallazgos en su regla", () => {
      const list = [
        h({ regla: "docs_faltantes" }),
        h({ regla: "margen_negativo" }),
        h({ regla: "docs_faltantes" }),
      ];
      const result = agruparPorRegla(list);
      expect(result.docs_faltantes).toHaveLength(2);
      expect(result.margen_negativo).toHaveLength(1);
      expect(result.fechas).toEqual([]);
    });
  });

  describe("filtrarHallazgos", () => {
    const sample = [
      h({ embarque_id: "1", severidad: "critico", modo: "Marítimo" }),
      h({ embarque_id: "2", severidad: "medio", modo: "Aéreo" }),
      h({ embarque_id: "3", severidad: "critico", modo: "Aéreo" }),
    ];
    it("'todas'/'todos' no filtra", () => {
      expect(filtrarHallazgos(sample, {})).toHaveLength(3);
      expect(
        filtrarHallazgos(sample, { severidad: "todas", modo: "todos" }),
      ).toHaveLength(3);
    });
    it("filtra por severidad", () => {
      const r = filtrarHallazgos(sample, { severidad: "critico" });
      expect(r.map((x) => x.embarque_id)).toEqual(["1", "3"]);
    });
    it("filtra por modo", () => {
      const r = filtrarHallazgos(sample, { modo: "Aéreo" });
      expect(r.map((x) => x.embarque_id)).toEqual(["2", "3"]);
    });
    it("combina filtros", () => {
      const r = filtrarHallazgos(sample, {
        severidad: "critico" as SeveridadAuditoria,
        modo: "Aéreo",
      });
      expect(r.map((x) => x.embarque_id)).toEqual(["3"]);
    });
  });

  it("REGLAS_AUDITORIA cubre el tipo ReglaAuditoria", () => {
    const expected: ReglaAuditoria[] = [
      "docs_faltantes",
      "docs_pendientes_avanzado",
      "fechas",
      "ventas_sin_facturar",
      "margen_negativo",
      "margen_bajo",
      "venta_sin_costo",
      "costo_sin_venta",
      "proforma_vencida",
      "embarque_huerfano",
    ];
    expect(REGLAS_AUDITORIA.sort()).toEqual(expected.sort());
  });
});
