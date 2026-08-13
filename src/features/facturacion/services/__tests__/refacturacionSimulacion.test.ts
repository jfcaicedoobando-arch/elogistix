import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { simularPasoRefacturacion } from "@/features/facturacion/services/refacturacionSimulacion";

describe("simularPasoRefacturacion", () => {
  beforeEach(() => rpc.mockReset());

  it("mapea acciones, reasignación y saldos de la RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        paso: 5,
        cancela: [],
        crea: [{ tipo: "rep", etiqueta: "Nuevo REP", detalle: null, monto: 1000, moneda: "MXN" }],
        reasigna: { pago_fecha: "2026-08-13", de: "FA-1", a: "FA-2", monto: 1000, moneda: "MXN", ordenante_nombre: "ACME", ordenante_rfc: null },
        saldos: [{ concepto: "Factura FA-1", antes: 0, despues: 0, moneda: "MXN", nota: "Cancelada" }],
        bloqueos: [],
      },
      error: null,
    });

    const sim = await simularPasoRefacturacion("caso-1", 5);
    expect(rpc).toHaveBeenCalledWith("refacturacion_simular_paso", { p_caso_id: "caso-1", p_paso: 5 });
    expect(sim.crea).toHaveLength(1);
    expect(sim.reasigna?.a).toBe("FA-2");
    expect(sim.saldos[0].concepto).toBe("Factura FA-1");
    expect(sim.bloqueos).toEqual([]);
  });

  it("devuelve listas vacías cuando la RPC no trae datos", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const sim = await simularPasoRefacturacion("caso-1", 2);
    expect(sim).toMatchObject({ paso: 2, cancela: [], crea: [], reasigna: null, saldos: [], bloqueos: [] });
  });

  it("propaga el error de la RPC de simulación de refacturación", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("LC_REFACT_FORBIDDEN") });
    await expect(simularPasoRefacturacion("caso-1", 2)).rejects.toThrow("LC_REFACT_FORBIDDEN");
  });

  it("los bloqueos llegan con su código LC para traducirse en la UI", async () => {
    rpc.mockResolvedValue({ data: { bloqueos: ["LC_REFACT_REP_VIVO"], saldos: [] }, error: null });
    const sim = await simularPasoRefacturacion("caso-1", 4);
    expect(sim.bloqueos).toContain("LC_REFACT_REP_VIVO");
  });
});
