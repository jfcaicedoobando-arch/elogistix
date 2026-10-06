import { beforeEach, describe, expect, it, vi } from "vitest";

type RawRow = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tablas: {} as Record<string, RawRow[]>,
  calls: [] as Array<{ table: string; ops: Array<[string, ...unknown[]]> }>,
}));

/** Simula filtros y joins PostgREST sobre fixtures; no prefiltra las NC. */
function consulta(table: string) {
  const call = { table, ops: [] as Array<[string, ...unknown[]]> };
  db.calls.push(call);
  const filtros: Array<(row: RawRow) => boolean> = [];
  let desde = 0;
  let hasta = 999;
  let seleccion = "";
  const padre = (row: RawRow, relacion: string) => {
    const fk = relacion === "facturas" ? "factura_id" : "proveedor_factura_id";
    return db.tablas[relacion]?.find((p) => p.id === row[fk] && p.organization_id === "org-83");
  };
  const valor = (row: RawRow, campo: string) => {
    const [relacion, columna] = campo.split(".");
    return columna ? padre(row, relacion)?.[columna] : row[campo];
  };
  const b = {
    select: (s: string) => { seleccion = s; call.ops.push(["select", s]); return b; },
    eq: (c: string, v: unknown) => { call.ops.push(["eq", c, v]); filtros.push((r) => valor(r, c) === v); return b; },
    neq: (c: string, v: unknown) => { call.ops.push(["neq", c, v]); filtros.push((r) => valor(r, c) !== v); return b; },
    is: (c: string, v: unknown) => { call.ops.push(["is", c, v]); filtros.push((r) => valor(r, c) === v); return b; },
    in: (c: string, vs: unknown[]) => { call.ops.push(["in", c, vs]); filtros.push((r) => vs.includes(valor(r, c))); return b; },
    gte: (c: string, v: string) => { call.ops.push(["gte", c, v]); filtros.push((r) => String(valor(r, c)) >= v); return b; },
    lte: (c: string, v: string) => { call.ops.push(["lte", c, v]); filtros.push((r) => String(valor(r, c)) <= v); return b; },
    or: (s: string) => {
      call.ops.push(["or", s]);
      const inicio = s.match(/fecha_emision\.gte\.(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
      const fin = s.match(/fecha_emision\.lte\.(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
      filtros.push((r) => String(r.fecha_emision) >= inicio && String(r.fecha_emision) <= fin);
      return b;
    },
    order: (c: string) => { call.ops.push(["order", c]); return b; },
    range: (i: number, f: number) => { call.ops.push(["range", i, f]); desde = i; hasta = f; return b; },
    then: (resolve: (result: { data: RawRow[]; error: null }) => unknown) => {
      const relacion = seleccion.match(/(facturas|proveedor_facturas)!inner\(/)?.[1];
      const filas = (db.tablas[table] ?? [])
        .filter((r) => r.organization_id === "org-83" && filtros.every((f) => f(r)))
        .filter((r) => !relacion || padre(r, relacion))
        .sort((a, z) => String(a.id).localeCompare(String(z.id)))
        .slice(desde, hasta + 1);
      return Promise.resolve({ data: filas, error: null }).then(resolve);
    },
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => consulta(table) } }));
vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: vi.fn(async () => ({ usdMxn: 18, eurMxn: 23 })),
  EXCHANGE_RATES_FALLBACK: { usdMxn: 17.25, eurMxn: 18.5 },
}));
import { fetchEstadoResultadosDevengado, fetchEstadoResultadosDevengadoAnual } from "../estadoResultadosDevengado";

const params = { organizationId: "org-83", year: 2026, month: 10 };
const padreFixture = (id: string, deleted_at: string | null, fecha_emision = "2025-10-03") => ({
  id, organization_id: "org-83", deleted_at, fecha_emision, expediente: null, embarque_id: null,
  estado: "Pagada", estado_aprobacion: "aprobada", subtotal: 500, moneda: "MXN",
});
const ncFixture = (id: string, padreId: string) => ({
  id, factura_id: padreId, proveedor_factura_id: padreId, organization_id: "org-83", deleted_at: null,
  estado: "Aplicada", fecha_emision: "2026-10-03", fecha: "2026-10-03", folio: id,
  monto: 58, conceptos: [{ cantidad: 1, precio_unitario: 50 }], moneda: "MXN",
});

beforeEach(() => {
  db.tablas = { facturas: [], proveedor_facturas: [], factura_notas_credito: [], proveedor_notas_credito: [] };
  db.calls = [];
});

describe("AUD83: el EERR mensual/anual conserva la exclusión de NC con padre eliminado", () => {
  it("una NC Aplicada MXN50 de proveedor eliminado suma costo0, y cliente eliminado suma ingreso0", async () => {
    db.tablas.facturas = [padreFixture("f-borrada", "2026-10-01")];
    db.tablas.proveedor_facturas = [padreFixture("pf-borrada", "2026-10-01")];
    db.tablas.factura_notas_credito = [{ ...ncFixture("nc-borrada", "f-borrada"), conceptos: [] }];
    db.tablas.proveedor_notas_credito = [{ ...ncFixture("pnc-borrada", "pf-borrada"), monto: 50, subtotal: 50 }];
    const mensual = await fetchEstadoResultadosDevengado(params);
    const anual = await fetchEstadoResultadosDevengadoAnual(params);
    expect(mensual.totalIngresos.total).toBe(0);
    expect(mensual.totalCostos.total).toBe(0);
    expect(anual[9]).toEqual({ mes: 10, ingresos_mxn: 0, costos_mxn: 0 });
  });

  it.each(["2026-09-03", "2025-10-03"])("mantiene las NC del periodo con padre vivo de %s", async (fechaPadre) => {
    db.tablas.facturas = [padreFixture("f-viva", null, fechaPadre)];
    db.tablas.proveedor_facturas = [padreFixture("pf-viva", null, fechaPadre)];
    db.tablas.factura_notas_credito = [ncFixture("nc-viva", "f-viva")];
    db.tablas.proveedor_notas_credito = [{ ...ncFixture("pnc-viva", "pf-viva"), monto: 50, subtotal: 50 }];
    const mensual = await fetchEstadoResultadosDevengado(params);
    const [anual] = await fetchEstadoResultadosDevengadoAnual({ ...params, desdeMes: 10, hastaMes: 10 });
    expect(mensual.totalIngresos.total).toBe(-50);
    expect(mensual.totalCostos.total).toBe(-50);
    expect(anual).toEqual({ mes: 10, ingresos_mxn: -50, costos_mxn: -50 });
    for (const table of ["factura_notas_credito", "proveedor_notas_credito"]) {
      const relacion = table === "factura_notas_credito" ? "facturas" : "proveedor_facturas";
      for (const call of db.calls.filter((c) => c.table === table)) {
        expect(call.ops).toContainEqual(["is", `${relacion}.deleted_at`, null]);
        expect(call.ops.some(([, campo]) => String(campo).startsWith(`${relacion}.fecha`))).toBe(false);
        expect(call.ops.some(([, campo]) => campo === `${relacion}.estado`)).toBe(false);
      }
    }
  });

  it("excluye padres de otra organización y NC propias eliminadas", async () => {
    db.tablas.facturas = [{ ...padreFixture("f-otra-org", null), organization_id: "otra-org" }, padreFixture("f-viva", null)];
    db.tablas.proveedor_facturas = [{ ...padreFixture("pf-otra-org", null), organization_id: "otra-org" }, padreFixture("pf-viva", null)];
    db.tablas.factura_notas_credito = [ncFixture("nc-otra-org", "f-otra-org"), { ...ncFixture("nc-borrada", "f-viva"), deleted_at: "2026-10-04" }];
    db.tablas.proveedor_notas_credito = [ncFixture("pnc-otra-org", "pf-otra-org"), { ...ncFixture("pnc-borrada", "pf-viva"), deleted_at: "2026-10-04" }];
    const mensual = await fetchEstadoResultadosDevengado(params);
    const [anual] = await fetchEstadoResultadosDevengadoAnual({ ...params, desdeMes: 10, hastaMes: 10 });
    expect(mensual.totalIngresos.total).toBe(0);
    expect(mensual.totalCostos.total).toBe(0);
    expect(anual).toEqual({ mes: 10, ingresos_mxn: 0, costos_mxn: 0 });
  });
});
