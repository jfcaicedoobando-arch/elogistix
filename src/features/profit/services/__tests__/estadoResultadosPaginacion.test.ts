/**
 * DEFECTO 7: `fetchEstadoResultadosMes` no debe truncar resultados por el
 * tope implícito de PostgREST ni presentar un total parcial como exacto, y
 * debe excluir estados no financieros (Cotización/Borrador) además de
 * Cancelado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface EmbFila { id: string; estado: string; eta: string }

const estado = {
  embarques: [] as EmbFila[],
  rangos: [] as Array<[number, number]>,
  notIn: [] as unknown[],
};

function embarquesBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  let rango: [number, number] = [0, 999];
  const chain = (nombre: string) => (...args: unknown[]) => {
    if (nombre === "range") { rango = [args[0] as number, args[1] as number]; estado.rangos.push(rango); }
    if (nombre === "not") estado.notIn.push(args);
    return b;
  };
  for (const m of ["select", "gte", "lte", "not", "is", "eq", "order", "range"]) b[m] = chain(m);
  b.then = (resolve: (v: unknown) => unknown) => {
    const ordenadas = [...estado.embarques].sort((a, z) => a.id.localeCompare(z.id));
    const page = ordenadas.slice(rango[0], rango[1] + 1);
    return resolve({ data: page, error: null });
  };
  return b;
}

function vacioBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in", "is", "order", "range"]) b[m] = () => b;
  b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => (table === "embarques" ? embarquesBuilder() : vacioBuilder()),
  },
}));

const { fetchEstadoResultadosMes } = await import("../estadoResultados");

function generar(n: number, over: (i: number) => Partial<EmbFila> = () => ({})): EmbFila[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${String(i).padStart(5, "0")}`,
    estado: "Confirmado",
    eta: "2026-01-15",
    ...over(i),
  }));
}

beforeEach(() => {
  estado.embarques = [];
  estado.rangos = [];
  estado.notIn = [];
});

describe("fetchEstadoResultadosMes — paginación y exactitud contable", () => {
  it("con más de un lote (1000) de embarques trae TODOS, no sólo el primero", async () => {
    estado.embarques = generar(1500);
    const res = await fetchEstadoResultadosMes({ organizationId: null, year: 2026, month: 1 });
    // buildEstadoResultados real corre; sólo validamos que se leyeron ambos lotes.
    expect(estado.rangos.length).toBeGreaterThanOrEqual(2);
    expect(res).toBeDefined();
  });

  it("si se excede el tope duro de lotes, falla explícito con código LC_ (nunca parcial)", async () => {
    // 50 lotes de 1000 no bastan: se generan filas "infinitas" (siempre lote completo).
    estado.embarques = generar(60_000);
    await expect(
      fetchEstadoResultadosMes({ organizationId: null, year: 2026, month: 1 }),
    ).rejects.toThrow(/LC_ESTADO_RESULTADOS_LIMITE_EXCEDIDO/);
  });

  it("excluye estados no financieros (Cotización/Borrador) además de Cancelado", async () => {
    estado.embarques = generar(3);
    await fetchEstadoResultadosMes({ organizationId: null, year: 2026, month: 1 });
    expect(estado.notIn).toContainEqual(["estado", "in", "(Cotización,Borrador,Cancelado)"]);
  });
});
