/**
 * v13.501.0 — Regresión: el listado de CxP ocultaba SIEMPRE las facturas
 * canceladas, así que buscar el folio FP-000042 (cancelada) no devolvía nada y
 * el filtro "Cancelada" salía vacío. Ahora sólo se ocultan por defecto.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const llamadas: string[] = [];

function builder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  const chain = (nombre: string) => (...args: unknown[]) => {
    llamadas.push(`${nombre}:${JSON.stringify(args[0] ?? null)}`);
    return b;
  };
  for (const m of ["select", "is", "neq", "eq", "or", "gte", "lte", "order", "range", "in"]) {
    b[m] = chain(m);
  }
  b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], count: 0, error: null });
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => builder() },
}));

const { fetchFacturasCxP } = await import("../proveedorFacturas");

describe("fetchFacturasCxP y facturas canceladas", () => {
  beforeEach(() => {
    llamadas.length = 0;
  });

  it("por defecto excluye las canceladas", async () => {
    await fetchFacturasCxP({});
    expect(llamadas.some((c) => c.startsWith('neq:"estado"'))).toBe(true);
  });

  it("las incluye al filtrar por estatus Cancelada", async () => {
    await fetchFacturasCxP({ estatus: "Cancelada" });
    expect(llamadas.some((c) => c.startsWith('neq:"estado"'))).toBe(false);
  });

  it("las incluye al buscar texto (p. ej. FP-000042)", async () => {
    await fetchFacturasCxP({ search: "FP-000042" });
    expect(llamadas.some((c) => c.startsWith('neq:"estado"'))).toBe(false);
  });
});
