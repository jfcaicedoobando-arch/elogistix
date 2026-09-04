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

const base = {
  cotizacionId: "cot-1",
  modoTransporte: "Marítimo",
  // P0: el cotizador ya no crea prospectos; siempre viaja un origen CRM.
  leadId: "lead-1",
  prospecto: { empresa: "ACME", contacto: "Juan", email: "j@x.com", telefono: "81", rfc: "ABC010101AB1" },
  user: null,
};

describe("vincularOCrearOportunidadParaCotizacion", () => {
  beforeEach(() => {
    rpc.mockReset();
    registrarActividad.mockReset();
  });

  it("envía los datos fiscales a la RPC y devuelve los ids", async () => {
    rpc.mockResolvedValue({ data: { oportunidad_id: "op-1", lead_id: "lead-1" }, error: null });

    const r = await vincularOCrearOportunidadParaCotizacion(base);

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("crm_vincular_cotizacion");
    expect((args.p_prospecto as Record<string, string>).rfc).toBe("ABC010101AB1");
    expect(r).toEqual({ oportunidadId: "op-1", leadId: "lead-1" });
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
