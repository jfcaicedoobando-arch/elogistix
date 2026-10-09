import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeguroEmbarqueInput } from "../seguros";
const { from, bitacora, query } = vi.hoisted(() => {
  const query = { insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), then: vi.fn() };
  return { from: vi.fn(), bitacora: vi.fn(), query };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("../bitacoraEmbarques", () => ({ registrarBitacoraEmbarque: bitacora }));
import { createSeguroEmbarque, updateSeguroEmbarque } from "../seguros";

const input: SeguroEmbarqueInput = {
  embarque_id: "shipment", organization_id: "org", aseguradora: "Insurance", numero_poliza: "POL-1",
  certificado_url: null, cobertura_descripcion: null, suma_asegurada: 1000, deducible: 0,
  prima: 100, moneda: "MXN", vigencia_desde: "2026-01-01", vigencia_hasta: "2026-12-31",
  contacto: null, notas: null, proveedor_factura_id: "invoice",
};
beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue(query);
  for (const method of [query.insert, query.update, query.eq, query.select, query.single]) method.mockReturnValue(query);
});
function result(error: { message: string; code: string } | null, data: unknown = null) {
  query.then.mockImplementation((resolve: (v: unknown) => void) => Promise.resolve({ data, error }).then(resolve));
}
describe("insurance authoritative rejection at service boundary", () => {
  it("propagates INSERT coverage rejection and writes no success log", async () => {
    result({ message: "LC_SEGURO_COBERTURA_INCOMPLETA", code: "23514" });
    await expect(createSeguroEmbarque(input)).rejects.toMatchObject({ message: "LC_SEGURO_COBERTURA_INCOMPLETA" });
    expect(query.insert).toHaveBeenCalledWith(input);
    expect(bitacora).not.toHaveBeenCalled();
  });
  it("propagates UPDATE coverage rejection and writes no success log", async () => {
    result({ message: "LC_SEGURO_COBERTURA_INCOMPLETA", code: "23514" });
    await expect(updateSeguroEmbarque("policy", { prima: 101 })).rejects.toMatchObject({ message: "LC_SEGURO_COBERTURA_INCOMPLETA" });
    expect(query.update).toHaveBeenCalledWith({ prima: 101 });
    expect(bitacora).not.toHaveBeenCalled();
  });
  it("logs an accepted update only after the table operation succeeds", async () => {
    result(null);
    await updateSeguroEmbarque("policy", { notas: "notes" });
    expect(bitacora).toHaveBeenCalledOnce();
  });
});
