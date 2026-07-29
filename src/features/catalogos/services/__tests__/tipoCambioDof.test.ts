/**
 * Tests del servicio de historial Tipo de Cambio DOF.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const orderMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: orderMock }),
    }),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { fetchHistorialTcDof, upsertTcDofManual } from "../tipoCambioDof";

describe("tipoCambioDof service", () => {
  beforeEach(() => {
    orderMock.mockReset();
    rpcMock.mockReset();
  });

  it("devuelve el historial ordenado que entrega la BD", async () => {
    const filas = [{ fecha: "2026-07-29", usd_mxn: 17.4312, eur_mxn: 19.9389, fuente: "banxico_sie", origen: "cron", updated_at: "x" }];
    orderMock.mockReturnValue({ limit: () => Promise.resolve({ data: filas, error: null }) });
    await expect(fetchHistorialTcDof(10)).resolves.toEqual(filas);
  });

  it("devuelve arreglo vacío si la BD no regresa datos", async () => {
    orderMock.mockReturnValue({ limit: () => Promise.resolve({ data: null, error: null }) });
    await expect(fetchHistorialTcDof()).resolves.toEqual([]);
  });

  it("acota el límite al rango permitido", async () => {
    const limitSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    orderMock.mockReturnValue({ limit: limitSpy });
    await fetchHistorialTcDof(9999);
    expect(limitSpy).toHaveBeenCalledWith(365);
    await fetchHistorialTcDof(0);
    expect(limitSpy).toHaveBeenLastCalledWith(1);
  });

  it("envía la captura manual a la RPC con EUR opcional", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await upsertTcDofManual({ fecha: "2026-07-29", usdMxn: 17.5 });
    expect(rpcMock).toHaveBeenCalledWith("tc_dof_upsert_manual", {
      _fecha: "2026-07-29",
      _usd: 17.5,
      _eur: undefined,
    });
  });
});
