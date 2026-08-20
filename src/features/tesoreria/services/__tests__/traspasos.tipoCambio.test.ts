/**
 * BL-04 — el traspaso nunca se registra con tipo de cambio inválido.
 * Antes el servicio enviaba 1 por omisión y convertía USD→MXN 1:1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { id: "tr-existente" }, error: null }),
        }),
      }),
    }),
  },
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
    const res = await registrarTraspaso({ ...base, tipoCambio: 18.75 });
    expect(rpc).toHaveBeenCalledWith(
      "registrar_traspaso_bancario",
      expect.objectContaining({ p_tipo_cambio: 18.75 }),
    );
    expect(res).toEqual({ id: "tr-1", duplicado: false });
  });

  // OLA A (A.1) — el doble clic ya no duplica el traspaso.
  it("envía la clave de idempotencia a la RPC", async () => {
    await registrarTraspaso({ ...base, tipoCambio: 1, clientRequestId: "k-1" });
    expect(rpc).toHaveBeenCalledWith(
      "registrar_traspaso_bancario",
      expect.objectContaining({ p_client_request_id: "k-1" }),
    );
  });

  it("ante 23505 devuelve el traspaso ya registrado con la misma clave", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    const res = await registrarTraspaso({
      ...base,
      tipoCambio: 1,
      clientRequestId: "k-1",
    });
    expect(res).toEqual({ id: "tr-existente", duplicado: true });
  });

  it("propaga 23505 cuando no hay clave de idempotencia", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(registrarTraspaso({ ...base, tipoCambio: 1 })).rejects.toEqual({
      code: "23505",
    });
  });
});
