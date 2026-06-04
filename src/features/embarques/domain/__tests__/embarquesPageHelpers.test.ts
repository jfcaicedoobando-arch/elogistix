import { describe, it, expect } from "vitest";
import {
  compareBy,
  computeCounts,
  resolveExtras,
  buildFullSetFilters,
  dedupePorExpediente,
  contenedoresPorExpediente,
} from "../embarquesPageHelpers";
import type { EmbarqueRow } from "@/features/embarques/types/embarque";

const row = (over: Partial<EmbarqueRow>): EmbarqueRow =>
  ({
    id: "x", expediente: "A", cliente_nombre: "", modo: "Marítimo",
    estado: "", etd: "", eta: "", operador: "", created_at: "",
    ...over,
  } as EmbarqueRow);

describe("embarquesPageHelpers", () => {
  it("compareBy ordena asc/desc por la clave indicada", () => {
    const a = row({ expediente: "A" });
    const b = row({ expediente: "B" });
    expect(compareBy(a, b, "expediente", "asc")).toBeLessThan(0);
    expect(compareBy(a, b, "expediente", "desc")).toBeGreaterThan(0);
    // Clave desconocida cae a expediente
    expect(compareBy(a, b, "no-existe" as string, "asc")).toBeLessThan(0);
  });

  it("dedupePorExpediente mantiene primero", () => {
    const rows = [
      row({ id: "1", expediente: "A" }),
      row({ id: "2", expediente: "A" }),
      row({ id: "3", expediente: "B" }),
    ];
    const out = dedupePorExpediente(rows);
    expect(out.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("contenedoresPorExpediente cuenta correctamente e ignora vacíos", () => {
    const rows = [
      row({ expediente: "A" }),
      row({ expediente: "A" }),
      row({ expediente: "" }),
      row({ expediente: "B" }),
    ];
    expect(contenedoresPorExpediente(rows)).toEqual({ A: 2, B: 1 });
  });

  it("computeCounts usa server o filtrado según estadoFilterActivo", () => {
    const base = {
      dedupedAll: [row({}), row({})],
      containersForView: [row({}), row({}), row({})],
      sortedAll: [row({}), row({})],
      pageSize: 10,
      totalCountServer: 100,
    };
    const off = computeCounts({ estadoFilterActivo: false, ...base });
    expect(off.expedientesCount).toBe(100);
    expect(off.contenedoresCount).toBe(100);
    expect(off.totalPages).toBe(10);
    const on = computeCounts({ estadoFilterActivo: true, ...base });
    expect(on.expedientesCount).toBe(2);
    expect(on.contenedoresCount).toBe(3);
    expect(on.totalPages).toBe(1);
  });

  it("resolveExtras escoge branchB cuando estado activo y branchA cuando no", () => {
    const a = { liquidacion: { x: 1 }, docs: {} } as never;
    const b = { liquidacion: { y: 2 }, docs: {} } as never;
    expect(resolveExtras(true, b, a)).toBe(b);
    expect(resolveExtras(false, b, a)).toBe(a);
    expect(resolveExtras(true, undefined, a).liquidacion).toEqual({});
  });

  it("buildFullSetFilters normaliza nulos a defaults", () => {
    const out = buildFullSetFilters({
      organizationId: null, search: null,
      filterModo: "todos", filterCliente: "todos", filterOperador: "todos",
      fechaDesde: "", fechaHasta: "",
    });
    expect(out.organizationId).toBeNull();
    expect(out.search).toBe("");
    expect(out.fechaDesde).toBeUndefined();
  });
});
