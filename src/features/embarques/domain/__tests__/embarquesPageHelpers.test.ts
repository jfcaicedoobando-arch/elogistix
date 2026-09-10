import { describe, it, expect } from "vitest";
import {
  compareBy,
  computeCounts,
  resolveExtras,
  buildFullSetFilters,
  dedupePorExpediente,
  contenedoresPorExpediente,
  buildEmbarquesDescription,
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
    // El getter de "expediente" extrae los dígitos del folio (ELNAC-001 → 1),
    // por eso usamos expedientes con consecutivos distintos.
    const a = row({ expediente: "ELNAC-001" });
    const b = row({ expediente: "ELNAC-002" });
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
    expect(off.paginationTotal).toBe(100);
    const on = computeCounts({ estadoFilterActivo: true, ...base });
    expect(on.expedientesCount).toBe(2);
    expect(on.contenedoresCount).toBe(3);
    expect(on.totalPages).toBe(1);
    expect(on.paginationTotal).toBe(2);
  });

  it("computeCounts: filtro Borrador (4 filas) => paginación 1–4 de 4", () => {
    // Regresión 13.823.269: con Estado=Borrador el pie decía "1–7 de 7"
    // (total global sin filtrar) aunque la tabla mostraba 4 expedientes.
    const cuatro = [row({ id: "1" }), row({ id: "2" }), row({ id: "3" }), row({ id: "4" })];
    const r = computeCounts({
      estadoFilterActivo: true,
      dedupedAll: cuatro,
      containersForView: cuatro,
      sortedAll: cuatro,
      pageSize: 50,
      totalCountServer: 7,
    });
    expect(r.paginationTotal).toBe(4);
    expect(r.totalPages).toBe(1);
    expect(r.expedientesCount).toBe(4);
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

describe("buildEmbarquesDescription", () => {
  // Hallazgo P2 (13.823.270): "En Tránsito" con 1 expediente que tiene 2
  // contenedores se anunciaba como "1 contenedor en 1 expediente".
  it("con filtro de estado sólo cuenta expedientes", () => {
    expect(buildEmbarquesDescription(1, true)).toBe("1 expediente");
    expect(buildEmbarquesDescription(4, true)).toBe("4 expedientes");
    expect(buildEmbarquesDescription(1, true)).not.toContain("contenedor");
  });

  it("sin filtro de estado conserva el conteo de embarques", () => {
    expect(buildEmbarquesDescription(1, false)).toBe("1 embarque");
    expect(buildEmbarquesDescription(7, false)).toBe("7 embarques");
  });
});
