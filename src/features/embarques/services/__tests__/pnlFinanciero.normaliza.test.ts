/**
 * P2-5 (R5): el desglose de ingresos de la RPC llega con la llave
 * `presupuestada_mxn`; el front usa `presupuestado_mxn`. Sin normalizar, la
 * tabla mostraba 0 y no cuadraba con el KPI del encabezado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { fetchPnlEmbarque } from "../pnlFinanciero";

describe("fetchPnlEmbarque · normalización del desglose", () => {
  beforeEach(() => rpc.mockReset());

  it("mapea presupuestada_mxn (ingresos) a presupuestado_mxn", async () => {
    rpc.mockResolvedValue({
      data: {
        embarque_id: "e1",
        venta: { presupuestada_mxn: 1000, real_mxn: 900, pdte_cobro_mxn: 100 },
        por_concepto: [{ concepto: "flete", presupuestada_mxn: 1000, real_mxn: 900 }],
        por_concepto_costo: [{ concepto: "flete", presupuestado_mxn: 700, real_mxn: 750 }],
      },
      error: null,
    });

    const pnl = await fetchPnlEmbarque("e1");
    expect(pnl.por_concepto[0].presupuestado_mxn).toBe(1000);
    expect(pnl.por_concepto[0].desviacion_mxn).toBe(-100);
    expect(pnl.por_concepto_costo[0].presupuestado_mxn).toBe(700);
  });

  it("tolera arrays ausentes o filas nulas", async () => {
    rpc.mockResolvedValue({ data: { embarque_id: "e1", por_concepto: null }, error: null });
    const pnl = await fetchPnlEmbarque("e1");
    expect(pnl.por_concepto).toEqual([]);
  });
});
