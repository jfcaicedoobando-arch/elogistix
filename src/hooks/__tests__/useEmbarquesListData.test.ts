import { describe, it, expect } from "vitest";

// Test the pure aggregation logic used by useEmbarquesLiquidacion and useEmbarquesDocsStatus.

interface CostoRow {
  embarque_id: string;
  estado_liquidacion: "Pendiente" | "Pagado";
}

interface DocRow {
  embarque_id: string;
  estado: "Pendiente" | "Recibido" | "Validado";
}

function buildLiquidacionMap(data: CostoRow[]) {
  const map: Record<string, { total: number; pagados: number }> = {};
  data.forEach((c) => {
    if (!map[c.embarque_id]) map[c.embarque_id] = { total: 0, pagados: 0 };
    map[c.embarque_id].total++;
    if (c.estado_liquidacion === "Pagado") map[c.embarque_id].pagados++;
  });
  return map;
}

function buildDocsStatusMap(data: DocRow[]) {
  const map: Record<string, { total: number; pendientes: number }> = {};
  data.forEach((d) => {
    if (!map[d.embarque_id]) map[d.embarque_id] = { total: 0, pendientes: 0 };
    map[d.embarque_id].total++;
    if (d.estado !== "Recibido" && d.estado !== "Validado") map[d.embarque_id].pendientes++;
  });
  return map;
}

describe("useEmbarquesListData aggregation logic", () => {
  describe("buildLiquidacionMap", () => {
    it("returns empty map for empty input", () => {
      expect(buildLiquidacionMap([])).toEqual({});
    });

    it("counts total and pagados per embarque", () => {
      const data: CostoRow[] = [
        { embarque_id: "e1", estado_liquidacion: "Pagado" },
        { embarque_id: "e1", estado_liquidacion: "Pendiente" },
        { embarque_id: "e1", estado_liquidacion: "Pagado" },
        { embarque_id: "e2", estado_liquidacion: "Pendiente" },
      ];
      const result = buildLiquidacionMap(data);
      expect(result["e1"]).toEqual({ total: 3, pagados: 2 });
      expect(result["e2"]).toEqual({ total: 1, pagados: 0 });
    });

    it("handles all pagados", () => {
      const data: CostoRow[] = [
        { embarque_id: "e1", estado_liquidacion: "Pagado" },
        { embarque_id: "e1", estado_liquidacion: "Pagado" },
      ];
      const result = buildLiquidacionMap(data);
      expect(result["e1"]).toEqual({ total: 2, pagados: 2 });
    });
  });

  describe("buildDocsStatusMap", () => {
    it("returns empty map for empty input", () => {
      expect(buildDocsStatusMap([])).toEqual({});
    });

    it("counts total and pendientes per embarque", () => {
      const data: DocRow[] = [
        { embarque_id: "e1", estado: "Pendiente" },
        { embarque_id: "e1", estado: "Recibido" },
        { embarque_id: "e1", estado: "Validado" },
        { embarque_id: "e2", estado: "Pendiente" },
        { embarque_id: "e2", estado: "Pendiente" },
      ];
      const result = buildDocsStatusMap(data);
      expect(result["e1"]).toEqual({ total: 3, pendientes: 1 });
      expect(result["e2"]).toEqual({ total: 2, pendientes: 2 });
    });

    it("counts zero pendientes when all received/validated", () => {
      const data: DocRow[] = [
        { embarque_id: "e1", estado: "Recibido" },
        { embarque_id: "e1", estado: "Validado" },
      ];
      const result = buildDocsStatusMap(data);
      expect(result["e1"]).toEqual({ total: 2, pendientes: 0 });
    });
  });
});
