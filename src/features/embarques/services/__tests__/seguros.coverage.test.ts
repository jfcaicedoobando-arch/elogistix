import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeguroEmbarqueInput } from "../seguros";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
const { bitacora } = vi.hoisted(() => ({ bitacora: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../bitacoraEmbarques", () => ({ registrarBitacoraEmbarque: bitacora }));
import { createSeguroEmbarque, updateSeguroEmbarque } from "../seguros";
const input: SeguroEmbarqueInput = {
  embarque_id: "shipment", organization_id: "org", aseguradora: "Insurance", numero_poliza: "POL-1",
  certificado_url: null, cobertura_descripcion: null, suma_asegurada: 1000, deducible: 0,
  prima: 100, moneda: "MXN", vigencia_desde: "2026-01-01", vigencia_hasta: "2026-12-31",
  contacto: null, notas: null, proveedor_factura_id: "invoice",
};
beforeEach(() => {
  mock.resetResults(); mock.tableCalls.length = 0; mock.rpcCalls.length = 0; bitacora.mockReset();
  mock.setTableResult("embarques", { data: { organization_id: "org" }, error: null });
});
function result(error: { message: string; code: string } | null, data: unknown = null) {
  mock.setTableResult("seguros_embarque", { data, error });
}
describe("insurance authoritative rejection at service boundary", () => {
  it("propagates INSERT coverage rejection after validating parent and writes no success log", async () => {
    result({ message: "LC_SEGURO_COBERTURA_INCOMPLETA", code: "23514" });
    await expect(createSeguroEmbarque(input)).rejects.toMatchObject({ message: "LC_SEGURO_COBERTURA_INCOMPLETA" });
    expect(mock.getMutationPayload("seguros_embarque")).toEqual(input);
    expect(bitacora).not.toHaveBeenCalled();
  });
  it("propagates UPDATE coverage rejection and writes no success log", async () => {
    result({ message: "LC_SEGURO_COBERTURA_INCOMPLETA", code: "23514" });
    await expect(updateSeguroEmbarque("policy", { prima: 101 })).rejects.toMatchObject({ message: "LC_SEGURO_COBERTURA_INCOMPLETA" });
    expect(mock.getMutationPayload("seguros_embarque", "update")).toEqual({ prima: 101 });
    expect(bitacora).not.toHaveBeenCalled();
  });
  it("logs an accepted update only after the table operation succeeds", async () => {
    result(null); await updateSeguroEmbarque("policy", { notas: "notes" }); expect(bitacora).toHaveBeenCalledOnce();
  });
});
