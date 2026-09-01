/**
 * `fetchAgenteEmbarques` terminaba en `.limit(200)`: los embarques 201+
 * desaparecían del historial del agente sin aviso. Ahora se leen lotes
 * consecutivos hasta uno incompleto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Fila { id: string; etd: string | null }

const estado = {
  filas: [] as Fila[],
  rangos: [] as Array<[number, number]>,
  ordenes: [] as string[],
  errorEnLote: null as number | null,
};

function toRow(f: Fila) {
  return {
    id: f.id, expediente: `EXP-${f.id}`, modo: "Marítimo", estado: "En Tránsito",
    bl_master: null, puerto_origen: "Shanghái", puerto_destino: "Manzanillo",
    etd: f.etd, eta: null,
  };
}

function builder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  let rango: [number, number] = [0, 999];
  const chain = (nombre: string) => (...args: unknown[]) => {
    if (nombre === "range") {
      rango = [args[0] as number, args[1] as number];
      estado.rangos.push(rango);
    }
    if (nombre === "order") estado.ordenes.push(String(args[0]));
    return b;
  };
  for (const m of ["select", "is", "order", "range", "eq", "neq"]) b[m] = chain(m);
  b.then = (resolve: (v: unknown) => unknown) => {
    const loteIdx = estado.rangos.length - 1;
    if (estado.errorEnLote === loteIdx) {
      return resolve({ data: null, error: { message: "lote roto" } });
    }
    const ordenadas = [...estado.filas].sort(
      (a, z) => (z.etd ?? "").localeCompare(a.etd ?? "") || a.id.localeCompare(z.id),
    );
    return resolve({ data: ordenadas.slice(rango[0], rango[1] + 1).map(toRow), error: null });
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => builder(), rpc: vi.fn(), auth: { getSession: vi.fn() } },
}));

const { fetchAgenteEmbarques } = await import("../agenteQueries");

function generar(n: number, etd: (i: number) => string | null): Fila[] {
  return Array.from({ length: n }, (_, i) => ({ id: `e${String(i).padStart(5, "0")}`, etd: etd(i) }));
}

beforeEach(() => {
  estado.filas = [];
  estado.rangos = [];
  estado.ordenes = [];
  estado.errorEnLote = null;
});

describe("fetchAgenteEmbarques — historial completo", () => {
  it("con 250 embarques devuelve los 250 (antes se cortaba en 200)", async () => {
    estado.filas = generar(250, (i) => `2026-01-${String((i % 28) + 1).padStart(2, "0")}`);
    const rows = await fetchAgenteEmbarques();
    expect(rows).toHaveLength(250);
    expect(rows.slice(200)).toHaveLength(50);
  });

  it("varios lotes con ETD iguales: sin duplicados ni omisiones", async () => {
    estado.filas = generar(2100, () => "2026-03-10");
    const rows = await fetchAgenteEmbarques();
    const ids = rows.map((r) => r.id);
    expect(ids).toHaveLength(2100);
    expect(new Set(ids).size).toBe(2100);
    expect(estado.ordenes).toEqual(expect.arrayContaining(["etd", "id"]));
    expect(estado.rangos.length).toBeGreaterThanOrEqual(3);
  });

  it("embarques del agente: un error en un lote posterior se propaga (nada parcial como completo)", async () => {
    estado.filas = generar(1500, () => null);
    estado.errorEnLote = 1;
    await expect(fetchAgenteEmbarques()).rejects.toMatchObject({ message: "lote roto" });
  });
});
