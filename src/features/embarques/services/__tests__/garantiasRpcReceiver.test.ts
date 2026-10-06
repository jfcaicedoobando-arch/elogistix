import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { SupabaseClient } = await import("@supabase/supabase-js");
  return {
    // Exercise the real SDK's receiver-sensitive RPC method without a client,
    // credentials, fetch, or database connection.
    supabase: { rpc: SupabaseClient.prototype.rpc, rest: { rpc: vi.fn() } },
    bitacora: vi.fn(),
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../bitacoraEmbarques", () => ({ registrarBitacoraEmbarque: mock.bitacora }));

import { refrescarGarantiasDesdeTarifa, updateGarantia } from "../garantias";

beforeEach(() => {
  mock.supabase.rest.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  mock.bitacora.mockReset().mockResolvedValue(undefined);
});

describe("guarantee RPC receiver regression (146)", () => {
  it("updates through the real SDK method with the unchanged complete payload", async () => {
    await updateGarantia({
      id: "guarantee-test", estado: "liberado", monto_deposito_usd: 125,
      fecha_deposito: "2026-01-01", fecha_liberacion: "2026-01-02",
      referencia_deposito: "synthetic-reference", notas: "synthetic-note",
    });
    expect(mock.supabase.rest.rpc).toHaveBeenCalledExactlyOnceWith("set_garantia_estado", {
      p_id: "guarantee-test", p_estado: "liberado", p_monto: 125,
      p_fecha_deposito: "2026-01-01", p_fecha_liberacion: "2026-01-02",
      p_referencia: "synthetic-reference", p_notas: "synthetic-note",
    }, { head: false, get: false });
    expect(mock.bitacora).toHaveBeenCalledOnce();
  });

  it.each([
    { id: "guarantee-test" },
    { id: "guarantee-test", fecha_deposito: null, fecha_liberacion: null, referencia_deposito: null, notas: null },
  ])("preserves explicit nulls for absent or cleared fields: %j", async (input) => {
    await updateGarantia(input);
    expect(mock.supabase.rest.rpc).toHaveBeenCalledWith("set_garantia_estado", {
      p_id: "guarantee-test", p_estado: null, p_monto: null,
      p_fecha_deposito: null, p_fecha_liberacion: null, p_referencia: null, p_notas: null,
    }, { head: false, get: false });
  });

  it("does not replace zero or empty strings with null", async () => {
    await updateGarantia({ id: "guarantee-test", monto_deposito_usd: 0, referencia_deposito: "", notas: "" });
    expect(mock.supabase.rest.rpc.mock.calls[0][1]).toMatchObject({ p_monto: 0, p_referencia: "", p_notas: "" });
  });

  it.each([[3, 3], ["2", 2], [null, 0]])("refreshes through the real SDK and preserves count conversion (%j)", async (data, count) => {
    mock.supabase.rest.rpc.mockResolvedValue({ data, error: null });
    await expect(refrescarGarantiasDesdeTarifa("shipment-test")).resolves.toBe(count);
    expect(mock.supabase.rest.rpc).toHaveBeenCalledExactlyOnceWith(
      "refrescar_garantia_desde_tarifa", { p_embarque_id: "shipment-test" }, { head: false, get: false },
    );
    expect(mock.bitacora).toHaveBeenCalledWith({
      accion: "Refrescó garantías desde tarifa", entidadId: "shipment-test", detalles: { filasActualizadas: count },
    });
  });

  describe.each([
    ["update", () => updateGarantia({ id: "guarantee-test" })],
    ["refresh", () => refrescarGarantiasDesdeTarifa("shipment-test")],
  ] as const)("%s errors", (_name, operation) => {
    it.each(["LC_GARANTIA_SIN_ROL", "LC_GARANTIA_TRANSICION_INVALIDA"])("preserves mapped %s and skips logging", async (code) => {
      mock.supabase.rest.rpc.mockResolvedValue({ data: null, error: { message: code } });
      await expect(operation()).rejects.toMatchObject({ name: "GarantiaError", code });
      expect(mock.bitacora).not.toHaveBeenCalled();
    });
    it("preserves unknown errors and skips logging", async () => {
      mock.supabase.rest.rpc.mockResolvedValue({ data: null, error: { message: "synthetic failure" } });
      await expect(operation()).rejects.toMatchObject({ code: "UNKNOWN", message: "synthetic failure" });
      expect(mock.bitacora).not.toHaveBeenCalled();
    });
  });
});
