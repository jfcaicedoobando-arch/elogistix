/**
 * Vínculo transaccional cotización ↔ oportunidad (RPC `crm_vincular_cotizacion`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const registrarActividad = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: (...a: unknown[]) => registrarActividad(...a),
}));

import { vincularOCrearOportunidadParaCotizacion } from "../vincularOCrear";

// P0: el cotizador ya no crea prospectos; siempre viaja un origen CRM existente.
const base = {
  cotizacionId: "cot-1",
  leadId: "lead-1",
};

describe("vincularOCrearOportunidadParaCotizacion", () => {
  beforeEach(() => {
    rpc.mockReset();
    registrarActividad.mockReset();
  });

  it("envía el origen CRM a la RPC y devuelve los ids", async () => {
    rpc.mockResolvedValue({
      data: { oportunidad_id: "op-1", lead_id: "lead-1", updated_at: "2026-09-03T12:00:00Z" },
      error: null,
    });

    const r = await vincularOCrearOportunidadParaCotizacion(base);

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("crm_vincular_cotizacion");
    expect(args.p_lead_id).toBe("lead-1");
    expect(r).toEqual({
      oportunidadId: "op-1",
      leadId: "lead-1",
      updatedAt: "2026-09-03T12:00:00Z",
    });
    expect(registrarActividad).toHaveBeenCalledTimes(1);
  });

  it("es idempotente: si ya estaba ligada no registra actividad", async () => {
    rpc.mockResolvedValue({ data: { oportunidad_id: "op-1", ya_ligada: true }, error: null });

    await vincularOCrearOportunidadParaCotizacion(base);

    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("propaga el error de la RPC (no deja vínculos a medias)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("LC_ORG_INEXISTENTE") });

    await expect(vincularOCrearOportunidadParaCotizacion(base)).rejects.toThrow("LC_ORG_INEXISTENTE");
  });
});
