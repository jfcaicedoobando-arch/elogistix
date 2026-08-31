/**
 * YG-03 · listado de Cotizaciones server-side.
 *
 * Cubre lo que el listado en memoria rompía cuando la org pasaba de 1000
 * cotizaciones: total real del servidor, rango de la última página, búsqueda
 * por folio antiguo (fuera del viejo tope) y exportación completa por lotes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Respuesta { data: unknown; count: number | null; error: unknown }

const estado = vi.hoisted(() => ({
  respuestas: [] as Respuesta[],
  llamadas: [] as Array<{ table: string; ops: Array<{ op: string; args: unknown[] }> }>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeChain = (table: string) => {
    const registro = { table, ops: [] as Array<{ op: string; args: unknown[] }> };
    estado.llamadas.push(registro);
    const chain: Record<string, unknown> = {};
    const paso = (op: string) => (...args: unknown[]) => {
      registro.ops.push({ op, args });
      return chain;
    };
    for (const op of ["select", "eq", "is", "in", "or", "not", "gte", "order", "limit"]) {
      chain[op] = paso(op);
    }
    chain.range = (...args: unknown[]) => {
      registro.ops.push({ op: "range", args });
      return Promise.resolve(estado.respuestas.shift() ?? { data: [], count: 0, error: null });
    };
    chain.then = (fn: (r: Respuesta) => unknown) =>
      Promise.resolve(estado.respuestas.shift() ?? { data: [], count: 0, error: null }).then(fn);
    return chain;
  };
  return { supabase: { from: (table: string) => makeChain(table) } };
});

const { fetchCotizacionesPaginadas, fetchTodasCotizacionesParaExportar, EXPORT_BATCH_SIZE } =
  await import("../paginados");

const FILTROS = {
  organizationId: "org-1",
  search: "",
  filterEstado: "todos",
  filterCliente: "todos",
  filterSinCostos: false,
  incluirInactivas: false,
  soloAceptadasSinEmbarque: false,
  segmento: "clientes" as const,
};

function filasFalsas(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${offset + i}`,
    folio: `COT-2024-${offset + i}`,
    cotizacion_costos: [{ count: 0 }],
  }));
}

function ops(indice = 0) {
  return estado.llamadas[indice].ops;
}

beforeEach(() => {
  estado.respuestas.length = 0;
  estado.llamadas.length = 0;
});

describe("fetchCotizacionesPaginadas", () => {
  it("devuelve el total del servidor, no el largo de la página", async () => {
    estado.respuestas.push({ data: filasFalsas(50), count: 1500, error: null });
    const res = await fetchCotizacionesPaginadas({ ...FILTROS, page: 0, pageSize: 50 });
    expect(res.count).toBe(1500);
    expect(res.rows).toHaveLength(50);
    expect(ops().find((o) => o.op === "range")?.args).toEqual([0, 49]);
  });

  it("pide el rango correcto de la ÚLTIMA página de 1500 filas", async () => {
    estado.respuestas.push({ data: filasFalsas(50, 1450), count: 1500, error: null });
    // 1500 filas / 50 = 30 páginas ⇒ la última es page 29 (filas 1450-1499),
    // que con el viejo tope de 1000 filas era inalcanzable.
    await fetchCotizacionesPaginadas({ ...FILTROS, page: 29, pageSize: 50 });
    expect(ops().find((o) => o.op === "range")?.args).toEqual([1450, 1499]);
  });

  it("manda la búsqueda por folio antiguo como filtro al servidor", async () => {
    estado.respuestas.push({
      data: [{ id: "viejo", folio: "COT-2021-0007", cotizacion_costos: [{ count: 0 }] }],
      count: 1,
      error: null,
    });
    const res = await fetchCotizacionesPaginadas({
      ...FILTROS,
      search: "COT-2021-0007",
      page: 0,
      pageSize: 50,
    });
    const or = ops().find((o) => o.op === "or");
    expect(String(or?.args[0])).toContain("COT-2021-0007");
    expect(res.rows[0].folio).toBe("COT-2021-0007");
  });

  it("propaga el error de Supabase en vez de devolver una lista vacía", async () => {
    estado.respuestas.push({ data: null, count: null, error: { message: "boom" } });
    await expect(
      fetchCotizacionesPaginadas({ ...FILTROS, page: 0, pageSize: 50 }),
    ).rejects.toMatchObject({ message: "boom" });
  });
});

describe("filtro Sin costos (YG-03)", () => {
  it("filtra en el servidor y muestra una candidata más allá de la fila 1000 con count exacto", async () => {
    // Fila 1200 del conjunto: con el viejo pre-filtrado topado a 1000 ids
    // jamás llegaba al listado.
    estado.respuestas.push({
      data: [{ id: "c1200", folio: "COT-2021-1200", cotizacion_costos: [] }],
      count: 1234,
      error: null,
    });
    const res = await fetchCotizacionesPaginadas({
      ...FILTROS,
      filterSinCostos: true,
      page: 24,
      pageSize: 50,
    });

    // Una sola consulta: no hay pre-resolución de ids en el cliente.
    expect(estado.llamadas).toHaveLength(1);
    expect(estado.llamadas[0].table).toBe("cotizaciones");
    // Nada de `.limit(...)` ni `.in("id", [...])` silenciosos.
    expect(ops().some((o) => o.op === "limit")).toBe(false);
    expect(ops().some((o) => o.op === "in")).toBe(false);
    // El filtro viaja al servidor: flag + ausencia de costos embebidos.
    expect(ops().some((o) => o.op === "eq" && o.args[0] === "sin_desglose_costos" && o.args[1] === true)).toBe(true);
    expect(ops().some((o) => o.op === "is" && o.args[0] === "cotizacion_costos" && o.args[1] === null)).toBe(true);
    expect(ops().find((o) => o.op === "range")?.args).toEqual([1200, 1249]);
    // Count exacto del servidor y la fila candidata presente.
    expect(res.count).toBe(1234);
    expect(res.rows[0].folio).toBe("COT-2021-1200");
    expect(res.rows[0].cotizacion_costos_count).toBe(0);
  });
});

describe("fetchTodasCotizacionesParaExportar", () => {
  it("itera por lotes hasta traer TODO lo filtrado (2300 filas en 3 lotes)", async () => {
    estado.respuestas.push(
      { data: filasFalsas(EXPORT_BATCH_SIZE, 0), count: 2300, error: null },
      { data: filasFalsas(EXPORT_BATCH_SIZE, 1000), count: 2300, error: null },
      { data: filasFalsas(300, 2000), count: 2300, error: null },
    );
    const filas = await fetchTodasCotizacionesParaExportar(FILTROS);
    expect(filas).toHaveLength(2300);
    const rangos = estado.llamadas
      .flatMap((l) => l.ops)
      .filter((o) => o.op === "range")
      .map((o) => o.args);
    expect(rangos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("no se cuelga cuando el servidor devuelve un lote vacío", async () => {
    estado.respuestas.push({ data: [], count: 10, error: null });
    const filas = await fetchTodasCotizacionesParaExportar(FILTROS);
    expect(filas).toHaveLength(0);
  });
});
