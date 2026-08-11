/**
 * v13.502.0 — Badge del sidebar: conteo de documentos del buzón por capturar.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const llamadas: string[] = [];
let respuesta: { count: number | null; error: unknown } = { count: 3, error: null };

function builder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  const chain = (nombre: string) => (...args: unknown[]) => {
    llamadas.push(`${nombre}:${JSON.stringify(args)}`);
    return b;
  };
  for (const m of ["eq", "is"]) b[m] = chain(m);
  b.select = (...args: unknown[]) => {
    llamadas.push(`select:${JSON.stringify(args)}`);
    return b;
  };
  b.then = (resolve: (v: unknown) => unknown) => resolve(respuesta);
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => { llamadas.push(`from:${t}`); return builder(); } },
}));

const { fetchEntrantesPorCapturarCount } = await import("../facturasEntrantesCount");

describe("fetchEntrantesPorCapturarCount", () => {
  beforeEach(() => {
    llamadas.length = 0;
    respuesta = { count: 3, error: null };
  });

  it("cuenta sólo documentos por capturar y no eliminados", async () => {
    await expect(fetchEntrantesPorCapturarCount()).resolves.toBe(3);
    expect(llamadas).toContain("from:embarque_facturas_entrantes");
    expect(llamadas.some((c) => c.includes('"count":"exact"') && c.includes('"head":true'))).toBe(true);
    expect(llamadas).toContain('eq:["estado","por_capturar"]');
    expect(llamadas).toContain('is:["deleted_at",null]');
  });

  it("devuelve 0 cuando el count viene nulo", async () => {
    respuesta = { count: null, error: null };
    await expect(fetchEntrantesPorCapturarCount()).resolves.toBe(0);
  });

  it("propaga el error de la consulta", async () => {
    respuesta = { count: null, error: new Error("boom") };
    await expect(fetchEntrantesPorCapturarCount()).rejects.toThrow("boom");
  });
});
