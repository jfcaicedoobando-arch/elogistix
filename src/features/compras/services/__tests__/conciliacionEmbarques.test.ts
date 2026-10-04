/**
 * `listarConciliacionEmbarques` — lee TODOS los `conceptos_costo` activos en
 * lotes consecutivos de 1000 (patrón `fetchFacturasCxP`/`cxpLotesCompletos`).
 * Estas pruebas fijan el contrato con más de 5000 filas (varios lotes) y el
 * fallo explícito al alcanzar `CAP_LOTES_DURO`: nunca se suma dinero sobre
 * un subconjunto presentado como total.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";

interface Fila {
  id: string;
  embarque_id: string;
  monto: number;
  moneda: "MXN" | "USD" | "EUR";
  estado_liquidacion: "Pendiente" | "Pagado";
}

const estado = {
  filas: [] as Fila[],
  rangos: [] as Array<[number, number]>,
  errorEnLote: null as number | null,
  facturados: new Set<string>(),
};

function toJoined(f: Fila) {
  return {
    id: f.id,
    embarque_id: f.embarque_id,
    monto: f.monto,
    moneda: f.moneda,
    estado_liquidacion: f.estado_liquidacion,
    embarques: { expediente: `EXP-${f.embarque_id}`, cliente_nombre: "Cliente 1", estado: "En tránsito" },
  };
}

/** Mock que simula el servidor: ordena por `id` y corta por rango como Postgres. */
function builder(table: string): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  let rango: [number, number] = [0, 999];
  let ids: string[] = [];
  const chain = (nombre: string) => (...args: unknown[]) => {
    if (nombre === "range") {
      rango = [args[0] as number, args[1] as number];
      if (table === "conceptos_costo") estado.rangos.push(rango);
    }
    if (nombre === "in") ids = args[1] as string[];
    return b;
  };
  for (const m of ["select", "is", "eq", "in", "order", "range"]) b[m] = chain(m);
  b.then = (resolve: (v: unknown) => unknown) => {
    const loteIdx = estado.rangos.length - 1;
    if (table === "conceptos_costo" && estado.errorEnLote === loteIdx) {
      return resolve({ data: null, error: { message: "lote roto" } });
    }
    const ordenadas = [...estado.filas].sort((a, z) => a.id.localeCompare(z.id));
    if (table === "proveedor_facturas_conceptos") return resolve({
      data: ordenadas.filter((f) => ids.includes(f.id) && estado.facturados.has(f.id)).map((f) => ({
        monto: f.monto, concepto_costo_id: f.id,
        proveedor_facturas: { id: `f-${f.id}`, folio_proveedor: "F", estado_aprobacion: "aprobada", moneda: f.moneda, deleted_at: null },
      })).slice(rango[0], rango[1] + 1), error: null,
    });
    const page = ordenadas.slice(rango[0], rango[1] + 1).map(toJoined);
    return resolve({ data: page, error: null });
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table) } }));

const { listarConciliacionEmbarques } = await import("../conciliacionEmbarques");
const { ResultadoTruncadoError } = await import("@/lib/supabase/assertNotTruncated");

function generar(n: number, over: (i: number) => Partial<Fila> = () => ({})): Fila[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${String(i).padStart(6, "0")}`,
    embarque_id: `e${i % 20}`,
    monto: 100,
    moneda: "MXN" as const,
    estado_liquidacion: "Pendiente" as const,
    ...over(i),
  }));
}

beforeEach(() => {
  estado.filas = [];
  estado.rangos = [];
  estado.errorEnLote = null;
  estado.facturados.clear();
});

describe("listarConciliacionEmbarques — lectura completa por lotes", () => {
  it("con más de 5000 conceptos activos, agrega TODOS sin cortar en el primer lote", async () => {
    // 5200 conceptos repartidos en 20 embarques: 260 conceptos c/u, $100 c/u.
    estado.filas = generar(5200);
    const rows = await listarConciliacionEmbarques({});
    expect(estado.rangos.length).toBeGreaterThanOrEqual(6); // 6 lotes de 1000
    const totalConceptos = rows.reduce((a, r) => a + r.conceptos_total, 0);
    expect(totalConceptos).toBe(5200);
    const totalPresupuestado = rows.reduce((a, r) => a + r.presupuestado, 0);
    expect(totalPresupuestado).toBeCloseTo(5200 * 100, 2);
  });

  it("calcula facturación impagada correctamente después del primer lote", async () => {
    estado.filas = generar(5200);
    estado.facturados = new Set(estado.filas.slice(5100).map((fila) => fila.id));
    const rows = await listarConciliacionEmbarques({});
    const totalFacturado = rows.reduce((a, r) => a + r.facturado, 0);
    expect(totalFacturado).toBeCloseTo(100 * 100, 2);
  });

  it("falla explícitamente con ResultadoTruncadoError al superar el tope duro", async () => {
    estado.filas = generar(CAP_LOTES_DURO + 500);
    await expect(listarConciliacionEmbarques({})).rejects.toBeInstanceOf(ResultadoTruncadoError);
  });

  it("conciliación: un error en un lote posterior se propaga (nada parcial como completo)", async () => {
    estado.filas = generar(2500);
    estado.errorEnLote = 1; // el segundo lote falla
    await expect(listarConciliacionEmbarques({})).rejects.toMatchObject({ message: "lote roto" });
  });
});
