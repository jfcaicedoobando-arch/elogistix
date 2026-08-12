/**
 * BL-04 — el traspaso nunca se registra con tipo de cambio inválido.
 * Antes el servicio enviaba 1 por omisión y convertía USD→MXN 1:1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { registrarTraspaso } from "@/features/tesoreria/services/traspasos";

const base = {
  cuentaOrigenId: "o-1",
  cuentaDestinoId: "d-1",
  fecha: "2026-08-12",
  montoOrigen: 1000,
};

describe("registrarTraspaso — tipo de cambio", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "tr-1", error: null });
  });

  it("rechaza tipo de cambio cero sin llamar a la RPC", async () => {
    await expect(registrarTraspaso({ ...base, tipoCambio: 0 })).rejects.toThrow(
      /tipo de cambio/i,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza tipo de cambio negativo o no numérico", async () => {
    await expect(registrarTraspaso({ ...base, tipoCambio: -5 })).rejects.toThrow();
    await expect(
      registrarTraspaso({ ...base, tipoCambio: Number.NaN }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("envía el tipo de cambio capturado tal cual", async () => {
    await registrarTraspaso({ ...base, tipoCambio: 18.75 });
    expect(rpc).toHaveBeenCalledWith(
      "registrar_traspaso_bancario",
      expect.objectContaining({ p_tipo_cambio: 18.75 }),
    );
  });
});
