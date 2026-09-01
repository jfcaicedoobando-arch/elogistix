/**
 * Ola de exactitud financiera (v13.823.5): `loadCarteraAbierta` debe traer sólo
 * NC realmente aplicadas y vigentes (no borrador/cancelada/eliminada).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Filtro = { op: string; args: unknown[] };

const llamadas: Array<{ tabla: string; filtros: Filtro[] }> = [];
const datosPorTabla = new Map<string, unknown[]>();

function builder(tabla: string) {
  const filtros: Filtro[] = [];
  const registro = { tabla, filtros };
  llamadas.push(registro);
  const api: Record<string, unknown> = {};
  for (const op of ["select", "in", "eq", "is", "limit", "order", "neq", "or", "not", "gte"]) {
    api[op] = (...args: unknown[]) => { filtros.push({ op, args }); return api; };
  }
  api.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: datosPorTabla.get(tabla) ?? [], error: null }).then(resolve);
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (tabla: string) => builder(tabla) },
}));

import { loadCarteraAbierta } from "../loaders";

describe("loadCarteraAbierta", () => {
  beforeEach(() => {
    llamadas.length = 0;
    datosPorTabla.clear();
  });

  it("devuelve listas vacías cuando no hay facturas abiertas", async () => {
    const out = await loadCarteraAbierta("org-1");
    expect(out).toEqual({ facturas: [], pagos: [], ncs: [] });
  });

  it("consulta NC sólo con estado Aplicada y sin eliminar", async () => {
    datosPorTabla.set("facturas", [{ id: "f1", total: 1000, moneda: "MXN", estado: "Emitida" }]);
    datosPorTabla.set("pagos_factura", [{ factura_id: "f1", monto_aplicado_factura: 200, moneda: "MXN", tipo_cambio: null, fecha_pago: "2026-01-05" }]);
    datosPorTabla.set("factura_notas_credito", [{ factura_id: "f1", monto: 300, moneda: "MXN", tipo_cambio: null }]);

    const out = await loadCarteraAbierta("org-1");
    expect(out.ncs).toHaveLength(1);
    expect(out.pagos).toHaveLength(1);

    const nc = llamadas.find((l) => l.tabla === "factura_notas_credito")!;
    expect(nc.filtros).toEqual(expect.arrayContaining([
      { op: "eq", args: ["estado", "Aplicada"] },
      { op: "is", args: ["deleted_at", null] },
    ]));
  });
});
